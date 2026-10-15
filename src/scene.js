// A single deterministic road model is shared by rendering and vehicle physics.
export const COURSE_LENGTH = 3218;
const SLOPE = 0.065;
const ROAD_WIDTH = 9.2;
const HAZARD_PERIOD = 420;
const HAZARDS = [
  { type: "mud", from: 85, to: 127, lo: -3.6, hi: 2.4 },
  { type: "water", from: 226, to: 246, lo: -3.4, hi: 3.4 },
  { type: "sand", from: 313, to: 348, lo: -1.6, hi: ROAD_WIDTH / 2 - 0.35 },
  { type: "rock", from: 370, to: 388, lo: -ROAD_WIDTH / 2 + 0.35, hi: -2.1 },
];

// Used by both the driving surface and the visible patch meshes.
export function hazardAt(s) {
  const phase = ((s % HAZARD_PERIOD) + HAZARD_PERIOD) % HAZARD_PERIOD;
  for (const spec of HAZARDS) {
    if (phase <= spec.from || phase >= spec.to) continue;
    const t = (phase - spec.from) / (spec.to - spec.from);
    const taper = Math.pow(Math.sin(Math.PI * t), 0.56);
    const mid = (spec.lo + spec.hi) / 2 + 0.19 * Math.sin(s * 0.27 + spec.from);
    const leftNoise =
      0.24 * Math.sin(s * 0.92 + spec.from) + 0.13 * Math.sin(s * 2.11);
    const rightNoise =
      0.22 * Math.sin(s * 0.74 + spec.to) + 0.12 * Math.cos(s * 1.81);
    const lo = mid + (spec.lo - mid + leftNoise) * taper;
    const hi = mid + (spec.hi - mid + rightNoise) * taper;
    return { type: spec.type, lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }
  return null;
}

export function roadAt(s) {
  const d = Math.max(0, Math.min(COURSE_LENGTH, s));
  const x = Math.sin(d * 0.004) * 35 + Math.sin(d * 0.011) * 8;
  const dx = Math.cos(d * 0.004) * 0.14 + Math.cos(d * 0.011) * 0.088;
  return {
    x,
    y: -d * SLOPE,
    z: -d,
    width: ROAD_WIDTH,
    heading: Math.atan2(dx, -1),
  };
}

// lateral is measured from the road centre in metres. Physics can use these
// coefficients without depending on the Three.js scene or its draw distance.
export function surfaceAt(s, lateral) {
  const a = Math.abs(lateral);
  const rough =
    Math.sin(s * 0.83 + lateral * 2.6) * Math.sin(s * 0.19 - lateral);
  if (a <= ROAD_WIDTH * 0.5 - 0.35) {
    const hazard = hazardAt(s);
    if (hazard && lateral > hazard.lo && lateral < hazard.hi) {
      if (hazard.type === "mud")
        return {
          type: "mud",
          drag: 0.56,
          grip: 0.48,
          bump: Math.abs(rough) * 0.09,
        };
      if (hazard.type === "water")
        return {
          type: "water",
          drag: 0.36,
          grip: 0.56,
          bump: Math.abs(rough) * 0.035,
        };
      if (hazard.type === "sand")
        return {
          type: "sand",
          drag: 0.3,
          grip: 0.64,
          bump: Math.abs(rough) * 0.065,
        };
      if (hazard.type === "rock")
        return {
          type: "rock",
          drag: 0.24,
          grip: 0.68,
          bump: Math.abs(rough) * 0.16,
        };
    }
    return {
      type: "dirt",
      drag: 0.075,
      grip: 0.84,
      bump: Math.abs(rough) * 0.026,
    };
  }
  if (a <= ROAD_WIDTH * 0.5 + 0.8)
    return {
      type: "gravel",
      drag: 0.12,
      grip: 0.68,
      bump: Math.abs(rough) * 0.075,
    };
  if (a <= ROAD_WIDTH * 0.5 + 8)
    return { type: "grass", drag: 0.105, grip: 0.48, bump: rough * 0.13 };
  return { type: "field", drag: 0.15, grip: 0.4, bump: rough * 0.19 };
}

function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (1664525 * n + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

export function createEnvironment(THREE, scene) {
  const random = rng(197802);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x927450,
    roughness: 1,
  });
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x8a7959,
    roughness: 1,
  });
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x789342,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const fieldMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const dirtMat = new THREE.MeshStandardMaterial({
    color: 0x9b7b4b,
    roughness: 1,
  });
  const fenceMat = new THREE.MeshStandardMaterial({
    color: 0xaaa082,
    roughness: 1,
  });
  const barkCanvas = document.createElement("canvas");
  barkCanvas.width = 64;
  barkCanvas.height = 256;
  const barkContext = barkCanvas.getContext("2d");
  barkContext.fillStyle = "#6b543a";
  barkContext.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 350; i++) {
    barkContext.fillStyle =
      i % 3 ? "rgba(34,26,20,.20)" : "rgba(192,169,125,.17)";
    barkContext.fillRect(
      random() * 64,
      random() * 256,
      0.5 + random() * 2,
      7 + random() * 45,
    );
  }
  const barkTexture = new THREE.CanvasTexture(barkCanvas);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTexture,
    roughness: 1,
  });
  const leafMats = [0x526e33, 0x67813a, 0x486833, 0x718946].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  const objects = [];
  const add = (object) => {
    scene.add(object);
    objects.push(object);
    return object;
  };

  // A continuous mesh removes seams in the winding dirt and adjacent banks.
  const step = 8;
  const count = Math.ceil(COURSE_LENGTH / step);
  function terrainRise(s, offset) {
    const strength = Math.max(0, Math.min(1, (Math.abs(offset) - 6) / 34));
    return (
      strength *
      (2.3 * Math.sin(s * 0.013 + offset * 0.051) +
        1.6 * Math.cos(s * 0.026 - offset * 0.08) +
        1.4 * Math.sin(s * 0.005 + offset * 0.025))
    );
  }
  function ribbon(offsets, material, yOffset = 0, terrain = false) {
    const vertices = [],
      uvs = [],
      colors = [],
      indices = [],
      columns = offsets.length;
    for (let i = 0; i <= count; i++) {
      const s = Math.min(COURSE_LENGTH, i * step),
        p = roadAt(s);
      const tangentX = Math.cos(s * 0.004) * 0.14 + Math.cos(s * 0.011) * 0.088;
      const norm = Math.hypot(1, tangentX),
        nx = 1 / norm,
        nz = tangentX / norm;
      for (let j = 0; j < offsets.length; j++) {
        const offset = offsets[j];
        const rise = terrain ? terrainRise(s, offset) : 0;
        vertices.push(
          p.x + nx * offset,
          p.y + yOffset + rise,
          p.z + nz * offset,
        );
        uvs.push(j, s / COURSE_LENGTH);
        if (terrain) {
          const variation =
            Math.sin(s * 0.021 + offset * 0.12) * 0.06 +
            Math.cos(s * 0.007 - offset * 0.052) * 0.07;
          const band = Math.sin(s * 0.004 + offset * 0.032) * 0.05;
          colors.push(
            0.37 + variation + band,
            0.52 + variation,
            0.2 + variation * 0.55,
          );
        }
      }
      if (i) {
        for (let j = 0; j < columns - 1; j++) {
          const a = (i - 1) * columns + j,
            b = i * columns + j;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    if (terrain)
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return add(new THREE.Mesh(g, material));
  }
  ribbon([-110, -75, -35, -13, -5.9], fieldMat, -0.11, true);
  ribbon([5.9, 13, 35, 75, 110], fieldMat, -0.11, true);
  ribbon([-6.1, -ROAD_WIDTH / 2], shoulderMat, -0.018);
  ribbon([ROAD_WIDTH / 2, 6.1], shoulderMat, -0.018);
  ribbon([-ROAD_WIDTH / 2, ROAD_WIDTH / 2], roadMat, 0);
  const hazardMats = {
    mud: new THREE.MeshStandardMaterial({ color: 0x463b2b, roughness: 0.92 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x557178,
      metalness: 0.16,
      roughness: 0.24,
      transparent: true,
      opacity: 0.86,
    }),
    sand: new THREE.MeshStandardMaterial({ color: 0xc9ae76, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x888675, roughness: 1 }),
  };
  for (let start = 0; start < COURSE_LENGTH; start += HAZARD_PERIOD) {
    for (const spec of HAZARDS) {
      if (start + spec.from >= COURSE_LENGTH) continue;
      const vertices = [],
        indices = [];
      const begin = start + spec.from + 0.02;
      const end = Math.min(COURSE_LENGTH, start + spec.to - 0.02);
      for (
        let s = begin, i = 0;
        s <= end + 0.001;
        s = Math.min(end, s + 1.5), i++
      ) {
        const p = roadAt(s),
          dx = Math.cos(s * 0.004) * 0.14 + Math.cos(s * 0.011) * 0.088;
        const n = Math.hypot(1, dx);
        const patch = hazardAt(s);
        if (!patch) break;
        for (const side of [patch.lo, patch.hi])
          vertices.push(p.x + side / n, p.y + 0.024, p.z + (side * dx) / n);
        if (i) {
          const j = (i - 1) * 2,
            k = i * 2;
          indices.push(j, j + 1, k, j + 1, k + 1, k);
        }
        if (s === end) break;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      add(new THREE.Mesh(geometry, hazardMats[spec.type]));
    }
  }

  const dummy = new THREE.Object3D();
  const trees = Array.from({ length: 4 }, (_, j) => {
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      leafMats[j],
      1400,
    );
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    add(mesh);
    return mesh;
  });
  const trunks = add(
    new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.21, 0.29, 1, 5),
      trunkMat,
      4200,
    ),
  );
  trunks.count = 0;
  trunks.castShadow = true;
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.22, 0, 0, 0.22, 0, 0, 0.03, 0.8, -0.04, 0, 0, -0.22, 0, 0, 0.22,
        -0.05, 0.65, 0.02, -0.16, 0, -0.13, 0.16, 0, 0.13, 0.02, 0.72, 0.01,
      ],
      3,
    ),
  );
  bladeGeometry.computeVertexNormals();
  const tufts = add(new THREE.InstancedMesh(bladeGeometry, grassMat, 12000));
  tufts.count = 0;
  const fencePosts = add(
    new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 1.25, 0.17),
      fenceMat,
      1100,
    ),
  );
  fencePosts.count = 0;
  const rails = add(
    new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.12, 0.12, 1),
      fenceMat,
      2200,
    ),
  );
  rails.count = 0;
  const stones = add(
    new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.55, 0),
      dirtMat,
      1400,
    ),
  );
  stones.count = 0;

  function put(mesh, x, y, z, sx, sy, sz, rot = 0) {
    if (mesh.count >= mesh.instanceMatrix.count) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count++, dummy.matrix);
  }
  for (let s = 12; s < COURSE_LENGTH - 5; s += 4.8) {
    const p = roadAt(s);
    const nx = Math.cos(p.heading),
      nz = Math.sin(p.heading);
    for (const side of [-1, 1]) {
      const barnOpening =
        (s > 137 && s < 197 && side === -1) ||
        (s > 562 && s < 620 && side === 1);
      if (random() < (s < 320 ? 0.92 : 0.7)) {
        const offset =
            side *
            ((barnOpening ? 48 : 12) + random() * (barnOpening ? 48 : 84)),
          h = 6 + random() * 8;
        const x = p.x + nx * offset,
          z = p.z + nz * offset,
          y = p.y + terrainRise(s, offset) - 0.38;
        put(trunks, x, y + h * 0.31, z, 1 + random() * 0.8, h * 0.63, 1);
        for (let crown = 0; crown < 3; crown++) {
          const foliage = trees[Math.floor(random() * trees.length)];
          const spread = h * (crown === 0 ? 0 : 0.16);
          put(
            foliage,
            x + (random() - 0.5) * spread,
            y + h * (0.76 + random() * 0.14),
            z + (random() - 0.5) * spread,
            h * (0.27 + random() * 0.09),
            h * (0.29 + random() * 0.08),
            h * (0.27 + random() * 0.09),
            random() * 6.28,
          );
        }
      }
      for (let k = 0; k < (s < 340 ? 11 : 7); k++) {
        const offset = side * (6.5 + random() * 38);
        put(
          tufts,
          p.x + nx * offset,
          p.y + terrainRise(s, offset) - 0.06,
          p.z + nz * offset + (random() - 0.5) * 5,
          0.6 + random() * 1.6,
          0.5 + random() * 1.9,
          0.6 + random() * 1.5,
          random() * 6.28,
        );
      }
      if (random() < 0.33) {
        const off = side * (7 + random() * 20);
        put(
          stones,
          p.x + nx * off,
          p.y + terrainRise(s, off) - 0.03,
          p.z + nz * off,
          0.3 + random() * 1.7,
          0.25 + random(),
          0.4 + random(),
        );
      }
    }
  }
  // Roadside timber fencing appears in stretches, leaving openings at farms.
  for (let s = 18; s < COURSE_LENGTH - 18; s += 12) {
    if (Math.floor(s / 230) % 5 === 3) continue;
    const p = roadAt(s),
      q = roadAt(s + 12);
    for (const side of [-1, 1]) {
      const off = side * 9.5;
      const x = p.x + Math.cos(p.heading) * off,
        z = p.z + Math.sin(p.heading) * off;
      put(fencePosts, x, p.y + 0.49, z, 1, 1, 1);
      const xx = q.x + Math.cos(q.heading) * off,
        zz = q.z + Math.sin(q.heading) * off;
      const mx = (x + xx) / 2,
        mz = (z + zz) / 2,
        len = Math.hypot(xx - x, zz - z);
      for (const dy of [0.43, 0.85])
        put(
          rails,
          mx,
          (p.y + q.y) / 2 + dy,
          mz,
          1,
          1,
          len,
          Math.atan2(xx - x, zz - z),
        );
    }
  }
  // Simple farm buildings give the long descent readable landmarks.
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xa74232,
    roughness: 1,
  });
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0x713b2c,
    roughness: 1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x62574a,
    roughness: 1,
  });
  const cream = new THREE.MeshStandardMaterial({
    color: 0xdacba1,
    roughness: 1,
  });
  for (const s of [76, 165, 282, 590, 1080, 1530, 2080, 2650, 3050]) {
    const p = roadAt(s),
      side = s % 2 ? -1 : 1;
    const off = side * (s === 165 || s === 590 ? 19 : 29 + random() * 18);
    const group = new THREE.Group();
    group.position.set(
      p.x + Math.cos(p.heading) * off,
      p.y + terrainRise(s, off) + 0.1,
      p.z + Math.sin(p.heading) * off,
    );
    group.rotation.y =
      -Math.atan(Math.cos(s * 0.004) * 0.14 + Math.cos(s * 0.011) * 0.088) +
      (side * Math.PI) / 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(11, 6, 16), wallMat);
    body.position.y = 3;
    body.castShadow = true;
    group.add(body);
    for (const roofSide of [-1, 1]) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(7.05, 0.25, 17.8),
        roofMat,
      );
      roof.position.set(roofSide * 2.95, 8.05, 0);
      roof.rotation.z = -roofSide * 0.51;
      roof.castShadow = true;
      group.add(roof);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 4.9), plankMat);
    door.position.set(0, 2.45, 8.09);
    group.add(door);
    for (const slant of [-1, 1]) {
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 5.6, 0.08),
        cream,
      );
      brace.position.set(0, 2.45, 8.15);
      brace.rotation.z = slant * 0.62;
      group.add(brace);
    }
    for (let k = -5; k <= 5; k++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 5.8, 0.055),
        plankMat,
      );
      plank.position.set(k, 3, 8.045);
      group.add(plank);
      const backPlank = plank.clone();
      backPlank.position.z = -8.045;
      group.add(backPlank);
    }
    for (const x of [-3.5, 3.5]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.3), cream);
      window.position.set(x, 4.2, 8.08);
      group.add(window);
    }
    const loft = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.25), plankMat);
    loft.position.set(0, 7, 8.95);
    group.add(loft);
    add(group);
  }
  const signFace = (label, background = "#ead8a9", foreground = "#3f4b32") => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#634c36";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = foreground;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 58px Georgia, serif";
    ctx.fillText(label, 256, 66, 486);
    return new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      side: THREE.DoubleSide,
    });
  };
  const landmarkWood = new THREE.MeshStandardMaterial({
    color: 0x5d4830,
    roughness: 1,
  });
  const makeArch = (s, text, finish = false) => {
    const p = roadAt(s),
      group = new THREE.Group();
    group.position.set(p.x, p.y, p.z);
    group.rotation.y = -Math.atan(
      Math.cos(s * 0.004) * 0.14 + Math.cos(s * 0.011) * 0.088,
    );
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 6.4, 0.45),
        landmarkWood,
      );
      post.position.set(side * 6, 3.2, 0);
      post.castShadow = true;
      group.add(post);
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(12.5, 0.44, 0.5),
      landmarkWood,
    );
    beam.position.y = 6.2;
    group.add(beam);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 1.9),
      signFace(
        text,
        finish ? "#f4ecd5" : "#dcc597",
        finish ? "#292b27" : "#3d4a32",
      ),
    );
    sign.position.y = 5.1;
    group.add(sign);
    add(group);
  };
  makeArch(23, "HOLLOW RUN");
  makeArch(3205, "FINISH", true);
  const whiteFinish = new THREE.MeshBasicMaterial({
    color: 0xf4f0dd,
    side: THREE.DoubleSide,
  });
  const darkFinish = new THREE.MeshBasicMaterial({
    color: 0x242521,
    side: THREE.DoubleSide,
  });
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 16; col++) {
      const s = 3208 + row * 0.55,
        p = roadAt(s);
      const dx = Math.cos(s * 0.004) * 0.14 + Math.cos(s * 0.011) * 0.088,
        n = Math.hypot(1, dx);
      const lateral = (col - 7.5) * 0.56;
      const square = new THREE.Mesh(
        new THREE.PlaneGeometry(0.57, 0.57),
        (row + col) % 2 ? whiteFinish : darkFinish,
      );
      square.rotation.x = -Math.PI / 2;
      square.rotation.z = -Math.atan(dx);
      square.position.set(
        p.x + lateral / n,
        p.y + 0.035,
        p.z + (lateral * dx) / n,
      );
      add(square);
    }
  for (const [s, label] of [
    [570, "↓  2.5 KM"],
    [1580, "↓  1.5 KM"],
    [2580, "↓  0.5 KM"],
  ]) {
    const p = roadAt(s),
      group = new THREE.Group();
    group.position.set(
      p.x + Math.cos(p.heading) * -7.3,
      p.y,
      p.z + Math.sin(p.heading) * -7.3,
    );
    group.rotation.y = -Math.atan(
      Math.cos(s * 0.004) * 0.14 + Math.cos(s * 0.011) * 0.088,
    );
    const stake = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.4, 0.18),
      landmarkWood,
    );
    stake.position.y = 1.2;
    group.add(stake);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      signFace(label),
    );
    face.position.y = 2.25;
    group.add(face);
    add(group);
  }
  for (const mesh of [...trees, trunks, tufts, fencePosts, rails, stones])
    mesh.instanceMatrix.needsUpdate = true;

  const sun = new THREE.DirectionalLight(0xffe4ad, 2.1);
  sun.position.set(-80, 140, -130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  add(sun);
  add(new THREE.HemisphereLight(0xb5d3ed, 0x77804a, 1.7));
  scene.background = new THREE.Color(0xa8ccdc);
  scene.fog = new THREE.FogExp2(0xa8ccdc, 0.0013);
  return {
    length: COURSE_LENGTH,
    roadAt,
    surfaceAt,
    objects,
    dispose() {
      for (const object of objects) scene.remove(object);
    },
  };
}
