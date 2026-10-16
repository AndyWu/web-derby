// Procedural, asset-free sound for the downhill cart. Call start() from a user gesture.
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function noiseBuffer(context, seconds = 2) {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < samples.length; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.16) * 0.985;
    samples[i] = (Math.random() * 2 - 1) * 0.72 + last * 0.28;
  }
  return buffer;
}

function texture(context, buffer, filterType, frequency, q = 0.7) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain);
  source.start();
  return { source, filter, gain };
}

export class DerbyAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.layers = null;
    this.muted = false;
    this.disposed = false;
    this.elapsed = 0;
    this.nextBird = 4;
    this.nextCreak = 2;
    this.birdSide = 1;
    this.racing = false;
  }

  async start() {
    if (this.disposed) return false;
    if (!this.context) {
      const AudioContext =
        globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = this.muted ? 0 : 0.65;
        master.connect(context.destination);
        const buffer = noiseBuffer(context);
        const wind = texture(context, buffer, "lowpass", 850);
        const tire = texture(context, buffer, "bandpass", 530, 0.55);
        const gravel = texture(context, buffer, "highpass", 1450);
        const mud = texture(context, buffer, "lowpass", 180);
        const brake = texture(context, buffer, "bandpass", 1700, 2.2);
        for (const layer of [wind, tire, gravel, mud, brake])
          layer.gain.connect(master);
        this.context = context;
        this.master = master;
        this.layers = { wind, tire, gravel, mud, brake };
      } catch {
        return false;
      }
    }
    try {
      await this.context.resume();
      return this.context.state === "running";
    } catch {
      return false;
    }
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.65,
        this.context.currentTime,
        0.035,
      );
    }
  }

  // Three struck metal notes cue the release of the physical starting gate.
  startRace() {
    this.racing = true;
    this.elapsed = 0;
    this.nextBird = 4;
    this.nextCreak = 1.5;
    if (!this.context || this.context.state !== "running") return;
    const t = this.context.currentTime;
    this.strike(660, t, 0.18, 0.16);
    this.strike(660, t + 0.29, 0.18, 0.16);
    this.strike(880, t + 0.58, 0.43, 0.25);
  }

  async honk() {
    await this.start();
    const c = this.context;
    if (!c || this.disposed || c.state !== "running") return;
    const t=c.currentTime;
    if (t < (this.hornUntil ?? 0)) return;
    this.hornUntil=t+.3;
    const gain=c.createGain(), filter=c.createBiquadFilter();
    filter.type="lowpass";filter.frequency.value=1800;
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.16,t+.025);
    gain.gain.setValueAtTime(.16,t+.20);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.34);
    filter.connect(gain);gain.connect(this.master);
    let ended=0;
    for (const frequency of [330,415]) {
      const tone=c.createOscillator();tone.type="sawtooth";
      tone.frequency.setValueAtTime(frequency*1.06,t);
      tone.frequency.exponentialRampToValueAtTime(frequency,t+.08);
      tone.connect(filter);tone.start(t);tone.stop(t+.36);
      tone.onended=()=>{tone.disconnect();if(++ended===2){filter.disconnect();gain.disconnect();}};
    }
  }

  suspendRace() {
    this.racing = false;
    if (!this.context || !this.layers) return;
    const now = this.context.currentTime;
    for (const layer of Object.values(this.layers))
      layer.gain.gain.setTargetAtTime(0, now, 0.06);
  }

  strike(frequency, at, duration, volume) {
    const c = this.context;
    if (!c || this.disposed) return;
    const tone = c.createOscillator();
    const overtone = c.createOscillator();
    const gain = c.createGain();
    tone.type = "sine";
    overtone.type = "sine";
    tone.frequency.value = frequency;
    overtone.frequency.value = frequency * 2.71;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    tone.connect(gain);
    const overtoneGain = c.createGain();
    overtoneGain.gain.value = 0.16;
    overtone.connect(overtoneGain).connect(gain);
    gain.connect(this.master);
    tone.start(at);
    overtone.start(at);
    tone.stop(at + duration + 0.01);
    overtone.stop(at + duration + 0.01);
    tone.onended = () => {
      tone.disconnect();
      overtone.disconnect();
      overtoneGain.disconnect();
      gain.disconnect();
    };
  }

  // A short wood-and-metal knock confirms a left or right kick stroke.
  stroke(side = 0) {
    this.impact("stroke", 0.65, side);
  }

  impact(type = "wood", strength = 1, side = 0) {
    const c = this.context;
    if (!c || this.disposed || c.state !== "running") return;
    const t = c.currentTime;
    const amount = clamp(Number(strength) || 0);
    if (amount <= 0) return;
    const oscillator = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    const pan = c.createStereoPanner?.();
    const metal = type === "metal" || type === "barrier";
    const stroke = type === "stroke";
    oscillator.type = metal ? "triangle" : "sawtooth";
    const base = metal ? 340 : stroke ? 165 : 105;
    oscillator.frequency.setValueAtTime(base + amount * 65, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      base * 0.45,
      t + (metal ? 0.22 : 0.13),
    );
    filter.type = "lowpass";
    filter.frequency.value = metal ? 2100 : stroke ? 750 : 460;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(
      (metal ? 0.15 : 0.11) * amount,
      t + 0.007,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (metal ? 0.23 : 0.14));
    oscillator.connect(filter).connect(gain);
    if (pan) {
      pan.pan.value = clamp(Number(side) || 0, -1, 1) * 0.65;
      gain.connect(pan).connect(this.master);
    } else gain.connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + (metal ? 0.24 : 0.15));
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan?.disconnect();
    };
  }

  update(speed = 0, surface = "asphalt", brake = false, dt = 0) {
    if (!this.context || this.disposed || this.context.state !== "running")
      return;
    if (!this.racing) return;
    const now = this.context.currentTime;
    const v = clamp(Math.abs(Number(speed) || 0) / 42);
    const kind =
      typeof surface === "string"
        ? surface
        : (surface?.type ?? surface?.name ?? "asphalt");
    const loose = kind === "gravel" || kind === "dirt";
    const soft = kind === "mud" || kind === "grass" || kind === "field";
    const { wind, tire, gravel, mud, brake: braking } = this.layers;
    wind.gain.gain.setTargetAtTime(0.012 + v * v * 0.24, now, 0.15);
    wind.filter.frequency.setTargetAtTime(450 + v * 1800, now, 0.2);
    tire.gain.gain.setTargetAtTime(
      v * (soft ? 0.025 : loose ? 0.065 : 0.09),
      now,
      0.06,
    );
    tire.filter.frequency.setTargetAtTime(270 + v * 750, now, 0.12);
    gravel.gain.gain.setTargetAtTime(
      loose ? v * 0.23 : soft ? v * 0.06 : 0,
      now,
      0.07,
    );
    mud.gain.gain.setTargetAtTime(
      soft ? v * (kind === "mud" ? 0.22 : 0.14) : 0,
      now,
      0.1,
    );
    braking.gain.gain.setTargetAtTime(
      brake && v > 0.08 ? v * (loose ? 0.11 : 0.18) : 0,
      now,
      0.045,
    );
    braking.filter.frequency.setTargetAtTime(950 + v * 1550, now, 0.1);

    const step = clamp(Number(dt) || 0, 0, 0.25);
    this.elapsed += step;
    if (this.elapsed >= this.nextBird) {
      this.chirp(this.birdSide);
      this.birdSide *= -1;
      this.nextBird = this.elapsed + 5 + Math.random() * 7;
    }
    if (v > 0.1 && this.elapsed >= this.nextCreak) {
      this.creak(v);
      this.nextCreak = this.elapsed + 1.2 + Math.random() * (3.5 - v);
    }
  }

  chirp(side) {
    const c = this.context;
    if (!c || this.disposed) return;
    const t = c.currentTime;
    const oscillator = c.createOscillator();
    const gain = c.createGain();
    const pan = c.createStereoPanner?.();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(2050 + Math.random() * 500, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      3000 + Math.random() * 450,
      t + 0.085,
    );
    oscillator.frequency.exponentialRampToValueAtTime(1900, t + 0.22);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.018, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    oscillator.connect(gain);
    if (pan) {
      pan.pan.value = side * (0.55 + Math.random() * 0.3);
      gain.connect(pan).connect(this.master);
    } else gain.connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + 0.25);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      pan?.disconnect();
    };
  }

  creak(speed) {
    const c = this.context;
    if (!c || this.disposed) return;
    const t = c.currentTime;
    const oscillator = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(115 + Math.random() * 40, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      67 + Math.random() * 20,
      t + 0.23,
    );
    filter.type = "lowpass";
    filter.frequency.value = 460;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.009 + speed * 0.013, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + 0.29);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const layer of Object.values(this.layers ?? {})) {
      try {
        layer.source.stop();
      } catch {
        /* source may already be stopped */
      }
      layer.source.disconnect();
      layer.filter.disconnect();
      layer.gain.disconnect();
    }
    this.master?.disconnect();
    this.context?.close().catch(() => {});
    this.layers = null;
    this.master = null;
    this.context = null;
  }
}
