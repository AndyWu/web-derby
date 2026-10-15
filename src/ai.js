// Rival choices are pure functions of the race snapshot, so every client can
// reproduce the same opponents without sharing per-driver AI state.
export const AI_DRIVERS = Object.freeze([
  {
    name: "Barnaby",
    style: "rookie",
    lane: -0.45,
    pace: 0.84,
    caution: 0.35,
    skill: 0.55,
  },
  {
    name: "Clementine",
    style: "cautious",
    lane: 0.55,
    pace: 0.77,
    caution: 1.5,
    skill: 0.9,
  },
  {
    name: "Buster",
    style: "aggressive",
    lane: -0.8,
    pace: 1.04,
    caution: 0.03,
    skill: 0.9,
  },
  {
    name: "Maeve",
    style: "tactical",
    lane: 0.25,
    pace: 0.95,
    caution: 1.2,
    skill: 1.3,
  },
  { name: "Ace", style: "racer", lane: 0, pace: 1, caution: 1.15, skill: 1.5 },
  { name: "Dotty", style: "rookie", lane: 0.9, pace: 0.72, caution: 0.25, skill: 0.35 },
  { name: "Otis", style: "steady", lane: -0.3, pace: 0.86, caution: 0.8, skill: 0.75 },
  { name: "Juniper", style: "clean", lane: 0.35, pace: 0.96, caution: 1.25, skill: 1.15 },
  { name: "Rook", style: "expert", lane: -0.15, pace: 1.02, caution: 1.2, skill: 1.7 },
]);

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const num = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

function surfaceCost(surface) {
  const type =
    typeof surface === "string"
      ? surface
      : (surface?.type ?? surface?.name ?? "road");
  const base =
    {
      road: 0,
      asphalt: 0,
      dirt: 0,
      gravel: 0.5,
      grass: 1.4,
      mud: 2.7,
      water: 1.8,
      sand: 1.4,
      rock: 1.3,
      ice: 3.1,
      field: 2,
    }[type] ?? 0;
  return (
    base +
    Math.max(0, num(surface?.drag) - 0.13) * 1.4 +
    Math.max(0, 1 - num(surface?.grip, 1)) * 2 +
    num(surface?.bump) * 0.35
  );
}

function widthAt(roadAt, s) {
  const road = roadAt?.(s) ?? {};
  return Math.max(2, num(road.width, num(road.halfWidth, 4) * 2));
}

