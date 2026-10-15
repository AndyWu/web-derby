import assert from "node:assert/strict";
import test from "node:test";
import { COURSE_LENGTH, roadAt } from "./scene.js";

test("road heading follows the rendered centreline throughout the descent", () => {
  let turns = 0;
  let previousDirection = 0;
  for (let s = 2; s < COURSE_LENGTH - 2; s += 2) {
    const before = roadAt(s - 0.01);
    const after = roadAt(s + 0.01);
    const derivative = (after.x - before.x) / 0.02;
    const road = roadAt(s);
    assert.ok(Math.abs(road.heading - Math.atan2(derivative, -1)) < 1e-5);
    assert.equal(road.y, -s * 0.065);
    assert.equal(road.width, 9.2);
    const direction = Math.sign(derivative);
    if (previousDirection && direction !== previousDirection) turns++;
    previousDirection = direction;
  }
  assert.ok(turns >= 14, `expected repeated S bends, found ${turns} direction changes`);
});
