import test from "node:test";
import assert from "node:assert/strict";
import {
  createRacer,
  stepRacer,
  resetRacer,
  disposeRacer,
  resolveRacerContacts,
  COURSE_LENGTH,
} from "./physics.js";

const roadAt = (s) => ({ x: 0, y: -s * 0.065, z: -s, width: 8 });
const run = (racer, input, seconds, surfaceAt) => {
  for (let i = 0; i < seconds * 60; i++)
    stepRacer(racer, input, 1 / 60, roadAt, surfaceAt);
};

test("slope causes passive downhill motion and model faces down the course", () => {
  const racer = createRacer();
  run(racer, {}, 5);
  assert.ok(racer.s > 2);
  assert.ok(racer.position.z < 0);
  assert.ok(Math.abs(racer.quaternion.y) < 0.01);
});

test("braking loses speed and a fresh paddle stroke accelerates", () => {
  const racer = createRacer();
  run(racer, {}, 8);
  const cruising = racer.speed;
  run(racer, { brake: true }, 0.5);
  assert.ok(racer.speed < cruising);
  stepRacer(racer, { leftPaddle: true }, 1 / 60, roadAt);
  assert.ok(racer.speed > 1);
});

test("guardrails bound steering and scrub speed", () => {
  const racer = createRacer();
  racer.speed = 20;
  run(racer, { steer: 1 }, 2);
  assert.ok(racer.lateral <= 3.35 + 1e-9);
  assert.ok(racer.speed < 20);
});

test("hazard terrain slows the racer", () => {
  const normal = createRacer();
  const muddy = createRacer();
  normal.speed = muddy.speed = 12;
  run(normal, {}, 4);
  run(muddy, {}, 4, () => ({ type: "mud", drag: 1.2, grip: 0.4, bump: 0.1 }));
  assert.ok(muddy.s < normal.s);
});

test("finish clamps at course length and records time once", () => {
  const racer = createRacer();
  racer.s = COURSE_LENGTH - 1;
  racer.speed = 20;
  stepRacer(racer, {}, 1 / 10, roadAt);
  assert.equal(racer.s, COURSE_LENGTH);
  assert.equal(racer.finished, true);
  const finishTime = racer.finishTime;
  stepRacer(racer, {}, 1, roadAt);
  assert.equal(racer.finishTime, finishTime);
});

test("Cannon suspension contacts the sampled road and releases on reset", () => {
  const racer = createRacer();
  run(racer, {}, 1, () => ({ bump: 0.2 }));
  assert.ok(racer._suspension.world.bodies.length === 2);
  assert.ok(
    racer._suspension.chassis.position.y >= racer._suspension.groundY + 0.17,
  );
  resetRacer(racer);
  assert.equal(racer._suspension, null);
  assert.equal(racer.s, 0);
  run(racer, {}, 0.1);
  disposeRacer(racer);
  assert.equal(racer._suspension, null);
});

test("racer drag and grip stats affect distance and steering", () => {
  const normal = createRacer({ drag: 1, grip: 1 });
  const heavy = createRacer({ drag: 2, grip: 0.5 });
  normal.speed = heavy.speed = 18;
  run(normal, { steer: 1 }, 0.5);
  run(heavy, { steer: 1 }, 0.5);
  assert.ok(heavy.s < normal.s);
  assert.ok(heavy.lateral < normal.lateral);
});

test("contact pass separates overlapping racers within road bounds", () => {
  const racers = Array.from({ length: 6 }, (_, index) =>
    createRacer({}, index),
  );
  racers.forEach((racer) => {
    racer.s = 100;
    racer.lateral = 0;
    stepRacer(racer, {}, 1 / 60, roadAt);
  });
  resolveRacerContacts(racers, 1 / 60);
  for (let i = 0; i < racers.length; i++) {
    assert.ok(Math.abs(racers[i].lateral) <= racers[i]._lateralLimit);
    for (let j = i + 1; j < racers.length; j++) {
      const sGap = Math.abs(racers[i].s - racers[j].s);
      const lGap = Math.abs(racers[i].lateral - racers[j].lateral);
      assert.ok(sGap >= 2.899 || lGap >= 1.499, `${i} and ${j} still overlap`);
    }
  }
});

