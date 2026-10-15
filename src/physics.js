import * as CANNON from "cannon-es";

// Hybrid physics: deterministic progress along the road, Cannon contact and
// spring suspension vertically. World units are metres;
// the track runs from s=0 to s=3218, with lateral metres measured from its centre.
export const COURSE_LENGTH = 3218;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

function sampleRoad(roadAt, s) {
  const road = roadAt?.(clamp(s, 0, COURSE_LENGTH)) ?? {};
  const point = road.position ?? road.center ?? road;
  const tangent = road.tangent ?? road.direction ?? {};
  return {
    x: finite(point.x, 0),
    y: finite(point.y, finite(road.height, 0)),
    z: finite(point.z, s),
    tx: Number.isFinite(tangent.x) ? tangent.x : null,
    tz: Number.isFinite(tangent.z) ? tangent.z : null,
    width: Math.max(2, finite(road.width, finite(road.halfWidth, 4) * 2)),
    bank: finite(road.bank, 0),
    yaw: Number.isFinite(road.heading)
      ? road.heading
      : Number.isFinite(road.yaw)
        ? road.yaw
        : null,
  };
}

function surfaceProperties(surfaceAt, s, lateral) {
  const raw = surfaceAt?.(s, lateral);
  const name =
    typeof raw === "string" ? raw : (raw?.type ?? raw?.name ?? "road");
  const defaults =
    name === "mud"
      ? { drag: 0.7, grip: 0.52 }
      : name === "grass" || name === "dirt"
        ? { drag: 0.43, grip: 0.7 }
        : name === "ice"
          ? { drag: 0.06, grip: 0.28 }
          : { drag: 0.13, grip: 1 };
  return {
    drag: Math.max(0, finite(raw?.drag, defaults.drag)),
    grip: clamp(finite(raw?.grip, defaults.grip), 0.05, 2),
    bump: Math.max(0, finite(raw?.bump, 0)),
  };
}

export function createRacer(stats = {}, index = 0) {
  return {
    stats,
    index,
    s: 0,
    lateral: clamp((index - 0.5) * 1.35, -2, 2),
    speed: 0,
    steer: 0,
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    finished: false,
    finishTime: null,
    elapsed: 0,
    verticalVelocity: 0,
    bounce: 0,
    _leftHeld: false,
    _rightHeld: false,
    _paddleCooldown: 0,
    _swipeHeld: 0,
    _boostTime: 0,
    _boostStrength: 0.5,
    _driveDirection: 0,
    _suspension: null,
    _sideX: 1,
    _sideZ: 0,
    _tangentX: 0,
    _tangentZ: -1,
    _lateralLimit: 3.35,
  };
}

function createSuspension(mass, roadY) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.solver.iterations = 8;
  const chassis = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(0.38, 0.18, 0.55)),
    position: new CANNON.Vec3(0, roadY + 0.61, 0),
    linearDamping: 0.08,
  });
  const ground = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(2, 0.1, 2)),
  });
  ground.position.set(0, roadY - 0.1, 0); // top face exactly at sampled road height
  world.addBody(chassis);
  world.addBody(ground);
  const spring = new CANNON.Spring(chassis, ground, {
    restLength: 0.53,
    stiffness: mass * 55,
    damping: mass * 8,
    localAnchorA: new CANNON.Vec3(0, -0.18, 0),
    localAnchorB: new CANNON.Vec3(0, 0.1, 0),
  });
  return { world, chassis, ground, spring, groundY: roadY };
}

export function disposeRacer(racer) {
  const suspension = racer?._suspension;
  if (!suspension) return;
  suspension.world.removeBody(suspension.chassis);
  suspension.world.removeBody(suspension.ground);
  racer._suspension = null;
}

export function resetRacer(
  racer,
  stats = racer?.stats ?? {},
  index = racer?.index ?? 0,
) {
  disposeRacer(racer);
  Object.assign(racer, createRacer(stats, index));
  return racer;
}

