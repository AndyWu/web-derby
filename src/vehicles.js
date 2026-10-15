import { createReferenceVehicle } from "./reference-vehicles.js";
import { createPhotoVehicle } from "./photo-vehicles.js";

// Twelve salvaged downhill machines. All dimensions are in metres; the driver
// looks toward -Z from just behind the dash.
export const VEHICLES = [
  {
    name: "Skipper 14",
    subtitle: "A vintage crate on tall wire wheels",
    trait: "Long wheelbase and steady turns",
    color: 0xba915f,
    mass: 93,
    drag: 0.86,
    grip: 0.95,
    handling: 0.95,
    topSpeed: 43,
    paddleForce: 3.1,
  },
  {
    name: "Bare Bones",
    subtitle: "A seat and four wheels on bare timber",
    trait: "Very light with quick, lively steering",
    color: 0xbd995c,
    mass: 69,
    drag: 0.73,
    grip: 0.83,
    handling: 1.38,
    topSpeed: 46,
    paddleForce: 3.6,
  },
  {
    name: "Blue Barrel",
    subtitle: "A plastic drum with bicycle wheels",
    trait: "Buoyant feel and nimble acceleration",
    color: 0x247dcc,
    mass: 80,
    drag: 0.89,
    grip: 0.88,
    handling: 1.17,
    topSpeed: 44,
    paddleForce: 3.4,
  },
  {
    name: "Sunshine Kart",
    subtitle: "A bright backyard racer built for fun",
    trait: "Low center of gravity and easy grip",
    color: 0xe7bb37,
    mass: 86,
    drag: 0.75,
    grip: 1.05,
    handling: 1.15,
    topSpeed: 45,
    paddleForce: 3.3,
  },
  {
    name: "The Scarecrow",
    subtitle: "Built from everything left in the shed",
    trait: "Featherlight and twitchy on loose ground",
    color: 0x9b7950,
    mass: 72,
    drag: 0.96,
    grip: 0.78,
    handling: 1.35,
    topSpeed: 44,
    paddleForce: 3.5,
  },
  {
    name: "Green Bean",
    subtitle: "Small frame, enormous ambition",
    trait: "Quickest paddle launch and sharpest turns",
    color: 0x6c9456,
    mass: 68,
    drag: 0.67,
    grip: 0.87,
    handling: 1.41,
    topSpeed: 48,
    paddleForce: 3.7,
  },
  {
    name: "Sunday Special",
    subtitle: "A picnic table with racing stripes",
    trait: "Easy steering and forgiving road grip",
    color: 0xd2c486,
    mass: 91,
    drag: 0.76,
    grip: 1.02,
    handling: 1.08,
    topSpeed: 45,
    paddleForce: 3.2,
  },
  {
    name: "Firefly",
    subtitle: "A yellow torpedo with hand-painted flames",
    trait: "Fast straight-line glide with gentle steering",
    color: 0xf4d92b,
    mass: 91, drag: 0.68, grip: 0.91, handling: 0.96, topSpeed: 49, paddleForce: 3.1,
  },
  {
    name: "Miss Georgia",
    subtitle: "A blue-and-white flying milk racer",
    trait: "Light nose, lively turns, and high top speed",
    color: 0x2b708f,
    mass: 83, drag: 0.72, grip: 0.89, handling: 1.25, topSpeed: 48, paddleForce: 3.4,
  },
  {
    name: "Silver Claw",
    subtitle: "A silver streamliner with three black slashes",
    trait: "Low drag and planted cornering",
    color: 0xbfc4c5,
    mass: 98, drag: 0.65, grip: 1.04, handling: 1.03, topSpeed: 50, paddleForce: 3.0,
  },
  {
    name: "Tiger Stripe",
    subtitle: "A bright orange racer with bold black stripes",
    trait: "Quick paddle launch and bold cornering",
    color: 0xec5135,
    mass: 78, drag: 0.77, grip: 0.94, handling: 1.27, topSpeed: 46, paddleForce: 3.5,
  },
  {
    name: "Shuttlecraft",
    subtitle: "A boxy homemade ship with side nacelles",
    trait: "Heavy and stable with strong road grip",
    color: 0xeeeae2,
    mass: 114, drag: 1.01, grip: 1.12, handling: 0.86, topSpeed: 40, paddleForce: 2.8,
  },
];

