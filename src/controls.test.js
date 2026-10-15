import test from "node:test";
import assert from "node:assert/strict";
import { Controls } from "./controls.js";

test("tilt diagnostics distinguish missing API, insecure origin and denied permission", async () => {
  const previous = globalThis.window;
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    isSecureContext: true,
  };
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), false);
    assert.equal(controls.gyroStatus, "unsupported");
    window.DeviceOrientationEvent = { requestPermission: async () => "denied" };
    window.isSecureContext = false;
    assert.equal(await controls.enableGyro(), false);
    assert.equal(controls.gyroStatus, "insecure");
    window.isSecureContext = true;
    assert.equal(await controls.enableGyro(), false);
    assert.equal(controls.gyroStatus, "denied");
    window.DeviceOrientationEvent.requestPermission = async () => "granted";
    assert.equal(await controls.enableGyro(), true);
    assert.equal(controls.gyroStatus, "waiting");
    assert.equal(controls.gyroEnabled, false);
  } finally {
    controls.dispose();
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

function sensorHarness({ orientation, motion, angle = 90 } = {}) {
  const oldWindow = globalThis.window;
  const oldScreen = globalThis.screen;
  const listeners = new Map();
  const orientationListeners = new Map();
  globalThis.window = {
    isSecureContext: true,
    DeviceOrientationEvent: orientation,
    DeviceMotionEvent: motion,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  globalThis.screen = {
    orientation: {
      angle,
      addEventListener(name, listener) {
        orientationListeners.set(name, listener);
      },
      removeEventListener(name, listener) {
        if (orientationListeners.get(name) === listener)
          orientationListeners.delete(name);
      },
    },
  };
  return {
    emit(name, value) {
      listeners.get(name)?.(value);
    },
    rotate(value) {
      screen.orientation.angle = value;
      orientationListeners.get("change")?.();
    },
    listeners,
    restore() {
      if (oldWindow === undefined) delete globalThis.window;
      else globalThis.window = oldWindow;
      if (oldScreen === undefined) delete globalThis.screen;
      else globalThis.screen = oldScreen;
    },
  };
}

test("iOS permission methods are both called within the same activation", async () => {
  const called = [];
  const harness = sensorHarness({
    orientation: {
      requestPermission() {
        called.push("orientation");
        return Promise.resolve("granted");
      },
    },
    motion: {
      requestPermission() {
        called.push("motion");
        return Promise.resolve("granted");
      },
    },
  });
  const controls = new Controls(null);
  try {
    const request = controls.enableGyro();
    assert.deepEqual(called, ["orientation", "motion"]);
    assert.equal(await request, true);
    assert.equal(controls.gyroStatus, "waiting");
    const statuses = [];
    controls.onGyroStatus = (status) => statuses.push(status);
    harness.emit("deviceorientation", { beta: 0, gamma: 90 });
    assert.equal(controls.gyroStatus, "enabled");
    assert.equal(controls.gyroEnabled, true);
    assert.ok(statuses.includes("enabled"));
  } finally {
    controls.dispose();
    harness.restore();
  }
});

test("orientation and motion independently activate; denied orientation falls back to motion", async () => {
  const harness = sensorHarness({
    orientation: { requestPermission: async () => "denied" },
    motion: { requestPermission: async () => "granted" },
  });
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), true);
    assert.equal(harness.listeners.has("deviceorientation"), false);
    assert.equal(harness.listeners.has("devicemotion"), true);
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: -9.8, y: 0, z: 0 },
    });
    assert.equal(controls.gyroStatus, "enabled");
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: null, y: null, z: null },
    });
    assert.ok(Number.isFinite(controls.gyro));
  } finally {
    controls.dispose();
    harness.restore();
  }
});

