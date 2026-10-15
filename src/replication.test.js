import test from "node:test";
import assert from "node:assert/strict";
import { SnapshotBuffer } from "./replication.js";
test("Hermite interpolation preserves constant velocity and endpoints", () => {
  const b = new SnapshotBuffer(0);
  b.push([[0, 0, 10, 0]], 0);
  b.push([[10, 2, 10, 1]], 1);
  assert.deepEqual(b.sample(0.5)[0], [5, 1, 10, 0.5]);
  assert.equal(b.sample(1)[0][0], 10);
});
test("buffer bounds history and holds latest state during interruption", () => {
  const b = new SnapshotBuffer(0);
  for (let i = 0; i < 25; i++) b.push([[i, 0, 0, 0]], i);
  assert.equal(b.frames.length, 20);
  assert.equal(b.sample(40)[0][0], 24);
  b.clear();
  assert.equal(b.sample(41), null);
});