function stepSuspension(racer, surface, roadY, dt) {
  const mass = Math.max(45, finite(racer.stats?.mass, 90));
  if (!racer._suspension) racer._suspension = createSuspension(mass, roadY);
  const suspension = racer._suspension;
  const bump = surface.bump * Math.sin(racer.s * 1.7 + racer.index * 1.9);
  const targetY = roadY + bump;
  const delta = targetY - suspension.groundY;
  suspension.groundY = targetY;
  suspension.ground.position.y += delta;
  suspension.chassis.position.y += delta; // move the local physics frame with the slope
  suspension.chassis.position.x = 0;
  suspension.chassis.position.z = 0;
  suspension.chassis.velocity.x = 0;
  suspension.chassis.velocity.z = 0;
  suspension.spring.applyForce();
  suspension.world.step(dt);
  racer.bounce = clamp(
    suspension.chassis.position.y - roadY - 0.42,
    -0.2,
    0.45,
  );
  racer.verticalVelocity = suspension.chassis.velocity.y;
}

function integrate(racer, input, dt, roadAt, surfaceAt) {
  const road = sampleRoad(roadAt, racer.s);
  const ahead = sampleRoad(roadAt, racer.s + 1);
  const behind = sampleRoad(roadAt, racer.s - 1);
  const horizontal = Math.hypot(ahead.x - behind.x, ahead.z - behind.z) || 2;
  const grade = clamp((behind.y - ahead.y) / horizontal, -0.55, 0.55);
  const surface = surfaceProperties(surfaceAt, racer.s, racer.lateral);
  const stats = racer.stats ?? {};
  const mass = Math.max(45, finite(stats.mass, 90));
  const gravityScale = clamp(finite(stats.gravity, 1), 0.2, 2);
  const topSpeed = Math.max(12, finite(stats.topSpeed, 38));
  const paddleForce = Math.max(
    0,
    finite(stats.paddleForce, finite(stats.paddle, 2.8)),
  );
  const steering = clamp(
    finite(stats.steering, finite(stats.handling, 1)),
    0.4,
    2,
  );

  const swipe = Math.sign(finite(input.swipeDirection, 0));
  const strength = clamp(finite(input.swipeStrength, 0.5), 0, 1);
  if (swipe && swipe !== racer._swipeHeld) {
    racer._boostStrength = strength;
    racer._driveDirection = swipe;
    racer._boostTime = 10;
  }
  if (swipe > 0 && racer._driveDirection > 0)
    racer._boostStrength = Math.max(racer._boostStrength, strength);
  racer._swipeHeld = swipe;
  racer._boostTime = Math.max(0, racer._boostTime - dt);
  if (input.brake) {
    racer._boostTime = 0;
    racer._driveDirection = 0;
  }
  racer._paddleCooldown = Math.max(0, racer._paddleCooldown - dt);
  const left = !!input.leftPaddle;
  const right = !!input.rightPaddle;
  // An alternating stroke rewards rhythm; holding a key cannot generate impulses.
  if (
    racer._paddleCooldown === 0 &&
    !input.touchDrive &&
    ((left && !racer._leftHeld) || (right && !racer._rightHeld))
  ) {
    const impulse =
      paddleForce *
      (left && right ? 1.25 : 1) *
      (90 / mass) *
      (input.reverse ? -1 : 1);
    racer.speed = clamp(racer.speed + impulse, -8, topSpeed);
    racer._paddleCooldown = 0.13;
  }
  racer._leftHeld = left;
  racer._rightHeld = right;

  const dragScale = clamp(finite(stats.drag, 1), 0.35, 2.5);
  const gripScale = clamp(finite(stats.grip, 1), 0.35, 2);
  const rolling = (0.23 + surface.drag) * dragScale;
  const draft = clamp(finite(input.draft, 0), 0, 1);
  const aero =
    0.0055 *
    dragScale *
    (1 - draft * 0.3) *
    racer.speed *
    Math.abs(racer.speed);
  const brake = input.brake ? 11 : 0;
  // Touch strokes bank ten seconds of assistance; terrain still adds drag.
  // Once spent, ease back toward a slow downhill coast rather than stopping.
  const target = racer._boostTime > 0
    ? (racer._driveDirection > 0 ? Math.min(10 + racer._boostStrength * 12, topSpeed) : -1.6)
    : 3;
  const assist = input.touchDrive && !input.brake
    ? clamp((target - racer.speed) * (racer._boostTime > 0 ? 1.8 : 0.28), -4.5, 3 + racer._boostStrength * 7)
    : 0;
  const acceleration = assist +
    9.81 * grade * gravityScale -
    Math.sign(racer.speed) * rolling -
    aero -
    (input.brake ? Math.sign(racer.speed) * brake : 0);
  const beforeSpeed = racer.speed;
  racer.speed = clamp(racer.speed + acceleration * dt, -5, topSpeed);
  if (input.brake && (Math.sign(beforeSpeed) !== Math.sign(racer.speed) || Math.abs(beforeSpeed) < 0.15))
    racer.speed = 0;
  if (Math.abs(racer.speed) < 0.03 && (input.brake || Math.abs(grade) < 0.02))
    racer.speed = 0;

  const targetSteer = clamp(finite(input.steer, 0), -1, 1);
  racer.steer += (targetSteer - racer.steer) * Math.min(1, dt * 10);
  const lateralSpeed =
    racer.steer *
    steering *
    surface.grip *
    gripScale *
    (2.5 + Math.min(Math.abs(racer.speed), 28) * 0.21);
  racer.lateral += lateralSpeed * dt;
  const limit = Math.max(0.8, road.width / 2 - 0.65);
  racer._lateralLimit = limit;
  if (Math.abs(racer.lateral) > limit) {
    racer.lateral = clamp(racer.lateral, -limit, limit);
    racer.speed *= Math.max(0.2, 1 - 2.4 * dt); // guardrail scrub
    racer.bounce = Math.max(racer.bounce, 0.11);
  }

  racer.s = clamp(racer.s + racer.speed * dt, 0, COURSE_LENGTH);
  racer.elapsed += dt;
  if (racer.s >= COURSE_LENGTH && !racer.finished) {
    racer.finished = true;
    racer.finishTime = racer.elapsed;
    racer.speed = 0;
  }

  stepSuspension(racer, surface, sampleRoad(roadAt, racer.s).y, dt);
}

