import { chromium, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const evidence = {
  simulatedSensors: true,
  physicalDeviceTested: false,
  engines: [],
};
const hardStop = setTimeout(() => process.exit(2), 120000);
for (const [engineName, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch({
    headless: true,
    ...(engineName === "chromium"
      ? { args: ["--enable-unsafe-swiftshader"] }
      : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.addInitScript(() => {
      window.sensorCalls = [];
      window.sensorPermissions = { orientation: "granted", motion: "granted" };
      Object.defineProperty(screen, "orientation", {
        configurable: true,
        value: Object.assign(new EventTarget(), { angle: 90 }),
      });
      class Orientation extends Event {
        constructor(type, values) {
          super(type);
          Object.assign(this, values);
        }
        static requestPermission() {
          window.sensorCalls.push({
            kind: "orientation",
            active: navigator.userActivation?.isActive ?? null,
          });
          return Promise.resolve(window.sensorPermissions.orientation);
        }
      }
      class Motion extends Event {
        constructor(type, values) {
          super(type);
          Object.assign(this, values);
        }
        static requestPermission() {
          window.sensorCalls.push({
            kind: "motion",
            active: navigator.userActivation?.isActive ?? null,
          });
          return Promise.resolve(window.sensorPermissions.motion);
        }
      }
      Object.defineProperty(window, "DeviceOrientationEvent", {
        configurable: true,
        value: Orientation,
      });
      Object.defineProperty(window, "DeviceMotionEvent", {
        configurable: true,
        value: Motion,
      });
    });
    // First exercise the actual game's trusted button click and visible feedback.
    await page.goto("http://127.0.0.1:5173/");
    await page.waitForFunction(() => !!window.__derby, null, { polling: 100 });
    await page.evaluate(() => {
      window.__derby.renderEnabled = false;
      document.querySelector("#garage-btn").click();
    });
    await page.locator("#gyro").click();
    const waiting = await page.evaluate(() => ({
      status: __derby.controls.gyroStatus,
      enabled: __derby.controls.gyroEnabled,
      calls: window.sensorCalls,
    }));
    assert.equal(waiting.status, "waiting");
    assert.equal(waiting.enabled, false);
    assert.equal(waiting.calls.length, 2);
    assert.ok(waiting.calls.every((c) => c.active !== false));
    await page.evaluate(() => {
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 90 }),
      );
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          beta: -12,
          gamma: 90,
        }),
      );
    });
    await page.waitForFunction(
      () =>
        __derby.controls.input.steer > 0.35 &&
        __derby.controls.input.steer < 0.65,
      null,
      { polling: 50 },
    );
    const enabled = await page.evaluate(() => ({
      status: __derby.controls.gyroStatus,
      steer: __derby.controls.input.steer,
      text: document.querySelector("#garage .tilt-feedback-title").textContent,
    }));
    assert.equal(enabled.status, "enabled");
    assert.equal(enabled.text, "Tilt steering is ready");
    await page.screenshot({
      path: `verification/ios-tilt/${engineName}-ready.png`,
    });
    await page.locator("#garage .tilt-recenter").click();
    await page.evaluate(() =>
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          beta: -12,
          gamma: 90,
        }),
      ),
    );
    assert.ok(
      Math.abs(await page.evaluate(() => __derby.controls.gyro)) < 0.001,
    );
    await page.evaluate(() => {
      screen.orientation.angle = 270;
      screen.orientation.dispatchEvent(new Event("change"));
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          beta: 0,
          gamma: -90,
        }),
      );
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          beta: 12,
          gamma: -90,
        }),
      );
    });
    assert.ok(
      await page.evaluate(
        () => __derby.controls.gyro > 0.35 && __derby.controls.gyro < 0.65,
      ),
    );
    await page.evaluate(() => {
      __derby.controls._stopGyroListeners();
        __derby.controls._setGyroStatus("not-enabled");
      window.sensorPermissions.orientation = "denied";
      window.sensorPermissions.motion = "granted";
    });
    await page.locator("#gyro").click();
    await page.evaluate(() => {
      dispatchEvent(
        new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: { x: 9.8, y: 0, z: 0 },
        }),
      );
      dispatchEvent(
        new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: { x: 9.58, y: 2.04, z: 0 },
        }),
      );
    });
    const fallback = await page.evaluate(() => ({
      status: __derby.controls.gyroStatus,
      steer: __derby.controls.gyro,
    }));
    assert.equal(fallback.status, "enabled");
    assert.ok(fallback.steer > 0.35 && fallback.steer < 0.65);
    await page.evaluate(() => {
      __derby.controls._stopGyroListeners();
        __derby.controls._setGyroStatus("not-enabled");
      window.sensorPermissions.orientation = "denied";
      window.sensorPermissions.motion = "denied";
    });
    await page.locator("#gyro").click();
    assert.equal(
      await page.evaluate(() => __derby.controls.gyroStatus),
      "denied",
    );
    await page.evaluate(() => {
      window.sensorPermissions.orientation = "granted";
      window.sensorPermissions.motion = "granted";
    });
    await page.locator("#gyro").click();
    await page.waitForFunction(
      () => __derby.controls.gyroStatus === "no-data",
      null,
      { polling: 100, timeout: 5000 },
    );
    assert.equal(
      await page.locator("#garage .tilt-safari-link").isVisible(),
      true,
    );
    // A slow iPad event can arrive after the diagnostic timeout. Permissioned
    // listeners must remain live, and a fresh reading should restore steering.
    await page.evaluate(() => {
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          beta: 0,
          gamma: -90,
        }),
      );
      dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          beta: 12,
          gamma: -90,
        }),
      );
    });
    assert.equal(await page.evaluate(() => __derby.controls.gyroStatus), "enabled");
    assert.ok(await page.evaluate(() => __derby.controls.gyro > 0.35 && __derby.controls.gyro < 0.65));
    await page.locator("#back").click();
    await page.locator("#family-btn").click();
    assert.equal(await page.locator("#lobby-tilt").isVisible(), true);
    await page.evaluate(() => {
      __derby.controls._stopGyroListeners();
      __derby.controls._setGyroStatus("not-enabled");
    });
    const callsBeforeLobby = await page.evaluate(() => window.sensorCalls.length);
    await page.locator("#lobby-tilt").click();
    await page.waitForFunction(() => __derby.controls.gyroStatus === "waiting");
    assert.equal(await page.evaluate(() => __derby.controls.gyroStatus), "waiting");
    assert.equal(await page.evaluate(() => window.sensorCalls.length), callsBeforeLobby + 2);
    evidence.engines.push({
      engine: engineName,
      permissionClick: waiting,
      enabled,
      recenter: true,
      landscape270: true,
      motionFallback: fallback,
      denied: true,
      noData: true,
      delayedRecovery: true,
      familyLobbyEnable: true,
      errors,
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
clearTimeout(hardStop);
await writeFile(
  "verification/ios-tilt/results.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
