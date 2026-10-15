import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] || "visual";
const base = process.env.DERBY_URL || "http://127.0.0.1:5173";
const round = process.env.DERBY_ROUND || "current";
const output = new URL("../critique/", import.meta.url);
await mkdir(output, { recursive: true });
const findings = { mode, url: base, screenshots: [], errors: [], checks: {} };
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const hardStop = setTimeout(() => {
  console.error(`${mode} verification exceeded 70 seconds`);
  process.exit(2);
}, 70000);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("pageerror", (error) => findings.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") findings.errors.push(message.text());
});
page.on("requestfailed", (request) =>
  findings.errors.push(`${request.url()}: ${request.failure()?.errorText}`),
);
const wait = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms,
      ),
    ),
  ]);
const ready = async (target) => {
  await target.goto(base, { waitUntil: "domcontentloaded" });
  await target.waitForFunction(() => Boolean(window.__derby), null, {
    timeout: 15000,
    polling: 100,
  });
};
async function shot(name) {
  const filename = `round-${round}-${name}.png`;
  await page.screenshot({
    path: fileURLToPath(new URL(filename, output)),
    timeout: 15000,
  });
  findings.screenshots.push(filename);
}

try {
  if (mode === "visual") {
    await ready(page);
    await shot("home");
    findings.checks.home = await page.locator("#home").isVisible();
    await page.locator("#garage-btn").click();
    await shot("garage");
    findings.checks.garage = await page.locator("#garage").isVisible();
    findings.checks.vehicleCount = await page.locator("[data-car]").count();
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__derby.racers.length === 6, null, {
      timeout: 10000,
      polling: 100,
    });
    await page.waitForTimeout(3200);
    await shot("cockpit");
    findings.checks.race = await page.locator("#pause").isVisible();
    findings.checks.racerCount = await page.evaluate(
      () => window.__derby.racers.length,
    );
    findings.checks.motionBefore = await page.evaluate(
      () => window.__derby.racers[0].s,
    );
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(600);
    await page.keyboard.up("KeyW");
    findings.checks.motionAfter = await page.evaluate(
      () => window.__derby.racers[0].s,
    );
  } else if (mode === "scenes") {
    await ready(page);
    await page.locator("#garage-btn").click();
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__derby.racers.length === 6, null, {
      timeout: 10000,
      polling: 100,
    });
    for (const [name, distance] of [
      ["mud", 100],
      ["water", 235],
      ["barn", 570],
    ]) {
      await page.evaluate((s) => {
        const racer = window.__derby.racers[0];
        racer.s = s;
        racer.speed = 0;
        racer.lateral = 0;
        const road = window.__derby.roadAt(s);
        racer.position = { x: road.x, y: road.y + 0.6, z: road.z };
      }, distance);
      await page.waitForTimeout(250);
      await shot(name);
      findings.checks[name] = await page.evaluate(() => ({
        s: window.__derby.racers[0].s,
        surface: window.__derby.surfaceAt(window.__derby.racers[0].s, 0).type,
      }));
    }
  } else if (mode === "mobile") {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "maxTouchPoints", {
        configurable: true,
        get: () => 5,
      }),
    );
    await ready(page);
    await page.locator("#garage-btn").click();
    await shot("mobile-garage");
    findings.checks.mobileGarage = {
      startVisible: await page.locator("#start").isVisible(),
      startBox: await page.locator("#start").boundingBox(),
      viewportHeight: 390,
    };
    findings.checks.mobileGarage.startInViewport = findings.checks.mobileGarage.startBox.y >= 0 && findings.checks.mobileGarage.startBox.y + findings.checks.mobileGarage.startBox.height <= 390;
    await page.locator("#start").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#drive-guide").classList.contains("hidden"),
      null,
      { timeout: 5000, polling: 100 },
    );
    await shot("mobile-guide");
    findings.checks.mobileGuide = {
      readyVisible: await page.locator("#hands-ready").isVisible(),
      readyBox: await page.locator("#hands-ready").boundingBox(),
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("mobile-portrait");
    findings.checks.portrait = await page.locator("#portrait").isVisible();
    await page.setViewportSize({ width: 1024, height: 1366 });
    await shot("tablet-portrait");
    findings.checks.tabletPortrait = await page.locator("#portrait").isVisible();
    const desktopContext = await browser.newContext({ viewport: { width: 800, height: 1200 } });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(base, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForFunction(() => Boolean(window.__derby), null, { timeout: 15000, polling: 100 });
    findings.checks.desktopPortrait = await desktopPage.locator("#portrait").isVisible();
    await desktopContext.close();
  } else if (mode === "lobby") {
    await ready(page);
    await page.locator("#family-btn").click();
    await page.waitForFunction(
      () => !document.querySelector("#lobby").classList.contains("hidden"),
      null,
      { timeout: 5000, polling: 100 },
    );
    await shot("lobby");
    findings.checks.lobby = true;
  } else if (mode === "network") {
    if (!base.includes("5173"))
      throw new Error("Network module check requires the Vite dev origin");
    await context.route(base + "/", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Network check</title>",
      }),
    );
    const guest = await context.newPage();
    await Promise.all([page.goto(base), guest.goto(base)]);
    await Promise.all([
      page.evaluate(async () => {
        window.net = new (await import("/src/network.js")).FamilyNetwork();
      }),
      guest.evaluate(async () => {
        window.net = new (await import("/src/network.js")).FamilyNetwork();
      }),
    ]);
    const offer = await wait(
      page.evaluate(() => window.net.hostOffer()),
      22000,
      "host offer",
    );
    findings.checks.offerBytes = offer.length;
    findings.checks.qrRoundTrip = await page.evaluate(async (code) => {
      const [{ default: QRCode }, { default: jsQR }] = await Promise.all([
        import("/node_modules/.vite/deps/qrcode.js"),
        import("/node_modules/.vite/deps/jsqr.js"),
      ]);
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, code, {
        width: 640,
        margin: 4,
        errorCorrectionLevel: "L",
      });
      const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(pixels.data, pixels.width, pixels.height)?.data === code;
    }, offer);
    const answer = await wait(
      guest.evaluate((code) => window.net.joinOffer(code), offer),
      22000,
      "guest answer",
    );
    findings.checks.answerBytes = answer.length;
    await wait(
      page.evaluate((code) => window.net.acceptAnswer(code), answer),
      10000,
      "answer acceptance",
    );
    await Promise.all([
      page.waitForFunction(() => window.net.connectedCount === 1, null, {
        timeout: 10000,
        polling: 100,
      }),
      guest.waitForFunction(() => window.net.connectedCount === 1, null, {
        timeout: 10000,
        polling: 100,
      }),
    ]);
    findings.checks.webrtc = {
      host: await page.evaluate(() => window.net.connectedCount),
      guest: await guest.evaluate(() => window.net.connectedCount),
    };
    await page.evaluate(() => {
      window.receivedInput = null;
      window.net.onInput = (values) => {
        window.receivedInput = values;
      };
    });
    await guest.evaluate(() => {
      window.receivedSnapshot = null;
      window.net.onSnapshot = (values) => {
        window.receivedSnapshot = values;
      };
      window.net.sendInput([0.5, 1, 0, 0, 1, 0]);
    });
    await page.waitForFunction(() => window.receivedInput?.[0] === 0.5, null, {
      timeout: 5000,
      polling: 100,
    });
    await page.evaluate(() => window.net.broadcast([88, 10, 0, 3, 0]));
    await guest.waitForFunction(
      () => window.receivedSnapshot?.[0] === 88,
      null,
      { timeout: 5000, polling: 100 },
    );
    findings.checks.binaryDelivery = {
      input: await page.evaluate(() => window.receivedInput),
      snapshot: await guest.evaluate(() => window.receivedSnapshot),
    };
    await page.evaluate(() => {
      window.vehicleChoice = null;
      window.net.onVehicle = (choice) => {
        window.vehicleChoice = choice;
      };
    });
    await guest.evaluate(() => window.net.sendVehicle(3));
    await page.waitForFunction(() => window.vehicleChoice === 3, null, {
      timeout: 5000,
      polling: 100,
    });
    await page.evaluate(() =>
      window.net.sendSlot([...window.net.peers.keys()][0], 1),
    );
    await guest.waitForFunction(
      () =>
        window.receivedSnapshot?.[0] === 77 &&
        window.receivedSnapshot?.[1] === 1,
      null,
      { timeout: 5000, polling: 100 },
    );
    findings.checks.metadata = {
      vehicle: await page.evaluate(() => window.vehicleChoice),
      slot: await guest.evaluate(() => window.receivedSnapshot[1]),
    };
    await guest.evaluate(() => {
      window.roster = null;
      window.net.onRoster = (models) => {
        window.roster = models;
      };
    });
    await page.evaluate(() => window.net.broadcastRoster([0, 3, 2, 4, 5, 9]));
    await guest.waitForFunction(() => window.roster?.length === 6, null, {
      timeout: 5000,
      polling: 100,
    });
    findings.checks.roster = await guest.evaluate(() => window.roster);
    findings.checks.invalidRosterRejected = await page.evaluate(() => {
      try {
        window.net.broadcastRoster([0, 1, 2, 3, 4, 10]);
        return false;
      } catch (error) {
        return error instanceof TypeError;
      }
    });
    await guest.evaluate(() => {
      window.raceState = null;
      window.finishTimes = null;
      window.net.onRace = (epoch, active) => { window.raceState = [epoch, active]; };
      window.net.onResults = times => { window.finishTimes = times; };
    });
    await page.evaluate(() => window.net.broadcastRace(101, 1));
    await guest.waitForFunction(() => window.raceState?.[0] === 101 && window.raceState?.[1] === 1, null, { timeout: 5000, polling: 100 });
    await page.evaluate(() => window.net.broadcastResults([12, 14, -1, 16, 18, 20]));
    await guest.waitForFunction(() => window.finishTimes?.[0] === 12, null, { timeout: 5000, polling: 100 });
    await page.evaluate(() => window.net.broadcastRace(101, 0));
    await guest.waitForFunction(() => window.raceState?.[1] === 0, null, { timeout: 5000, polling: 100 });
    findings.checks.lifecycle = { raceState: await guest.evaluate(() => window.raceState), finishTimes: await guest.evaluate(() => window.finishTimes) };
    findings.checks.invalidLifecycleRejected = await page.evaluate(() => { try { window.net.broadcastRace(0, 1); return false; } catch (error) { return error instanceof TypeError; } });
    await Promise.all([
      page.evaluate(() => window.net.close()),
      guest.evaluate(() => window.net.close()),
    ]);
  } else if (mode === "game") {
    await ready(page);
    await page.evaluate(() => {
      window.__derby.renderEnabled = false;
    });
    const guest = await context.newPage();
    guest.on("pageerror", (error) =>
      findings.errors.push("guest: " + error.message),
    );
    await ready(guest);
    await guest.evaluate(() => {
      window.__derby.renderEnabled = false;
      document.querySelector("#garage-btn").click();
      document.querySelector('[data-car="3"]').click();
    });
    const offer = await wait(
      page.evaluate(() => window.__derby.net.hostOffer()),
      22000,
      "host offer",
    );
    const answer = await wait(
      guest.evaluate((code) => window.__derby.net.joinOffer(code), offer),
      22000,
      "guest answer",
    );
    await page.evaluate(
      (code) => window.__derby.net.acceptAnswer(code),
      answer,
    );
    await Promise.all([
      page.waitForFunction(
        () => window.__derby.net.connectedCount === 1,
        null,
        { timeout: 10000, polling: 100 },
      ),
      guest.waitForFunction(
        () => window.__derby.net.connectedCount === 1,
        null,
        { timeout: 10000, polling: 100 },
      ),
    ]);
    await page.waitForFunction(
      () =>
        window.__derby.vehicles.some(
          ([slot, model]) => slot === 1 && model === 3,
        ),
      null,
      { timeout: 5000, polling: 100 },
    );
    await page.evaluate(() => window.__derby.start());
    await guest.waitForFunction(
      () => window.__derby.running && window.__derby.racers.length === 6,
      null,
      { timeout: 5000, polling: 100 },
    );
    await page.waitForTimeout(4500);
    findings.checks.game = {
      hostSlots: await page.evaluate(() => window.__derby.peerSlots),
      hostVehicles: await page.evaluate(() => window.__derby.vehicles),
      hostGuestS: await page.evaluate(() => window.__derby.racers[1].s),
      guestSelfS: await guest.evaluate(() => window.__derby.racers[1].s),
      guestRunning: await guest.evaluate(() => window.__derby.running),
    };
    await page.evaluate(() => { const racer = window.__derby.racers[0]; racer.s = 3218; racer.finished = true; racer.finishTime = racer.elapsed; });
    await page.waitForFunction(() => !document.querySelector('#finish').classList.contains('hidden'), null, { timeout: 5000, polling: 100 });
    findings.checks.hostFinishKeepsRace = await page.evaluate(() => window.__derby.running);
    await page.evaluate(() => document.querySelector('#pause').click());
    await guest.waitForFunction(() => !window.__derby.running, null, { timeout: 5000, polling: 100 });
    findings.checks.guestStopsWithHost = true;
    await page.evaluate(() => window.__derby.start());
    await guest.waitForFunction(() => window.__derby.running && window.__derby.racers[1].s < 20, null, { timeout: 5000, polling: 100 });
    findings.checks.guestRestartsWithHost = true;
    await guest.evaluate(() => window.__derby.net.close());
    await page.waitForFunction(
      () => window.__derby.peerSlots.length === 0,
      null,
      { timeout: 8000, polling: 100 },
    );
    const before = await page.evaluate(() => window.__derby.racers[1].s);
    await page.waitForTimeout(3800);
    findings.checks.disconnect = {
      slotFreed: true,
      aiMoved: (await page.evaluate(() => window.__derby.racers[1].s)) > before,
    };
    await page.evaluate(() => window.__derby.net.close());
  } else if (mode === "controls") {
    if (!base.includes("5173"))
      throw new Error("Controls module check requires the Vite dev origin");
    await context.route(base + "/", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: '<!doctype html><canvas width="1000" height="500"></canvas>',
      }),
    );
    await page.goto(base);
    findings.checks.controls = await page.evaluate(async () => {
      const { Controls } = await import("/src/controls.js");
      const canvas = document.querySelector("canvas");
      canvas.style.width = "1000px";
      canvas.style.height = "500px";
      canvas.setPointerCapture = () => {};
      Object.defineProperty(window, "DeviceOrientationEvent", {
        configurable: true,
        value: class extends Event {
          constructor(type, values = {}) {
            super(type);
            this.gamma = values.gamma;
            this.beta = values.beta ?? 0;
          }
        },
      });
      const controls = new Controls(canvas);
      const pointer = (type, id, x, y) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: id,
            clientX: x,
            clientY: y,
          }),
        );
      pointer("pointerdown", 1, 250, 300);
      pointer("pointermove", 1, 250, 220);
      const swipe = controls.update(1 / 60).leftPaddle;
      pointer("pointerup", 1, 250, 220);
      pointer("pointerdown", 2, 100, 460);
      const brake = controls.update(1 / 60).brake;
      pointer("pointerup", 2, 100, 460);
      pointer("pointerdown", 3, 900, 460);
      controls.pointers.get(3).started -= 500;
      const reverse = controls.update(1 / 60).reverse;
      pointer("pointerup", 3, 900, 460);
      const reverseLatched = controls.update(1 / 60).reverse;
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyR", bubbles: true }),
      );
      const reverseKeyOff = controls.update(1 / 60).reverse === false;
      window.dispatchEvent(
        new KeyboardEvent("keyup", { code: "KeyR", bubbles: true }),
      );
      const enabled = await controls.enableGyro();
      window.dispatchEvent(
        new window.DeviceOrientationEvent("deviceorientation", { gamma: 0 }),
      );
      window.dispatchEvent(
        new window.DeviceOrientationEvent("deviceorientation", { gamma: 12 }),
      );
      const gyroSteer = controls.update(1 / 60).steer;
      controls.dispose();
      return {
        swipe,
        brake,
        reverse,
        reverseLatched,
        reverseKeyOff,
        enabled,
        gyroSteer,
      };
    });
  } else if (mode === "offline") {
    if (!base.includes("4173"))
      throw new Error("Offline check requires the production preview origin");
    await ready(page);
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker.controller),
      null,
      { timeout: 15000, polling: 100 },
    );
    findings.checks.controlled = true;
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    findings.checks.offlineReload = await page.locator("#home").isVisible();
    await context.setOffline(false);
  } else throw new Error(`Unknown verification mode: ${mode}`);
} catch (error) {
  findings.errors.push(error.stack || String(error));
}
await writeFile(
  new URL(`verify-${mode}.json`, output),
  JSON.stringify(findings, null, 2),
);
console.log(JSON.stringify(findings, null, 2));
await browser.close();
clearTimeout(hardStop);
if (findings.errors.length) process.exitCode = 1;