export function stepRacer(racer, input = {}, dt = 0, roadAt, surfaceAt) {
  if (!racer || racer.finished || !Number.isFinite(dt) || dt <= 0) return racer;
  let remaining = Math.min(dt, 0.2);
  while (remaining > 0) {
    const step = Math.min(remaining, 1 / 120);
    integrate(racer, input, step, roadAt, surfaceAt);
    remaining -= step;
  }
  const road = sampleRoad(roadAt, racer.s);
  const previous = sampleRoad(roadAt, racer.s - 0.5);
  const next = sampleRoad(roadAt, racer.s + 0.5);
  const tx = road.tx ?? next.x - previous.x;
  const tz = road.tz ?? next.z - previous.z;
  const tangentLength = Math.hypot(tx, tz) || 1;
  const sideX = -tz / tangentLength;
  const sideZ = tx / tangentLength;
  racer._sideX = sideX;
  racer._sideZ = sideZ;
  racer._tangentX = tx / tangentLength;
  racer._tangentZ = tz / tangentLength;
  racer.position.x = road.x + sideX * racer.lateral;
  racer.position.y = road.y + racer.bounce + 0.42;
  racer.position.z = road.z + sideZ * racer.lateral;
  const yaw = road.yaw ?? Math.atan2(tx, tz);
  // Vehicle geometry faces -Z in its local frame; road yaw describes +Z.
  const heading =
    yaw - Math.PI - racer.steer * Math.min(Math.abs(racer.speed) / 40, 0.25);
  racer.quaternion.x = 0;
  racer.quaternion.y = Math.sin(heading / 2);
  racer.quaternion.z = Math.sin(road.bank / 2);
  racer.quaternion.w = Math.cos(heading / 2) * Math.cos(road.bank / 2);
  return racer;
}