test("orientation-only permission works and 12-degree wheel turn steers right at landscape 90/270", async () => {
  const harness = sensorHarness({
    orientation: { requestPermission: async () => "granted" },
  });
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), true);
    harness.emit("deviceorientation", { beta: 0, gamma: 90 });
    harness.emit("deviceorientation", { beta: -12, gamma: 90 });
    const at90 = controls.gyro;
    assert.ok(at90 > 0.35 && at90 < 0.65);
    harness.rotate(270);
    assert.equal(controls.gyroStatus, "waiting");
    harness.emit("deviceorientation", { beta: 0, gamma: -90 });
    harness.emit("deviceorientation", { beta: 12, gamma: -90 });
    assert.ok(controls.gyro > 0.35 && controls.gyro < 0.65);
  } finally {
    controls.dispose();
    harness.restore();
  }
});

test("no sensor data reports timeout but later samples recover without another permission prompt", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let timeout;
  globalThis.setTimeout = (callback) => {
    timeout = callback;
    return 1;
  };
  globalThis.clearTimeout = () => {};
  const harness = sensorHarness({
    motion: { requestPermission: async () => "granted" },
  });
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), true);
    harness.emit("devicemotion", { accelerationIncludingGravity: null });
    assert.equal(controls.gyroStatus, "waiting");
    timeout();
    assert.equal(controls.gyroStatus, "no-data");
    assert.equal(harness.listeners.has("devicemotion"), true);
    assert.equal(controls.gyroEnabled, false);
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: -9.8, y: 0, z: 0 },
    });
    assert.equal(controls.gyroStatus, "enabled");
    assert.equal(controls.gyroEnabled, true);
    controls.recalibrate();
    timeout();
    assert.equal(controls.gyroStatus, "no-data");
    assert.equal(await controls.enableGyro(), true);
    assert.equal(controls.gyroStatus, "waiting");
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: -9.8, y: 0, z: 0 },
    });
    assert.equal(controls.gyroStatus, "enabled");
  } finally {
    controls.dispose();
    harness.restore();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("motion gravity calibrates in both landscape directions and rejects bad samples", async () => {
  const harness = sensorHarness({
    motion: { requestPermission: async () => "granted" },
  });
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), true);
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: -9.8, y: 0, z: 0 },
    });
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: -9.58, y: -2.04, z: 0 },
    });
    const at90 = controls.gyro;
    assert.ok(at90 > 0.35 && at90 < 0.65);
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: NaN, y: 0, z: 0 },
    });
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 100, y: 0, z: 0 },
    });
    assert.equal(controls.gyro, at90);
    harness.rotate(270);
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 9.8, y: 0, z: 0 },
    });
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 9.58, y: 2.04, z: 0 },
    });
    assert.ok(controls.gyro > 0.35 && controls.gyro < 0.65);
  } finally {
    controls.dispose();
    harness.restore();
  }
});

test("two denied sensor permissions leave tilt off", async () => {
  const harness = sensorHarness({
    orientation: { requestPermission: async () => "denied" },
    motion: { requestPermission: async () => "denied" },
  });
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), false);
    assert.equal(controls.gyroStatus, "denied");
    assert.equal(harness.listeners.has("deviceorientation"), false);
    assert.equal(harness.listeners.has("devicemotion"), false);
  } finally {
    controls.dispose();
    harness.restore();
  }
});

test("flat sensor samples wait; roll crossing ±180 degrees stays finite and small", async () => {
  const harness = sensorHarness({
    motion: { requestPermission: async () => "granted" },
  });
  const controls = new Controls(null);
  try {
    assert.equal(await controls.enableGyro(), true);
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 0, y: 0, z: -9.8 },
    });
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 0.2, y: 0, z: -9.8 },
    });
    assert.equal(controls.gyroStatus, "waiting");
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 9.8, y: 0.17, z: 0 },
    });
    harness.emit("devicemotion", {
      accelerationIncludingGravity: { x: 9.8, y: -0.17, z: 0 },
    });
    assert.ok(Math.abs(controls.gyro) < 0.2);
    assert.ok(Number.isFinite(controls.gyro));
  } finally {
    controls.dispose();
    harness.restore();
  }
});

