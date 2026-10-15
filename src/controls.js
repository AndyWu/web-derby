const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
    };
    this.keys = new Set();
    this.buttons = new Map();
    this.pointers = new Map();
    this.gyro = 0;
    this._gyroBaseline = null;
    this.gyroEnabled = false;
    this._headlightLatch = false;
    this._reverseLatch = false;
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
      const zone = y > 0.81 ? (x < 0.5 ? "brake" : "gear") : "drive";
      this.pointers.set(event.pointerId, {
        x,
        y,
        startX: x,
        startY: y,
        side,
        zone,
        started: performance.now(),
      });
      this.canvas.setPointerCapture?.(event.pointerId);
    };
    this._onPointerMove = (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer || !this.canvas) return;
      const bounds = this.canvas.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
      pointer.y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
      if (pointer.zone === "drive" && pointer.startY - pointer.y > 0.075) {
        this._touchPulse[pointer.side] = 0.09;
        pointer.startY = pointer.y;
      }
    };
    this._onPointerUp = (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;
      if (pointer.zone === "gear") {
        if (performance.now() - pointer.started >= 450) {
          if (!pointer.gearToggled) this.input.reverse = !this.input.reverse;
        } else {
          this.input.headlight = !this.input.headlight;
        }
      }
      this.pointers.delete(event.pointerId);
    };
    this._onOrientation = (event) => {
      const angle = Number(
        (typeof screen !== "undefined"
          ? screen.orientation?.angle
          : undefined) ??
          window.orientation ??
          0,
      );
      const tilt = Math.abs(angle) === 90 ? event.beta : event.gamma;
      if (!Number.isFinite(tilt)) return;
      const signedTilt = angle === 90 ? -tilt : tilt;
      if (this._gyroBaseline === null) this._gyroBaseline = signedTilt;
      this.gyro = clamp((signedTilt - this._gyroBaseline) / 24, -1, 1);
    };
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

  async enableGyro() {
    if (typeof window === "undefined" || !window.DeviceOrientationEvent)
      return false;
    try {
      const orientation = window.DeviceOrientationEvent;
      if (typeof orientation.requestPermission === "function") {
        const permission = await orientation.requestPermission();
        if (permission !== "granted") return false;
      }
      if (!this.gyroEnabled)
        window.addEventListener("deviceorientation", this._onOrientation);
      this._gyroBaseline = null;
      this.gyroEnabled = true;
      return true;
    } catch {
      return false;
    }
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
    for (const pointer of this.pointers.values()) {
      if (pointer.zone === "drive")
        steer += clamp((pointer.x - pointer.startX) * 3, -1, 1);
    }
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
    const pointerBrake = [...this.pointers.values()].some(
      (pointer) => pointer.zone === "brake",
    );
    for (const pointer of this.pointers.values()) {
      if (
        pointer.zone === "gear" &&
        !pointer.gearToggled &&
        performance.now() - pointer.started >= 450
      ) {
        this.input.reverse = !this.input.reverse;
        pointer.gearToggled = true;
      }
    }
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

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._onKeyDown);
      window.removeEventListener("keyup", this._onKeyUp);
      window.removeEventListener("blur", this._onBlur);
      window.removeEventListener("deviceorientation", this._onOrientation);
    }
    this.canvas?.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas?.removeEventListener("pointermove", this._onPointerMove);
    this.canvas?.removeEventListener("pointerup", this._onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this._onPointerUp);
  }
}