export function aiInput(
  profile,
  racer,
  racers = [],
  time = 0,
  roadAt,
  surfaceAt,
) {
  const driver =
    typeof profile === "number"
      ? AI_DRIVERS[profile % AI_DRIVERS.length]
      : typeof profile === "string"
        ? AI_DRIVERS.find((entry) => entry.name === profile)
        : profile;
  const p = driver ?? AI_DRIVERS[0];
  const skill = clamp(num(p.skill, 1), 0.2, 1.8);
  const s = num(racer?.s),
    lateral = num(racer?.lateral),
    speed = num(racer?.speed);
  const t = Math.max(0, num(time));
  const half = Math.max(0.8, widthAt(roadAt, s) / 2 - 0.85);
  const lanes = [-0.82, -0.45, 0, 0.45, 0.82].map(
    (fraction) => fraction * half,
  );
  const opponents = (racers ?? []).filter(
    (other) => other && other !== racer && !other.finished,
  );
  const ahead = opponents
    .filter((other) => num(other.s) > s && num(other.s) - s < 22)
    .sort((a, b) => a.s - b.s)[0];
  const draft =
    ahead &&
    ahead.s - s > 3 &&
    ahead.s - s < 19 &&
    Math.abs(lateral - num(ahead.lateral)) < 1.3
      ? p.style === "racer"
        ? 1
        : p.style === "tactical"
          ? 0.65
          : 0.3
      : 0;
  const look = clamp(speed * (0.35 + skill * 0.28) + 6 + skill * 3, 8, 42);
  const hazard = (lane) =>
    (skill < 0.6 ? [0.45, 1] : [0.45, 1, 1.6]).reduce((cost, factor) => {
      const sampleS = s + look * factor;
      const sampleHalf = Math.max(0.8, widthAt(roadAt, sampleS) / 2 - 0.85);
      const edgeCost = Math.max(0, Math.abs(lane) - sampleHalf) * 5;
      return (
        cost +
        surfaceCost(surfaceAt?.(sampleS, lane)) * (factor === 0.45 ? 1.2 : 1) +
        edgeCost
      );
    }, 0);
  const laneScore = (lane) => {
    const cost = hazard(lane) * (p.caution ?? 1) * (0.55 + skill * 0.45);
    const travel = Math.abs(lane - lateral) * 0.23;
    const preference =
      Math.abs(lane - num(p.lane)) * (p.style === "tactical" ? 0.12 : 0.3);
    const traffic = opponents.reduce((sum, other) => {
      const ds = num(other.s) - s;
      if (ds < -3 || ds > look + 10) return sum;
      const near = Math.max(0, 2.2 - Math.abs(lane - num(other.lateral)));
      return sum + near * (ds < 10 ? 1.5 : 0.5);
    }, 0);
    const draft =
      ahead &&
      Math.abs(lane - num(ahead.lateral)) < 1.3 &&
      ahead.s - s > 7 &&
      ahead.s - s < 19
        ? p.style === "racer"
          ? -2.3
          : p.style === "tactical"
            ? -1.2
            : -0.4
        : 0;
    return cost + travel + preference + traffic + draft;
  };
  let target = lanes.reduce(
    (best, lane) => (laneScore(lane) < laneScore(best) ? lane : best),
    lanes[0],
  );
  const error = Math.max(0, 1.55 - skill);
  target += Math.sin(t * 2.7 + num(racer?.index) * 1.7) * error * 0.42;
  target = clamp(target, -half, half);
  let steer = clamp(
    (target - lateral) * (p.style === "rookie" ? 0.68 : 0.36 + skill * 0.06) -
      num(racer?.steer) * (p.style === "rookie" ? 0.08 : 0.18 + skill * 0.14),
    -1,
    1,
  );
  steer = clamp(steer + Math.sin(t * 3.6 + num(racer?.index)) * error * 0.15, -1, 1);

  const currentCost = surfaceCost(surfaceAt?.(s, lateral));
  const futureCost = hazard(target) / 3;
  const closing = ahead && ahead.s - s < 8 && speed > num(ahead.speed) + 1;
  const braking =
    speed > 8 && (currentCost > 2.8 || futureCost > 2.2 || closing);
  const cautious = p.style === "cautious" && speed > 20 && futureCost > 0.4;
  const lateRookie =
    p.style === "rookie" && speed > 27 && (currentCost > 2.1 || closing);
  const brake =
    p.style === "aggressive"
      ? Boolean(closing && speed > 32)
      : p.style === "rookie"
        ? Boolean(lateRookie)
        : Boolean((braking && speed > Math.max(8, 16 - skill * 5)) || cautious);
  // Player swipes target roughly 10–22 m/s. Keep rivals in that range so
  // paddle rhythm and line choice decide races without an unreachable speed gap.
  const desiredSpeed = clamp(
    (10 + skill * 8) * num(p.pace, 0.9),
    8,
    num(racer?.stats?.topSpeed, 40),
  );
  const strokePeriod =
    p.style === "rookie"
      ? 0.43 + (0.55 - skill) * 0.15
      : p.style === "cautious"
        ? 0.48
        : p.style === "aggressive"
          ? 0.29
          : p.style === "racer"
            ? 0.27
        : clamp(0.48 - skill * 0.105, 0.28, 0.45);
  const strokeIndex = Math.floor(
    (t + num(racer?.index) * 0.037) / strokePeriod,
  );
  const strokePhase = (t + num(racer?.index) * 0.037) % strokePeriod;
  const forgets = p.style === "rookie" && strokeIndex % (skill < 0.45 ? 3 : 4) === 2;
  const paddle =
    !brake && !forgets && speed < desiredSpeed && strokePhase < 0.09;
  return {
    steer,
    leftPaddle: paddle && strokeIndex % 2 === 0,
    rightPaddle: paddle && strokeIndex % 2 === 1,
    brake,
    reverse: speed < -0.5,
    headlight: true,
    draft,
  };
}