// Resolve collisions after all racers have taken their own physics step. The
// road-space boxes are 2.9 m long and 1.5 m wide. Corrections are positional;
// longitudinal closing speed receives a mass-weighted, low-restitution impulse.
export function resolveRacerContacts(racers, dt = 1 / 60) {
  if (
    !Array.isArray(racers) ||
    racers.length < 2 ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return;
  const length = 2.9;
  const width = 1.5;
  for (let iteration = 0; iteration < 32; iteration++) {
    let moved = false;
    for (let i = 0; i < racers.length; i++) {
      const a = racers[i];
      if (!a || a.finished) continue;
      for (let j = i + 1; j < racers.length; j++) {
        const b = racers[j];
        if (!b || b.finished) continue;
        const overlapS = length - Math.abs(a.s - b.s);
        const overlapL = width - Math.abs(a.lateral - b.lateral);
        if (overlapS <= 0 || overlapL <= 0) continue;
        moved = true;
        const ma = Math.max(45, finite(a.stats?.mass, 90));
        const mb = Math.max(45, finite(b.stats?.mass, 90));
        const aShare = mb / (ma + mb);
        const bShare = ma / (ma + mb);
        const aLimit = finite(a._lateralLimit, 3.35);
        const bLimit = finite(b._lateralLimit, 3.35);
        const canSeparateLaterally =
          Math.abs(a.lateral) < aLimit - 0.01 ||
          Math.abs(b.lateral) < bLimit - 0.01;
        if (
          overlapL < overlapS &&
          canSeparateLaterally &&
          Math.abs(a.lateral - b.lateral) > 0.2
        ) {
          const sign = a.lateral <= b.lateral ? -1 : 1;
          const shift = overlapL + 0.001;
          const oldA = a.lateral;
          const oldB = b.lateral;
          a.lateral = clamp(a.lateral + sign * shift * aShare, -aLimit, aLimit);
          b.lateral = clamp(b.lateral - sign * shift * bShare, -bLimit, bLimit);
          let remaining = width - Math.abs(a.lateral - b.lateral);
          if (remaining > 0) {
            a.lateral = clamp(a.lateral + sign * remaining, -aLimit, aLimit);
            remaining = width - Math.abs(a.lateral - b.lateral);
            b.lateral = clamp(b.lateral - sign * remaining, -bLimit, bLimit);
          }
          a.position.x += (a.lateral - oldA) * a._sideX;
          a.position.z += (a.lateral - oldA) * a._sideZ;
          b.position.x += (b.lateral - oldB) * b._sideX;
          b.position.z += (b.lateral - oldB) * b._sideZ;
          a.bounce = Math.max(a.bounce, 0.07);
          b.bounce = Math.max(b.bounce, 0.07);
          if (Math.abs(a.lateral - b.lateral) >= width - 0.0001) continue;
        }
        const aBehind = a.s <= b.s;
        const sign = aBehind ? -1 : 1;
        const shift = overlapS + 0.001;
        const oldA = a.s;
        const oldB = b.s;
        a.s = clamp(a.s + sign * shift * aShare, 0, COURSE_LENGTH);
        b.s = clamp(b.s - sign * shift * bShare, 0, COURSE_LENGTH);
        let remaining = length - Math.abs(a.s - b.s);
        if (remaining > 0) {
          a.s = clamp(a.s + sign * remaining, 0, COURSE_LENGTH);
          remaining = length - Math.abs(a.s - b.s);
          b.s = clamp(b.s - sign * remaining, 0, COURSE_LENGTH);
        }
        a.position.x += (a.s - oldA) * a._tangentX;
        a.position.z += (a.s - oldA) * a._tangentZ;
        b.position.x += (b.s - oldB) * b._tangentX;
        b.position.z += (b.s - oldB) * b._tangentZ;
        const behind = aBehind ? a : b;
        const ahead = aBehind ? b : a;
        const closing = behind.speed - ahead.speed;
        if (closing > 0) {
          const impulse = (1.18 * closing) / (1 / ma + 1 / mb);
          const behindMass = aBehind ? ma : mb;
          const aheadMass = aBehind ? mb : ma;
          behind.speed -= impulse / behindMass;
          ahead.speed += impulse / aheadMass;
        }
        a.bounce = Math.max(a.bounce, 0.1);
        b.bounce = Math.max(b.bounce, 0.1);
      }
    }
    if (!moved) break;
  }
}
