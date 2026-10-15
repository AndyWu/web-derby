// Four reference-inspired soapbox racers. Front is local -Z and the driver's
// camera sits at (0, 1.55, .8). Geometry is deliberately built from individual
// salvage components so their silhouettes survive at garage thumbnail scale.

function decal(THREE, text, background = "#e7d69d", ink = "#493922") {
  if (typeof document === "undefined")
    return new THREE.MeshBasicMaterial({
      color: 0xe7d69d,
      side: THREE.DoubleSide,
    });
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 8;
  ctx.strokeRect(7, 7, 498, 114);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${text.length > 10 ? 51 : 65}px Georgia, serif`;
  ctx.fillText(text, 256, 67);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
}

export function createReferenceVehicle(THREE, id, cockpit, spec) {
  const group = new THREE.Group();
  group.name = spec.name;
  const material = (color, metalness = 0, roughness = 0.88) =>
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      side: THREE.DoubleSide,
    });
  const timber = material(0xa87943),
    plank = material(0xc49a60),
    edge = material(0x644a2e);
  const iron = material(0x555b5a, 0.63, 0.61),
    chrome = material(0xa4a5a0, 0.72, 0.48);
  const rubber = material(0x242825),
    seatMat = material(0x4f3e34),
    brass = material(0xb38d42, 0.5);
  const red = material(0xb92e32, 0.22, 0.6),
    yellow = material(0xeec73d, 0.1, 0.62);
  const blue = material(0x1677c6, 0.12, 0.45),
    blueDark = material(0x155296, 0.12, 0.61);
  const add = (geometry, mat, x, y, z, parent = group) => {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (w, h, d, m, x, y, z, p) =>
    add(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
  const cylinder = (radius, depth, m, x, y, z, segments = 14, p) =>
    add(
      new THREE.CylinderGeometry(radius, radius, depth, segments),
      m,
      x,
      y,
      z,
      p,
    );
  const rod = (a, b, r, m, p = group) => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const object = add(
      new THREE.CylinderGeometry(r, r, start.distanceTo(end), 7),
      m,
      ...start.clone().add(end).multiplyScalar(0.5).toArray(),
      p,
    );
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    return object;
  };
  const plate = (text, w, h, x, y, z, rotationY = 0, bg, ink) => {
    const object = add(
      new THREE.PlaneGeometry(w, h),
      decal(THREE, text, bg, ink),
      x,
      y,
      z,
    );
    object.rotation.y = rotationY;
    return object;
  };
  function wheel(x, z, r, spoked = false) {
    // Torus rim and individually modeled metal spokes evoke bicycle wheels.
    if (spoked) {
      const rim = add(
        new THREE.TorusGeometry(r - 0.025, 0.045, 8, 24),
        rubber,
        x,
        r,
        z,
      );
      rim.rotation.y = Math.PI / 2;
      const metalRim = add(
        new THREE.TorusGeometry(r - 0.06, 0.012, 6, 24),
        chrome,
        x,
        r,
        z,
      );
      metalRim.rotation.y = Math.PI / 2;
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        rod(
          [x, r, z],
          [x, r + Math.sin(a) * (r - 0.07), z + Math.cos(a) * (r - 0.07)],
          0.007,
          chrome,
        );
      }
    } else {
      const tire = cylinder(r, 0.14, rubber, x, r, z, 20);
      tire.rotation.z = Math.PI / 2;
      const hub = cylinder(r * 0.36, 0.16, iron, x, r, z, 12);
      hub.rotation.z = Math.PI / 2;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        rod(
          [x, r, z],
          [x, r + Math.sin(a) * r * 0.7, z + Math.cos(a) * r * 0.7],
          0.024,
          chrome,
        );
      }
    }
    const nut = cylinder(0.045, 0.19, brass, x, r, z, 8);
    nut.rotation.z = Math.PI / 2;
  }
  function axles(zFront, zRear, halfWidth, r, spoked = false) {
    for (const z of [zFront, zRear]) {
      rod([-halfWidth, 0.43, z], [halfWidth, 0.43, z], 0.055, iron);
      for (const side of [-1, 1]) wheel(side * halfWidth, z, r, spoked);
    }
  }
  function steering() {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 1.12, -0.34);
    group.add(wheelGroup);
    rod([0, 1.12, -0.35], [0, 0.93, -0.68], 0.034, iron);
    const rim = add(
      new THREE.TorusGeometry(0.25, 0.032, 8, 22),
      rubber,
      0,
      0,
      0,
      wheelGroup,
    );
    rim.rotation.x = -0.25;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3;
      rod(
        [0, 0, 0],
        [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0],
        0.017,
        chrome,
        wheelGroup,
      );
    }
    cylinder(0.06, 0.07, brass, 0, 0, 0.02, 10, wheelGroup).rotation.x =
      Math.PI / 2;
    return wheelGroup;
  }
  // All four reference vehicles expose the same playable controls.
  const steeringWheel = steering();
  const paddles = [];
  for (const side of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(side * 0.42, 0.42, -0.43);
    group.add(p);
    rod([0, 0, 0], [0, -0.11, -0.21], 0.022, iron, p);
    box(0.2, 0.04, 0.25, plank, 0, -0.13, -0.23, p);
    const arrow = add(
      new THREE.PlaneGeometry(0.17, 0.075),
      decal(THREE, "PUSH"),
      0,
      -0.104,
      -0.22,
      p,
    );
    arrow.rotation.x = -Math.PI / 2;
    paddles.push(p);
  }
  const brake = new THREE.Group();
  brake.position.set(0.13, 0.41, -0.7);
  group.add(brake);
  rod([0, 0, 0], [0, -0.09, -0.1], 0.022, iron, brake);
  box(0.17, 0.04, 0.15, rubber, 0, -0.11, -0.11, brake);
  const gear = new THREE.Group();
  gear.position.set(0.63, 0.56, -0.32);
  group.add(gear);
  rod([0, 0, 0], [0.04, 0.4, -0.06], 0.022, chrome, gear);
  add(new THREE.SphereGeometry(0.075, 10, 8), seatMat, 0.04, 0.4, -0.06, gear);
  // Small front lamps keep the common lighting interaction readable.
  for (const side of [-1, 1]) {
    const housing = cylinder(0.105, 0.1, brass, side * 0.62, 0.84, -1.82);
    housing.rotation.x = Math.PI / 2;
    plate("", 0.16, 0.16, side * 0.62, 0.84, -1.89, 0, "#f5e8b5", "#f5e8b5");
    if (id === 1 || id === 2) {
      // The open-frame racers need visible stalks rather than hovering lamps.
      rod([side * 0.62, 0.47, -1.69], [side * 0.62, 0.79, -1.82], 0.023, iron);
      rod(
        [side * 0.62, 0.58, -1.72],
        [side * 0.45, 0.44, -1.57],
        0.016,
        chrome,
      );
    }
  }
  const headlight = new THREE.SpotLight(
    0xffe9bc,
    0,
    30,
    Math.PI / 8,
    0.55,
    1.8,
  );
  headlight.position.set(0, 0.9, -1.89);
  headlight.target.position.set(0, 0.25, -13);
  group.add(headlight, headlight.target);

  if (id === 0) {
    // Skipper 14: a long raw-wood crate, angled nose and tall wire wheels.
    for (const x of [-0.65, -0.32, 0, 0.32, 0.65])
      box(0.28, 0.085, 3.32, x === 0 ? plank : timber, x, 0.49, -0.4);
    for (const side of [-1, 1]) {
      box(0.075, 0.54, 2.66, plank, side * 0.76, 0.78, -0.22);
      for (const z of [-1.36, -0.78, -0.2, 0.38, 0.97])
        box(0.1, 0.54, 0.045, edge, side * 0.765, 0.78, z);
      rod([side * 0.77, 1.03, -1.5], [side * 0.47, 0.68, -2.02], 0.06, timber);
      box(0.07, 0.33, 0.54, plank, side * 0.57, 0.69, -1.76).rotation.y =
        side * 0.52;
    }
    box(1.52, 0.08, 0.21, edge, 0, 0.47, -1.95);
    box(1.1, 0.075, 0.47, plank, 0, 0.69, -1.8).rotation.x = -0.13;
    box(1.46, 0.12, 0.13, timber, 0, 0.8, 0.89);
    box(0.92, 0.13, 0.56, seatMat, 0, 0.59, 0.48);
    box(0.85, 0.42, 0.09, plank, 0, 0.88, 0.78);
    axles(-1.53, 0.8, 1.04, 0.43, true);
    plate(
      "SKIPPER 14",
      1.58,
      0.34,
      0.81,
      0.79,
      -0.24,
      Math.PI / 2,
      "#d9bc85",
      "#302820",
    );
    plate(
      "SKIPPER 14",
      1.58,
      0.34,
      -0.81,
      0.79,
      -0.24,
      -Math.PI / 2,
      "#d9bc85",
      "#302820",
    );
  } else if (id === 1) {
    // Bare Bones: almost nothing but a beam rectangle and plywood seat.
    for (const side of [-1, 1]) {
      box(0.14, 0.13, 3.14, timber, side * 0.6, 0.44, -0.38);
      rod([side * 0.6, 0.48, -1.55], [side * 0.6, 0.48, 0.8], 0.017, edge);
    }
    for (const z of [-1.76, -0.94, 0.06, 0.89])
      box(1.39, 0.12, 0.12, plank, 0, 0.43, z);
    box(1.22, 0.09, 0.9, plank, 0, 0.53, 0.28);
    box(0.91, 0.09, 0.62, plank, 0, 0.62, 0.43);
    const back = box(0.94, 0.6, 0.075, plank, 0, 1.03, 0.72);
    back.rotation.x = -0.13;
    for (const side of [-1, 1])
      rod([side * 0.4, 0.55, 0.71], [side * 0.4, 1.33, 0.73], 0.036, timber);
    // Steering stays exposed: no heavy dashboard or nose panel.
    rod([0, 0.48, -1.69], [0, 0.91, -0.64], 0.033, iron);
    axles(-1.54, 0.83, 0.87, 0.27, false);
  } else if (id === 2) {
    // Blue Barrel: a plastic drum lies horizontally in an open timber frame.
    for (const side of [-1, 1])
      box(0.13, 0.14, 3.04, timber, side * 0.73, 0.43, -0.34);
    for (const z of [-1.76, -0.65, 0.79])
      box(1.57, 0.13, 0.14, plank, 0, 0.42, z);
    const hood = add(
      new THREE.CylinderGeometry(0.65, 0.65, 1.18, 32, 1, true),
      blue,
      0,
      0.92,
      -1.14,
    );
    hood.rotation.x = Math.PI / 2;
    // Only the rear portion is cut out for the driver; the rounded nose stays
    // a complete blue drum as in the reference.
    const cockpitShell = add(
      new THREE.CylinderGeometry(
        0.65,
        0.65,
        0.58,
        32,
        1,
        true,
        Math.PI + 0.72,
        Math.PI * 2 - 1.44,
      ),
      blue,
      0,
      0.92,
      -0.26,
    );
    cockpitShell.rotation.x = Math.PI / 2;
    box(0.92, 0.1, 0.64, seatMat, 0, 0.68, -0.14);
    const blueBack = box(0.92, 0.48, 0.08, blueDark, 0, 1.02, 0.12);
    blueBack.rotation.x = -0.17;
    const front = cylinder(0.65, 0.06, blue, 0, 0.92, -1.73, 32);
    front.rotation.x = Math.PI / 2;
    for (const z of [-1.68, -0.55, 0.03]) {
      const hoop = add(
        new THREE.TorusGeometry(0.65, 0.023, 8, 24),
        blueDark,
        0,
        0.92,
        z,
      );
    }
    box(1.52, 0.15, 0.16, plank, 0, 0.39, -1.76);
    axles(-1.63, 0.76, 1.08, 0.39, true);
  } else {
    // Sunshine Kart: low red body, yellow wedge, sideboards and playful decals.
    for (const side of [-1, 1])
      box(0.14, 0.14, 3.14, timber, side * 0.7, 0.37, -0.42);
    box(1.49, 0.16, 2.54, red, 0, 0.48, -0.39);
    for (const side of [-1, 1]) {
      box(0.24, 0.13, 2.56, yellow, side * 0.75, 0.48, -0.4);
      box(0.1, 0.35, 1.6, red, side * 0.58, 0.69, 0.27);
    }
    const wedge = box(1.41, 0.18, 0.94, yellow, 0, 0.66, -1.39);
    wedge.rotation.x = -0.17;
    box(1.04, 0.12, 0.72, seatMat, 0, 0.68, 0.35);
    const bucket = box(1.08, 0.54, 0.13, red, 0, 1.0, 0.76);
    bucket.rotation.x = -0.18;
    for (const side of [-1, 1])
      box(0.13, 0.28, 0.75, red, side * 0.55, 0.86, 0.42);
    axles(-1.56, 0.76, 0.97, 0.29, false);
    plate("GO!", 0.55, 0.26, 0, 0.78, -1.43, 0, "#f5d542", "#ab2232");
    for (const x of [-0.36, 0.36]) {
      const star = plate(
        "★",
        0.42,
        0.38,
        x,
        0.78,
        -1.31,
        0,
        "#f5d542",
        "#ba2639",
      );
      star.rotation.x = -Math.PI / 2;
    }
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 7; col++) {
        if ((row + col) % 2 === 0)
          box(
            0.13,
            0.008,
            0.12,
            edge,
            -0.39 + col * 0.13,
            0.786,
            -1.74 + row * 0.13,
          );
      }
    for (const side of [-1, 1]) {
      plate(
        "★",
        0.35,
        0.28,
        side * 0.89,
        0.63,
        -0.65,
        (side * Math.PI) / 2,
        "#f5d542",
        "#af2430",
      );
      plate(
        "GO",
        0.52,
        0.26,
        side * 0.89,
        0.63,
        0.12,
        (side * Math.PI) / 2,
        "#f5d542",
        "#af2430",
      );
    }
    for (const z of [-0.95, -0.72, -0.49])
      for (const side of [-1, 1])
        box(0.11, 0.055, 0.14, edge, side * 0.36, 0.79, z);
  }

  const flag = new THREE.Group();
  flag.position.set(0.61, 0.9, -1.82);
  group.add(flag);
  rod([0, 0, 0], [0, 0.68, 0], 0.015, chrome, flag);
  const cloth = add(
    new THREE.PlaneGeometry(0.28, 0.2, 4, 2),
    id === 3 ? yellow : red,
    0.15,
    0.56,
    0,
    flag,
  );
  flag.userData.cloth = cloth;
  group.userData = {
    wheel: steeringWheel,
    paddles,
    brake,
    gear,
    headlight,
    flag,
    stats: spec,
  };
  return group;
}