const fakeCanvas = () => ({
  style: {},
  addEventListener() {},
  removeEventListener() {},
  setPointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
});

test("R toggles a persistent reverse gear once per press", () => {
  const controls = new Controls(fakeCanvas());
  controls._onKeyDown({ code: "KeyR", preventDefault() {} });
  assert.equal(controls.update().reverse, true);
  assert.equal(controls.update().reverse, true);
  controls._onKeyUp({ code: "KeyR" });
  controls.update();
  controls._onKeyDown({ code: "KeyR", preventDefault() {} });
  assert.equal(controls.update().reverse, false);
  controls.dispose();
});

test("edge swipes map down to forward, up to reverse, and two paused thumbs brake", () => {
  const controls = new Controls(fakeCanvas());
  controls._onPointerDown({ pointerId: 1, clientX: 90, clientY: 150 });
  controls._onPointerMove({ pointerId: 1, clientX: 90, clientY: 220 });
  assert.equal(controls.update().swipeDirection, 1);
  assert.equal(controls.input.touchDrive, true);
  assert.equal(controls.input.reverse, false);
  controls._onPointerUp({ pointerId: 1 });
  controls.update(0.2);
  controls._onPointerDown({ pointerId: 2, clientX: 900, clientY: 300 });
  controls._onPointerMove({ pointerId: 2, clientX: 900, clientY: 220 });
  assert.equal(controls.update().swipeDirection, -1);
  assert.equal(controls.input.reverse, true);
  assert.equal(controls.input.headlight, false);
  controls._onPointerDown({ pointerId: 3, clientX: 90, clientY: 250 });
  for (const p of controls.pointers.values()) p.lastMoved -= 300;
  assert.equal(controls.update().brake, true);
  controls._onPointerUp({ pointerId: 3 });
  assert.equal(controls.update().brake, false);
  controls._onPointerDown({ pointerId: 4, clientX: 500, clientY: 250 });
  assert.equal(controls.pointers.has(4), false);
  controls.resetDrive();
  assert.equal(controls.input.touchDrive, false);
  assert.equal(controls.pointers.size, 0);
  controls.dispose();
});

test("typing in form fields or editable content does not trigger game keys", () => {
  const controls = new Controls(fakeCanvas());
  let prevented = false;
  for (const target of [
    { tagName: "input" },
    { tagName: "TEXTAREA" },
    { tagName: "SELECT" },
    { tagName: "DIV", isContentEditable: true },
  ]) {
    for (const code of ["KeyR", "KeyL", "Space", "ArrowUp"]) {
      controls._onKeyDown({
        code,
        target,
        preventDefault() {
          prevented = true;
        },
      });
    }
  }
  const input = controls.update();
  assert.equal(input.reverse, false);
  assert.equal(input.headlight, false);
  assert.equal(input.brake, false);
  assert.equal(input.leftPaddle, false);
  assert.equal(prevented, false);
  controls._onKeyDown({ code: "Space", preventDefault() {} });
  assert.equal(controls.update().brake, true);
  controls._onKeyUp({ code: "Space", target: { tagName: "INPUT" } });
  assert.equal(controls.update().brake, false);
  controls.dispose();
});


test("faster downward swipes produce stronger drive commands", () => {
  const controls = new Controls(fakeCanvas());
  const swipe=(id, duration)=>{
    controls._onPointerDown({pointerId:id,clientX:90,clientY:150});
    controls.pointers.get(id).strokeAt=performance.now()-duration;
    controls._onPointerMove({pointerId:id,clientX:90,clientY:230});
    const strength=controls.input.swipeStrength;
    controls._onPointerUp({pointerId:id});
    return strength;
  };
  const slow=swipe(1,700),fast=swipe(2,60);
  assert.ok(fast>slow+0.7);
  assert.ok(fast<=1 && slow>=0);
  controls.dispose();
});
