const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const radians = Math.PI / 180;
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function screenAngle() {
  const raw =
    globalThis.screen?.orientation?.angle ??
    globalThis.window?.orientation ??
    0;
  return (((Number(raw) || 0) % 360) + 360) % 360;
}

function gravityRoll(x, y, z) {
  if (![x, y, z].every(Number.isFinite) || Math.hypot(x, y, z) < 0.15)
    return null;
  const angle = screenAngle() * radians;
  const sx = x * Math.cos(angle) + y * Math.sin(angle);
  const sy = -x * Math.sin(angle) + y * Math.cos(angle);
  // A wheel is upright when gravity points toward the bottom of the screen.
  // Depth is irrelevant; an almost flat phone has no usable steering plane.
  if (Math.hypot(sx, sy) < 0.15) return null;
  return Math.atan2(-sx, sy);
}

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = {
      steer: 0,
      leftPaddle: false,
      rightPaddle: false,
      brake: false,
      reverse: false,
      headlight: false,
      swipeDirection: 0,
      touchDrive: false,
    };
    this.keys = new Set();
    this.buttons = new Map();
    this.pointers = new Map();
    this.gyro = 0;
    this._gyroBaseline = null;
    this.gyroEnabled = false;
    this.gyroStatus = "not-enabled";
    this._sensorListening = false;
    this._orientationListening = false;
    this._motionListening = false;
    this._gyroTimer = null;
    this._lastOrientationSample = -Infinity;
    this._sensorSource = null;
    this._headlightLatch = false;
    this._reverseLatch = false;
    this._swipePulse = 0;
    this._touchPulse = { leftPaddle: 0, rightPaddle: 0 };
    this._onKeyDown = (event) => {
      const target = event.target;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          target?.tagName?.toUpperCase?.(),
        )
      )
        return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          event.code,
        )
      )
        event.preventDefault();
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => this.keys.delete(event.code);
    this._onBlur = () => {
      this.keys.clear();
      this.pointers.clear();
      this.buttons.clear();
    };
    this._onPointerDown = (event) => {
      if (!this.canvas) return;
      const bounds = this.canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
      const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
      const side = x < 0.5 ? "leftPaddle" : "rightPaddle";
      if (x > 0.23 && x < 0.77) return;
      this.pointers.set(event.pointerId, {
        x, y, startX: x, startY: y, side,
        lastMoved: performance.now(),
      });
      try {
        (event.currentTarget || this.canvas).setPointerCapture?.(event.pointerId);
      } catch (error) {
        // A browser may retire a cancelled pointer before this handler runs.
        if (error.name !== "NotFoundError") throw error;
      }
      event.preventDefault?.();
    };
    this._onPointerMove = (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer || !this.canvas) return;
      const bounds = this.canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
      const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
      if (Math.hypot(x-pointer.x, y-pointer.y) > 0.004)
        pointer.lastMoved = performance.now();
      pointer.x = x;
      pointer.y = y;
      const delta = y - pointer.startY;
      if (Math.abs(delta) > 0.065) {
        this.input.swipeDirection = delta > 0 ? 1 : -1;
        this.input.touchDrive = true;
        this.input.reverse = delta < 0;
        this._swipePulse = 0.16;
        this._touchPulse[pointer.side] = 0.09;
        pointer.startY = y;
      }
      event.preventDefault?.();
    };
    this._onPointerUp = (event) => {
      this.pointers.delete(event.pointerId);
    };
    this._onOrientation = (event) => {
      if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      const beta = event.beta * radians;
      const gamma = event.gamma * radians;
      // Project gravity in device coordinates, avoiding Euler angle wrap at ±180°.
      const roll = gravityRoll(
        -Math.cos(beta) * Math.sin(gamma),
        Math.sin(beta),
        Math.cos(beta) * Math.cos(gamma),
      );
      if (roll === null) return;
      this._lastOrientationSample = performance.now();
      this._receiveRoll(roll, "orientation");
    };
    this._onMotion = (event) => {
      const gravity = event.accelerationIncludingGravity;
      if (!gravity) return;
      if (![gravity.x, gravity.y, gravity.z].every(Number.isFinite)) return;
      if (
        Math.hypot(gravity.x, gravity.y, gravity.z) < 3 ||
        Math.hypot(gravity.x, gravity.y, gravity.z) > 20
      )
        return;
      const roll = gravityRoll(gravity.x, gravity.y, gravity.z);
      if (roll === null) return;
      // Prefer orientation when both fire; motion remains a live fallback.
      if (performance.now() - this._lastOrientationSample < 500) return;
      this._receiveRoll(roll, "motion");
    };
    this._onScreenOrientationChange = () => this.recalibrate();
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._onKeyDown);
      window.addEventListener("keyup", this._onKeyUp);
      window.addEventListener("blur", this._onBlur);
    }
    if (canvas) {
      canvas.style.touchAction = "none";
      canvas.addEventListener("pointerdown", this._onPointerDown);
      canvas.addEventListener("pointermove", this._onPointerMove);
      canvas.addEventListener("pointerup", this._onPointerUp);
      canvas.addEventListener("pointercancel", this._onPointerUp);
    }
  }

  _setGyroStatus(status) {
    if (this.gyroStatus === status) return;
    this.gyroStatus = status;
    this.onGyroStatus?.(status);
  }

  _clearGyroTimer() {
    if (this._gyroTimer !== null) clearTimeout(this._gyroTimer);
    this._gyroTimer = null;
  }

  _stopGyroListeners() {
    this._clearGyroTimer();
    if (typeof window !== "undefined") {
      if (this._orientationListening)
        window.removeEventListener("deviceorientation", this._onOrientation);
      if (this._motionListening)
        window.removeEventListener("devicemotion", this._onMotion);
      window.removeEventListener(
        "orientationchange",
        this._onScreenOrientationChange,
      );
    }
    globalThis.screen?.orientation?.removeEventListener?.(
      "change",
      this._onScreenOrientationChange,
    );
    this._orientationListening = false;
    this._motionListening = false;
    this._sensorListening = false;
    this.gyroEnabled = false;
    this.gyro = 0;
  }

  _receiveRoll(roll, source) {
    if (!this._sensorListening) return;
    if (this._sensorSource !== source) {
      this._sensorSource = source;
      this._gyroBaseline = null;
    }
    if (this._gyroBaseline === null) this._gyroBaseline = roll;
    this.gyro = clamp(
      wrapAngle(roll - this._gyroBaseline) / (24 * radians),
      -1,
      1,
    );
    this.gyroEnabled = true;
    this._clearGyroTimer();
    this._setGyroStatus("enabled");
  }

  recalibrate() {
    this._gyroBaseline = null;
    this._lastOrientationSample = -Infinity;
    this._sensorSource = null;
    this.gyro = 0;
    this.gyroEnabled = false;
    if (!this._sensorListening) return false;
    this._setGyroStatus("waiting");
    this._clearGyroTimer();
    this._gyroTimer = setTimeout(() => {
      if (this.gyroStatus === "waiting") {
        this._stopGyroListeners();
        this._setGyroStatus("no-data");
      }
    }, 2500);
    this._gyroTimer.unref?.();
    return true;
  }

  async enableGyro() {
    if (
      typeof window === "undefined" ||
      (!window.DeviceOrientationEvent && !window.DeviceMotionEvent)
    ) {
      this._setGyroStatus("unsupported");
      return false;
    }
    if (window.isSecureContext === false) {
      this._setGyroStatus("insecure");
      return false;
    }
    if (this._sensorListening) return true;
    this._setGyroStatus("requesting");
    const requests = [];
    // Invoke both APIs before awaiting either: iOS requires transient activation.
    for (const [kind, api] of [
      ["orientation", window.DeviceOrientationEvent],
      ["motion", window.DeviceMotionEvent],
    ]) {
      if (!api) continue;
      try {
        const result =
          typeof api.requestPermission === "function"
            ? api.requestPermission()
            : "granted";
        requests.push({ kind, promise: Promise.resolve(result) });
      } catch (error) {
        requests.push({ kind, promise: Promise.reject(error) });
      }
    }
    const results = await Promise.allSettled(
      requests.map((request) => request.promise),
    );
    const granted = new Set(
      results.flatMap((result, index) =>
        result.status === "fulfilled" && result.value === "granted"
          ? [requests[index].kind]
          : [],
      ),
    );
    if (!granted.size) {
      const denied =
        results.some(
          (result) =>
            result.status === "fulfilled" && result.value === "denied",
        ) ||
        results.some(
          (result) =>
            result.status === "rejected" &&
            result.reason?.name === "NotAllowedError",
        );
      this._setGyroStatus(denied ? "denied" : "blocked");
      return false;
    }
    if (granted.has("orientation")) {
      window.addEventListener("deviceorientation", this._onOrientation);
      this._orientationListening = true;
    }
    if (granted.has("motion")) {
      window.addEventListener("devicemotion", this._onMotion);
      this._motionListening = true;
    }
    window.addEventListener(
      "orientationchange",
      this._onScreenOrientationChange,
    );
    globalThis.screen?.orientation?.addEventListener?.(
      "change",
      this._onScreenOrientationChange,
    );
    this._sensorListening = true;
    this.recalibrate();
    return true;
  }

  // Lets HTML controls feed the same input object without duplicating listeners.
  setButton(name, pressed) {
    if (pressed) this.buttons.set(name, true);
    else this.buttons.delete(name);
  }

  update(dt = 1 / 60) {
    const has = (code) => this.keys.has(code);
    const button = (name) => this.buttons.has(name);
    let steer =
      Number(has("ArrowRight") || has("KeyD") || button("right")) -
      Number(has("ArrowLeft") || has("KeyA") || button("left"));
    if (this.gyroEnabled && !steer) steer = this.gyro;
    this.input.steer = clamp(steer, -1, 1);
    this.input.leftPaddle =
      has("ArrowUp") ||
      has("KeyW") ||
      button("leftPaddle") ||
      this._touchPulse.leftPaddle > 0;
    this.input.rightPaddle =
      has("ArrowDown") ||
      has("KeyS") ||
      button("rightPaddle") ||
      this._touchPulse.rightPaddle > 0;
    const paused = [...this.pointers.values()].filter(
      pointer => performance.now() - pointer.lastMoved >= 280,
    );
    const pointerBrake = paused.some(p => p.side === "leftPaddle") &&
      paused.some(p => p.side === "rightPaddle");
    this.input.brake = has("Space") || button("brake") || pointerBrake;
    const reverseKey = has("KeyR") || button("reverse");
    if (reverseKey && !this._reverseLatch)
      this.input.reverse = !this.input.reverse;
    this._reverseLatch = reverseKey;
    const lightKey = has("KeyL") || button("headlight");
    if (lightKey && !this._headlightLatch)
      this.input.headlight = !this.input.headlight;
    this._headlightLatch = lightKey;
    const elapsed = Number.isFinite(dt) && dt > 0 ? dt : 1 / 60;
    this._swipePulse = Math.max(0, this._swipePulse - elapsed);
    if (this._swipePulse === 0) this.input.swipeDirection = 0;
    this._touchPulse.leftPaddle = Math.max(
      0,
      this._touchPulse.leftPaddle - elapsed,
    );
    this._touchPulse.rightPaddle = Math.max(
      0,
      this._touchPulse.rightPaddle - elapsed,
    );
    return this.input;
  }

  resetDrive() {
    this.pointers.clear();
    this._swipePulse = 0;
    this._touchPulse = { leftPaddle: 0, rightPaddle: 0 };
    this.input.swipeDirection = 0;
    this.input.touchDrive = false;
    this.input.reverse = false;
    this.input.brake = false;
  }

  dispose() {
    this._stopGyroListeners();
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._onKeyDown);
      window.removeEventListener("keyup", this._onKeyUp);
      window.removeEventListener("blur", this._onBlur);
    }
    this.canvas?.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas?.removeEventListener("pointermove", this._onPointerMove);
    this.canvas?.removeEventListener("pointerup", this._onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this._onPointerUp);
  }
}
