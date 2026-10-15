import test from "node:test";
import assert from "node:assert/strict";
import { AI_DRIVERS, aiInput } from "./ai.js";
import { createRacer, disposeRacer, stepRacer } from "./physics.js";
import { roadAt, surfaceAt } from "./scene.js";
import { VEHICLES } from "./vehicles.js";

const road = () => ({ width: 9 });
const dry = () => "road";
const racer = (overrides = {}) => ({
  s: 100,
  lateral: 0,
  speed: 20,
  steer: 0,
  index: 0,
  stats: { topSpeed: 40 },
  ...overrides,
});

test("five named drivers provide the full control interface", () => {
  assert.deepEqual(
    AI_DRIVERS.map((driver) => driver.name),
    ["Barnaby", "Clementine", "Buster", "Maeve", "Ace"],
  );
  for (const profile of AI_DRIVERS) {
    const input = aiInput(profile, racer(), [], 0, road, dry);
    assert.deepEqual(Object.keys(input).sort(), [
      "brake",
      "draft",
      "headlight",
      "leftPaddle",
      "reverse",
      "rightPaddle",
      "steer",
    ]);
    assert.ok(input.steer >= -1 && input.steer <= 1);
  }
});

test("a future muddy lane sends a racer toward the clean side", () => {
  const surface = (s, lateral) => (s > 104 && lateral <= 0 ? "mud" : "road");
  const input = aiInput(AI_DRIVERS[1], racer(), [], 0, road, surface);
  assert.ok(input.steer > 0, `expected right steering, got ${input.steer}`);
});

test("paddle strokes alternate and release between impulses", () => {
  const first = aiInput(AI_DRIVERS[4], racer(), [], 0, road, dry);
  const release = aiInput(AI_DRIVERS[4], racer(), [], 0.15, road, dry);
  const second = aiInput(AI_DRIVERS[4], racer(), [], 0.31, road, dry);
  assert.equal(first.leftPaddle, true);
  assert.equal(release.leftPaddle || release.rightPaddle, false);
  assert.equal(second.rightPaddle, true);
});

test("Barnaby wanders, forgets a stroke, and brakes late", () => {
  const barnaby = AI_DRIVERS[0];
  const muddy = () => "mud";
  assert.notEqual(
    aiInput(barnaby, racer(), [], 0.6, road, dry).steer,
    aiInput(AI_DRIVERS[3], racer(), [], 0.6, road, dry).steer,
  );
  assert.equal(
    aiInput(barnaby, racer({ speed: 10 }), [], 0.86, road, dry).leftPaddle,
    false,
  );
  assert.equal(
    aiInput(barnaby, racer({ speed: 20 }), [], 0, road, muddy).brake,
    false,
  );
  assert.equal(
    aiInput(barnaby, racer({ speed: 30 }), [], 0, road, muddy).brake,
    true,
  );
});

test("Clementine brakes early while Buster charges through hazards", () => {
  const mixed = (s) => (s > 105 ? "grass" : "road");
  const clean = aiInput(
    AI_DRIVERS[1],
    racer({ speed: 30 }),
    [],
    0.6,
    road,
    mixed,
  );
  assert.equal(clean.brake, true);
  assert.equal(
    aiInput(AI_DRIVERS[2], racer({ speed: 30 }), [], 0.6, road, () => "mud")
      .brake,
    false,
  );
  assert.ok(AI_DRIVERS[1].pace < AI_DRIVERS[2].pace);
});

test("Maeve and Ace choose dry lanes", () => {
  const wetLeft = (s, lateral) => (s > 105 && lateral < 0 ? "mud" : "road");
  assert.ok(
    aiInput(AI_DRIVERS[3], racer({ lateral: -1 }), [], 0, road, wetLeft).steer >
      0,
  );
  assert.ok(
    aiInput(AI_DRIVERS[4], racer({ lateral: -1 }), [], 0, road, wetLeft).steer >
      0,
  );
});

test("Ace gets the strongest draft from a nearby car ahead", () => {
  const follower = racer();
  const pack = [follower, racer({ s: 110, lateral: 0 })];
  assert.equal(aiInput(AI_DRIVERS[4], follower, pack, 1, road, dry).draft, 1);
  assert.ok(aiInput(AI_DRIVERS[3], follower, pack, 1, road, dry).draft < 1);
  assert.equal(
    aiInput(AI_DRIVERS[4], follower, [follower], 1, road, dry).draft,
    0,
  );
});

test("all five rivals finish the real course within fifteen simulated minutes", () => {
  const racers = AI_DRIVERS.map((_, index) =>
    // Hold the chassis constant so this checks driver personalities rather
    // than depending on which cars happen to occupy the first garage slots.
    createRacer(VEHICLES[4], index + 1),
  );
  const player = createRacer(VEHICLES[5], 0);
  const pack = [player, ...racers];
  const dt = 0.1;
  const maxSteps = 900 / dt;
  let overtakes = 0;
  let previousOrder = racers.map((r) => r.index);
  try {
    for (
      let step = 0;
      step < maxSteps && racers.some((r) => !r.finished);
      step++
    ) {
      const time = step * dt;
      stepRacer(
        player,
        aiInput(AI_DRIVERS[4], player, pack, time, roadAt, surfaceAt),
        dt,
        roadAt,
        surfaceAt,
      );
      for (let i = 0; i < racers.length; i++) {
        const rival = racers[i];
        stepRacer(
          rival,
          aiInput(AI_DRIVERS[i], rival, pack, time, roadAt, surfaceAt),
          dt,
          roadAt,
          surfaceAt,
        );
      }
      if (step % 50 === 0) {
        const order = [...racers].sort((a, b) => b.s - a.s).map((r) => r.index);
        if (order.some((id, rank) => id !== previousOrder[rank])) overtakes++;
        previousOrder = order;
      }
    }
    assert.ok(
      racers.every((r) => r.finished),
      racers
        .map((r, i) => `${AI_DRIVERS[i].name}: ${r.s.toFixed(1)}m`)
        .join(", "),
    );
    assert.ok(player.finished, "sixth racer should finish too");
    assert.ok(racers.every((r) => r.finishTime <= 900));
    assert.ok(overtakes > 0, "rivals should exchange positions during the run");
    assert.ok(
      new Set(racers.map((r) => Math.round(r.finishTime))).size >= 4,
      "profiles should produce meaningfully different finish times",
    );
  } finally {
    racers.forEach(disposeRacer);
    disposeRacer(player);
  }
});