function weatheredMaps(THREE, kind, seed) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const size = 128;
  const canvases = Array.from({ length: 3 }, () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  });
  const images = canvases.map((c) =>
    c.getContext("2d").createImageData(size, size),
  );
  let state = (seed * 1664525 + 1013904223) >>> 0;
  const random = () =>
    (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        n = random();
      let r, g, b, rough, height;
      if (kind === "wood") {
        const grain =
          Math.sin(x * 0.23 + Math.sin(y * 0.095) * 2.5) * 0.5 +
          Math.sin(x * 0.77 + y * 0.11) * 0.12;
        const knot =
          Math.sin(Math.hypot(x - 40, y - 74) * 0.35) *
          Math.exp(-Math.hypot(x - 40, y - 74) * 0.055);
        height = 126 + grain * 42 + knot * 30 + (n - 0.5) * 22;
        r = g = b = height;
        rough = 210 + grain * 18 + n * 17;
      } else {
        const fleck =
          n > 0.972 ||
          Math.sin(x * 0.87 + y * 0.39) * Math.sin(y * 0.69 - x * 0.17) > 0.82;
        const oxide =
          kind === "iron" &&
          Math.sin(x * 0.18 + y * 0.07) * Math.cos(y * 0.21) > 0.61;
        height = kind === "paint" ? 214 + (n - 0.5) * 17 : 180 + (n - 0.5) * 33;
        if (fleck) height = kind === "paint" ? 83 : 119;
        r = height;
        g = oxide ? height * 0.68 : height;
        b = oxide ? height * 0.45 : height;
        rough =
          kind === "paint"
            ? fleck
              ? 242
              : 153 + n * 44
            : oxide
              ? 236
              : 136 + n * 65;
      }
      const rgb = images[0].data,
        rm = images[1].data,
        nm = images[2].data;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
      rgb[i + 3] = 255;
      rm[i] = rm[i + 1] = rm[i + 2] = rough;
      rm[i + 3] = 255;
      // Fine raised grain and chipped paint catch grazing light.
      nm[i] = 128 + (n - 0.5) * 35;
      nm[i + 1] = 128 + (height - 180) * 0.22;
      nm[i + 2] = 246;
      nm[i + 3] = 255;
    }
  return canvases.map((canvas, j) => {
    canvas.getContext("2d").putImageData(images[j], 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(kind === "wood" ? 2 : 1, kind === "wood" ? 3 : 2);
    if (j === 0) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  });
}

function paintedLabel(THREE, words) {
  if (typeof document === "undefined")
    return new THREE.MeshBasicMaterial({
      color: 0xe7d7a5,
      side: THREE.DoubleSide,
    });
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d8c897";
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = "#544b35";
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = "#423b2b";
  ctx.font = "bold 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(words, 128, 50);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
}

