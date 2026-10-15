// Buffer authoritative road-space snapshots. Hermite uses longitudinal speed
// as the derivative; rendering stays one snapshot interval behind the host.
export class SnapshotBuffer {
  constructor(delay = 0.1) {
    this.delay = delay;
    this.frames = [];
  }
  push(states, time) {
    this.frames.push({ states, time });
    if (this.frames.length > 20) this.frames.shift();
  }
  sample(time) {
    if (!this.frames.length) return null;
    const t = time - this.delay;
    let a = this.frames[0],
      b = a;
    for (const frame of this.frames) {
      if (frame.time <= t) a = frame;
      if (frame.time >= t) {
        b = frame;
        break;
      }
      b = frame;
    }
    if (a === b) return a.states.map((s) => s.slice());
    const duration = b.time - a.time,
      u = Math.max(0, Math.min(1, (t - a.time) / duration));
    const h00 = 2 * u * u * u - 3 * u * u + 1,
      h10 = u * u * u - 2 * u * u + u,
      h01 = -2 * u * u * u + 3 * u * u,
      h11 = u * u * u - u * u;
    return a.states.map((state, i) => {
      const other = b.states[i] || state;
      return [
        h00 * state[0] +
          h10 * duration * state[2] +
          h01 * other[0] +
          h11 * duration * other[2],
        state[1] + (other[1] - state[1]) * u,
        state[2] + (other[2] - state[2]) * u,
        state[3] + (other[3] - state[3]) * u,
      ];
    });
  }
  clear() {
    this.frames = [];
  }
}
