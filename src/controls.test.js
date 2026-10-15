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
    assert.equal(controls.gyroStatus, "enabled");
  } finally {
    controls.dispose();
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
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

test("lower right tap toggles light; long hold toggles gear once", () => {
  const controls = new Controls(fakeCanvas());
  controls._onPointerDown({ pointerId: 1, clientX: 900, clientY: 450 });
  controls._onPointerUp({ pointerId: 1 });
  assert.equal(controls.input.headlight, true);
  assert.equal(controls.input.reverse, false);
  controls._onPointerDown({ pointerId: 2, clientX: 900, clientY: 450 });
  controls.pointers.get(2).started -= 500;
  assert.equal(controls.update().reverse, true);
  assert.equal(controls.update().reverse, true);
  controls._onPointerUp({ pointerId: 2 });
  assert.equal(controls.input.reverse, true);
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