export function createVehicle(THREE, index = 0, cockpit = false) {
  const selection = ((index % VEHICLES.length) + VEHICLES.length) % VEHICLES.length;
  const spec = VEHICLES[selection];
  if (selection < 4) return createReferenceVehicle(THREE, selection, cockpit, spec);
  if (selection >= 7) return createPhotoVehicle(THREE, selection - 7, cockpit, spec);
  // Preserve the existing handmade meshes for the three retained trucks.
  const id = [5, 6, 8][selection - 4];
  const group = new THREE.Group();
  group.name = spec.name;
  const mat = (color, metalness = 0, roughness = 0.86) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const worn = (color, metalness, roughness, kind, variant = 0) => {
    const m = mat(color, metalness, roughness);
    const maps = weatheredMaps(THREE, kind, id * 19 + variant + 1);
    if (maps) {
      m.map = maps[0];
      m.roughnessMap = maps[1];
      m.normalMap = maps[2];
      m.normalScale.set(0.12, 0.12);
    }
    return m;
  };
  const paint = worn(spec.color, 0.28, 0.68, "paint"),
    paintDark = worn(
      new THREE.Color(spec.color).multiplyScalar(0.64),
      0.25,
      0.82,
      "paint",
      1,
    );
  const wood = worn(0x8b603a, 0, 0.9, "wood"),
    woodLight = worn(0xb38553, 0, 0.83, "wood", 1),
    woodDark = worn(0x493925, 0, 0.94, "wood", 2);
  const iron = worn(0x575c58, 0.72, 0.55, "iron"),
    steel = worn(0xabb2a5, 0.77, 0.42, "iron", 1);
  const rubber = mat(0x20221e),
    rope = mat(0xbaa57a),
    leather = mat(0x583e2b);
  const brass = mat(0xc4a552, 0.67, 0.39),
    cream = mat(0xe1d4ad);
  function mesh(geo, material, x, y, z, parent = group) {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  const box = (w, h, d, m, x, y, z, p) =>
    mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
  const cyl = (rt, rb, h, seg, m, x, y, z, p) =>
    mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p);
  const rod = (a, b, r, m, p = group) => {
    const v1 = new THREE.Vector3(...a),
      v2 = new THREE.Vector3(...b);
    const o = mesh(
      new THREE.CylinderGeometry(r, r, v1.distanceTo(v2), 7),
      m,
      ...v1.clone().add(v2).multiplyScalar(0.5).toArray(),
      p,
    );
    o.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v2.sub(v1).normalize(),
    );
    return o;
  };
  // Chassis length, width and axle spacing vary with each builder's scrap pile.
  const widthScale = [1, 0.88, 1.12, 0.95, 1.05, 0.83, 0.79, 1.16, 1.03, 1.13][
    id
  ];
  const lengthScale = [1, 0.91, 1.1, 0.96, 1.07, 1.04, 0.88, 1.13, 1.0, 1.08][
    id
  ];
  const axleSpread = [1, 0.9, 1.08, 1.02, 0.96, 1.03, 0.87, 1.11, 1.06, 1.0][
    id
  ];
  const body = new THREE.Group();
  body.scale.set(widthScale, 1, lengthScale);
  group.add(body);
  // Pallet chassis: individual splintered planks and exposed crossmembers.
  for (let n = 0; n < 5; n++) {
    const x = (n - 2) * 0.34;
    const plank = box(
      0.28,
      0.095,
      3.25,
      n % 2 ? wood : woodLight,
      x,
      0.49,
      -0.5,
      body,
    );
    plank.rotation.y = (n - 2) * 0.006;
    box(0.23, 0.07, 3.1, woodDark, x, 0.415, -0.5, body);
  }
  for (const z of [-1.75, -0.53, 0.78])
    box(1.78, 0.16, 0.18, woodDark, 0, 0.38, z, body);
  // Scrapped sheet-metal hood and hand-bent fenders. The hood remains visible
  // from the driver's seat, providing a stable first-person reference.
  const hood = box(1.54, 0.17, 1.13, paint, 0, 0.79, -1.34);
  hood.rotation.x = -0.055;
  box(1.37, 0.055, 0.95, paintDark, 0, 0.885, -1.36);
  for (const side of [-1, 1]) {
    box(0.17, 0.37, 1.48, paint, side * 0.88, 0.72, -1.12);
    box(0.09, 0.18, 2.42, iron, side * 0.92, 0.43, -0.43);
    rod([side * 0.75, 0.91, -1.8], [side * 0.75, 1.01, -0.77], 0.032, steel);
    for (let bolt = 0; bolt < 4; bolt++)
      cyl(
        0.028,
        0.028,
        0.018,
        7,
        brass,
        side * 0.73,
        0.905,
        -1.75 + bolt * 0.24,
      );
  }
  box(1.86, 0.25, 0.16, woodDark, 0, 0.65, -2.02);
  box(1.55, 0.27, 0.045, iron, 0, 0.81, -2.11);
  for (let x = -0.57; x <= 0.58; x += 0.19)
    box(0.045, 0.2, 0.052, steel, x, 0.81, -2.145);
  // Four mismatched lawnmower wheels, grooved rubber, rusty hubs and axles.
  for (const z0 of [-1.51, 0.6]) {
    const z = z0 * axleSpread;
    const axleWidth = 1.03 * widthScale;
    rod([-axleWidth, 0.36, z], [axleWidth, 0.36, z], 0.075, iron);
    for (const side of [-1, 1]) {
      const wheel = mesh(
        new THREE.CylinderGeometry(0.37, 0.37, 0.16, 20),
        rubber,
        side * axleWidth,
        0.37,
        z,
      );
      wheel.rotation.z = Math.PI / 2;
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5;
        const tread = box(
          0.11,
          0.055,
          0.2,
          rubber,
          side * axleWidth + Math.sin(a) * 0.37,
          0.37 + Math.cos(a) * 0.37,
          z,
        );
        tread.rotation.z = a;
      }
      const hub = cyl(
        0.155,
        0.155,
        0.177,
        12,
        steel,
        side * axleWidth,
        0.37,
        z,
      );
      hub.rotation.z = Math.PI / 2;
      const cap = cyl(
        0.058,
        0.058,
        0.19,
        8,
        brass,
        side * (axleWidth + 0.015),
        0.37,
        z,
      );
      cap.rotation.z = Math.PI / 2;
    }
  }
  // Dashboard and reachable controls. These objects are intentionally exposed
  // so the game can animate the wheel, paddles, brake, shifter and lamp.
  const dash = box(1.52, 0.21, 0.17, woodDark, 0, 1.06, -0.47);
  box(1.41, 0.095, 0.18, paint, 0, 1.18, -0.47);
  const wheel = new THREE.Group();
  wheel.position.set(0, 1.11, -0.35);
  group.add(wheel);
  const rim = mesh(
    new THREE.TorusGeometry(0.27, 0.037, 8, 22),
    leather,
    0,
    0,
    0,
    wheel,
  );
  rim.rotation.x = -0.23;
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    rod(
      [0, 0, 0],
      [Math.sin(a) * 0.255, Math.cos(a) * 0.255, 0],
      0.022,
      steel,
      wheel,
    );
  }
  mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.08, 10),
    brass,
    0,
    0,
    0.035,
    wheel,
  ).rotation.x = Math.PI / 2;
  const paddles = [];
  const pushLabel = paintedLabel(THREE, "PUSH ↑");
  for (const side of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(side * 0.43, 0.53, -0.44);
    group.add(p);
    rod([0, 0, 0], [0, -0.18, -0.17], 0.026, iron, p);
    const foot = box(0.19, 0.045, 0.28, woodLight, 0, -0.19, -0.23, p);
    foot.rotation.x = -0.22;
    const marking = mesh(
      new THREE.PlaneGeometry(0.17, 0.1),
      pushLabel,
      0,
      -0.164,
      -0.22,
      p,
    );
    marking.rotation.x = -Math.PI / 2;
    paddles.push(p);
  }
  const brake = new THREE.Group();
  brake.position.set(0.17, 0.45, -0.62);
  group.add(brake);
  rod([0, 0, 0], [0, -0.12, -0.1], 0.025, iron, brake);
  const brakePad = box(0.22, 0.045, 0.18, rubber, 0, -0.14, -0.13, brake);
  brakePad.rotation.x = -0.25;
  const brakeMark = mesh(
    new THREE.PlaneGeometry(0.19, 0.09),
    paintedLabel(THREE, "BRAKE"),
    0,
    -0.112,
    -0.13,
    brake,
  );
  brakeMark.rotation.x = -Math.PI / 2;
  const gear = new THREE.Group();
  gear.position.set(0.58, 0.62, -0.42);
  group.add(gear);
  rod([0, 0, 0], [0.035, 0.43, -0.06], 0.023, steel, gear);
  mesh(
    new THREE.SphereGeometry(0.084, 10, 8),
    woodDark,
    0.035,
    0.43,
    -0.06,
    gear,
  );
  // Hand-painted dashboard plates belong to the vehicle rather than the HUD.
  mesh(
    new THREE.PlaneGeometry(0.27, 0.105),
    paintedLabel(THREE, "LIGHT"),
    -0.57,
    1.085,
    -0.375,
  );
  mesh(
    new THREE.PlaneGeometry(0.23, 0.105),
    paintedLabel(THREE, "F / R"),
    0.48,
    1.085,
    -0.375,
  );
  for (const x of [-0.58, 0.58]) {
    const lamp = mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12),
      brass,
      x,
      0.96,
      -2.09,
    );
    lamp.rotation.x = Math.PI / 2;
    const glass = mesh(
      new THREE.CircleGeometry(0.125, 16),
      cream,
      x,
      0.96,
      -2.17,
    );
    glass.rotation.y = Math.PI;
  }
  const headlight = new THREE.SpotLight(
    0xffecc2,
    0,
    32,
    Math.PI / 8,
    0.58,
    1.7,
  );
  headlight.position.set(0, 1.03, -2.13);
  headlight.target.position.set(0, 0.5, -13);
  group.add(headlight, headlight.target);
  // Tailgates, cargo and improvised roofline distinguish each silhouette.
  box(1.62, 0.3, 0.1, paint, 0, 0.69, 0.99);
  for (const side of [-1, 1]) {
    rod([side * 0.72, 0.55, 0.92], [side * 0.74, 1.16, 0.78], 0.035, iron);
    rod([side * 0.74, 1.16, 0.78], [side * 0.74, 1.32, 0.12], 0.026, iron);
  }
  const barrel = (x, z, scale = 1) => {
    const b = cyl(
      0.25 * scale,
      0.27 * scale,
      0.54 * scale,
      12,
      wood,
      x,
      0.78,
      z,
    );
    for (const yy of [0.58, 0.99])
      cyl(0.272 * scale, 0.272 * scale, 0.045 * scale, 12, iron, x, yy, z);
    return b;
  };
  if ([0, 2, 4, 7, 9].includes(id)) barrel(0.37, 0.58, id === 9 ? 1.3 : 1);
  if ([1, 3, 6].includes(id)) {
    for (const x of [-0.35, 0.2])
      box(0.49, 0.42, 0.51, woodLight, x, 0.73, 0.52);
  }
  if ([2, 5, 8].includes(id)) {
    for (let j = 0; j < 3; j++)
      rod(
        [-0.62, 1.0, 0.16 + j * 0.24],
        [0.62, 1.02, 0.16 + j * 0.24],
        0.042,
        rope,
      );
  }
  if (id === 3 || id === 7)
    for (let j = 0; j < 4; j++) {
      const scrap = box(
        0.21,
        0.28,
        0.47,
        j % 2 ? steel : paintDark,
        -0.54 + j * 0.35,
        1.0,
        0.43,
      );
      scrap.rotation.z = (j - 1.5) * 0.12;
    }
  if (id === 5) {
    const post = rod([0, 0.9, 0.74], [0, 2.01, 0.75], 0.045, wood);
    rod([-0.34, 1.68, 0.74], [0.34, 1.68, 0.74], 0.035, wood);
    box(0.57, 0.34, 0.04, leather, 0, 1.68, 0.76);
  }
  if (id === 8) {
    box(1.58, 0.075, 0.9, woodLight, 0, 1.22, 0.46);
    for (const x of [-0.56, 0.56])
      rod([x, 0.68, 0.68], [x, 1.2, 0.67], 0.036, woodDark);
  }
  if (id === 9)
    mesh(
      new THREE.SphereGeometry(0.31, 12, 8),
      mat(0xdd8732),
      -0.37,
      0.88,
      0.51,
    );
  // Rope lashings visibly wrap the cargo rather than floating above it.
  for (const x of [-0.51, 0.52]) {
    rod([x, 0.55, 0.94], [x, 1.14, 0.63], 0.018, rope);
    rod([x, 1.14, 0.63], [x, 0.62, 0.16], 0.018, rope);
  }
  const flag = new THREE.Group();
  flag.position.set(0.63, 0.86, -1.92);
  group.add(flag);
  rod([0, 0, 0], [0, 0.95, 0], 0.017, steel, flag);
  const flagMat = mat(id % 2 ? 0xe0d5a8 : 0xc94b31);
  const cloth = mesh(
    new THREE.PlaneGeometry(0.47, 0.31, 5, 2),
    flagMat,
    0.235,
    0.78,
    0,
    flag,
  );
  cloth.material.side = THREE.DoubleSide;
  cloth.geometry.translate(0.235, 0, 0);
  flag.userData.cloth = cloth;
  group.userData = {
    wheel,
    paddles,
    brake,
    gear,
    headlight,
    flag,
    stats: spec,
  };
  if (cockpit) {
    // Keep the vehicle's front half in view without a bulky cargo silhouette
    // obscuring the road from the driver camera.
    flag.visible = true;
  }
  return group;
}