test("rear impact transfers longitudinal momentum by mass", () => {
  const rear = createRacer({ mass: 100 });
  const front = createRacer({ mass: 100 });
  rear.s = 99;
  front.s = 101;
  rear.speed = 12;
  front.speed = 4;
  rear.lateral = front.lateral = 0;
  const before = rear.speed * 100 + front.speed * 100;
  resolveRacerContacts([rear, front], 1 / 60);
  assert.ok(rear.speed < 12);
  assert.ok(front.speed > 4);
  assert.ok(Math.abs((rear.speed + front.speed) * 100 - before) < 1e-8);
});

test("right steering points the car toward positive road lateral", () => {
  const racer = createRacer();
  racer.speed = 20;
  stepRacer(racer, { steer: 1 }, 0.1, roadAt);
  const { x, y, z, w } = racer.quaternion;
  const forwardX = -2 * (x * z + y * w);
  assert.ok(forwardX > 0);
  assert.ok(racer.lateral > -0.675);
});

test("reverse gear only reverses paddle force, never supplies uphill motor force", () => {
  const coasting = createRacer();
  run(coasting, { reverse: true }, 2);
  assert.ok(coasting.speed > 0);
  const paddling = createRacer();
  stepRacer(paddling, { reverse: true, leftPaddle: true }, 1 / 60, roadAt);
  assert.ok(paddling.speed < 0);
});


test("one touch stroke banks ten seconds then eases to a downhill coast", () => {
  const racer = createRacer({}, 0);
  racer.s = 100;
  const road = s => ({ x:0, y:-s*0.06, z:-s, width:8 });
  const surface = () => ({ drag:0.13, grip:1 });
  stepRacer(racer, { touchDrive:true, swipeDirection:1 }, 1/60, road, surface);
  for (let i=0;i<9*60;i++) stepRacer(racer, { touchDrive:true }, 1/60, road, surface);
  assert.ok(racer.speed > 12, `sustained speed ${racer.speed}`);
  assert.ok(racer._boostTime > 0.8 && racer._boostTime < 1.1);
  for (let i=0;i<25*60;i++) stepRacer(racer, { touchDrive:true }, 1/60, road, surface);
  assert.ok(racer.speed > 1 && racer.speed < 5, `coast speed ${racer.speed}`);
});

test("upward touch slows before reversing slowly; handbrake holds and cancels boost", () => {
  const racer = createRacer({}, 0);
  racer.s = 200;
  racer.speed = 14;
  const road = s => ({ x:0, y:-s*0.06, z:-s, width:8 });
  const surface = () => ({ drag:0.13, grip:1 });
  stepRacer(racer, { touchDrive:true, swipeDirection:-1 }, 1/60, road, surface);
  assert.ok(racer.speed > 0 && racer.speed < 14);
  for (let i=0;i<7*60;i++) stepRacer(racer, { touchDrive:true }, 1/60, road, surface);
  assert.ok(racer.speed < -0.5 && racer.speed > -2, `reverse speed ${racer.speed}`);
  for (let i=0;i<2*60;i++) stepRacer(racer, { touchDrive:true, brake:true }, 1/60, road, surface);
  assert.equal(racer.speed, 0);
  assert.equal(racer._boostTime, 0);
  for (let i=0;i<4*60;i++) stepRacer(racer, { touchDrive:true }, 1/60, road, surface);
  assert.ok(racer.speed > 0 && racer.speed < 5);
});


test("fast swipes accelerate harder and sustain higher speed than gentle swipes", () => {
  const road=s=>({x:0,y:-s*0.06,z:-s,width:8});
  const surface=()=>({drag:0.13,grip:1});
  const racers=[createRacer(),createRacer()];
  for(const [i,r] of racers.entries()) {
    r.s=100;
    stepRacer(r,{touchDrive:true,swipeDirection:1,swipeStrength:i},1/60,road,surface);
    for(let n=0;n<60;n++)stepRacer(r,{touchDrive:true},1/60,road,surface);
  }
  assert.ok(racers[1].speed>racers[0].speed+3);
  for(const r of racers)for(let n=0;n<7*60;n++)stepRacer(r,{touchDrive:true},1/60,road,surface);
  assert.ok(racers[1].speed>racers[0].speed+7);
  assert.ok(racers.every(r=>r._boostTime>1));
});
