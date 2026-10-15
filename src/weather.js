// Four visual chapters for the same continuous course. Call after setupGraphics.
export function createWeather(THREE, scene, renderer) {
  const sun = scene.children.find(object => object.isDirectionalLight);
  const hemisphere = scene.children.find(object => object.isHemisphereLight);
  const baseline = {
    background: scene.background,
    fog: scene.fog,
    environmentIntensity: scene.environmentIntensity,
    exposure: renderer.toneMappingExposure,
    sunColor: sun?.color.clone(), sunIntensity: sun?.intensity,
    skyColor: hemisphere?.color.clone(), groundColor: hemisphere?.groundColor.clone(), hemiIntensity: hemisphere?.intensity,
  };
  const materials = [...new Set(scene.children.flatMap(object => object.isMesh || object.isInstancedMesh
    ? Array.isArray(object.material) ? object.material : [object.material] : []))];
  const original = new Map(materials.map(material => [material, {
    color: material.color?.clone(), map: material.map, roughness: material.roughness,
    metalness: material.metalness, vertexColors: material.vertexColors,
  }]));
  const colorOf = material => original.get(material)?.color?.getHex();
  const terrainColors = new Set([0x927450, 0xd2b895, 0x8a7959, 0xffffff, 0x789342]);
  const foliageColors = new Set([0x526e33, 0x67813a, 0x486833, 0x718946]);

  function skyTexture(top, bottom, moon = false, stars = false) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, top); gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 256);
    let seed = 1947;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    if (stars) for (let i = 0; i < 130; i++) {
      const x = rand() * 512, y = rand() * 155, r = .3 + rand() * 1.25;
      ctx.fillStyle = `rgba(227,239,255,${.25 + rand() * .65})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (moon) {
      const glow = ctx.createRadialGradient(338, 75, 3, 338, 75, 55);
      glow.addColorStop(0, 'rgba(207,228,251,.44)'); glow.addColorStop(1, 'rgba(207,228,251,0)');
      ctx.fillStyle = glow; ctx.fillRect(280, 17, 116, 116);
      ctx.fillStyle = '#e0e9f2'; ctx.beginPath(); ctx.arc(338, 75, 12, 0, Math.PI * 2); ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }
  const backgrounds = [null,
    skyTexture('#8294a9', '#dce7ed'),
    skyTexture('#061322', '#1c3551', true, true),
    skyTexture('#283947', '#8498a0'),
  ];

  const flakeCanvas = document.createElement('canvas'); flakeCanvas.width = flakeCanvas.height = 32;
  const flakeContext = flakeCanvas.getContext('2d');
  const flakeGlow = flakeContext.createRadialGradient(16, 16, 1, 16, 16, 15);
  flakeGlow.addColorStop(0, 'rgba(255,255,255,1)'); flakeGlow.addColorStop(.45, 'rgba(255,255,255,.8)');
  flakeGlow.addColorStop(1, 'rgba(255,255,255,0)');
  flakeContext.fillStyle = flakeGlow; flakeContext.fillRect(0, 0, 32, 32);
  const flakeTexture = new THREE.CanvasTexture(flakeCanvas);
  let seed = 73891;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const snowCount = 560, rainCount = 620;
  const snowSeeds = Array.from({ length: snowCount }, () => [random(), random(), random(), random()]);
  const rainSeeds = Array.from({ length: rainCount }, () => [random(), random(), random(), random()]);
  const snowPositions = new Float32Array(snowCount * 3);
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snow = new THREE.Points(snowGeometry, new THREE.PointsMaterial({
    color: 0xffffff, size: .48, map: flakeTexture, transparent: true, opacity: .85,
    depthWrite: false, sizeAttenuation: true,
  }));
  snow.frustumCulled = false; snow.visible = false; scene.add(snow);
  const rainPositions = new Float32Array(rainCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({
    color: 0xb9d0dc, transparent: true, opacity: .35, depthWrite: false,
  }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  let stage = -1;
  function setStage(index) {
    index = Math.max(0, Math.min(3, Math.floor(index) || 0));
    if (stage === index) return;
    stage = index;
    for (const [material, saved] of original) {
      if (saved.color) material.color.copy(saved.color);
      if ('map' in material) material.map = saved.map;
      if ('roughness' in material) material.roughness = saved.roughness;
      if ('metalness' in material) material.metalness = saved.metalness;
      material.vertexColors = saved.vertexColors;
      const base = colorOf(material);
      if (index === 1) {
        if (terrainColors.has(base)) {
          material.color.setHex(base === 0xd2b895 || base === 0x927450 ? 0xdde4e5 : 0xeaf0ed);
          material.map = null;
          material.vertexColors = false;
          material.roughness = .94;
        } else if (foliageColors.has(base)) material.color.setHex(0xbacdc1);
      } else if (index === 2) {
        if (terrainColors.has(base)) material.color.multiplyScalar(.48);
        else if (foliageColors.has(base)) material.color.multiplyScalar(.34);
      } else if (index === 3) {
        if (terrainColors.has(base)) { material.color.multiplyScalar(.52); material.roughness = .52; }
        else if (foliageColors.has(base)) material.color.multiplyScalar(.7);
        if (base === 0x557178 || base === 0x463b2b) material.roughness = .16;
      }
      material.needsUpdate = true;
    }
    scene.background = index ? backgrounds[index] : baseline.background;
    // The shared sunset reflection probe is useful in daylight, but would make
    // night and storm materials glow warm against their colder skies.
    scene.environmentIntensity = [baseline.environmentIntensity, .35, .07, .18][index];
    const fogColors = [null, 0xc5d2da, 0x132337, 0x647a85];
    const fogDensity = [0, .0024, .0028, .0042];
    scene.fog = index ? new THREE.FogExp2(fogColors[index], fogDensity[index]) : baseline.fog;
    renderer.toneMappingExposure = [baseline.exposure, 1.3, .98, 1.12][index];
    if (sun) {
      sun.color.setHex([0, 0xe7f0ff, 0x84a3d0, 0xaabac4][index] || 0xffffff);
      sun.intensity = [baseline.sunIntensity, 1.7, .58, .75][index];
      if (!index) sun.color.copy(baseline.sunColor);
    }
    if (hemisphere) {
      hemisphere.color.setHex([0, 0xdfeeff, 0x365780, 0x899da9][index] || 0xffffff);
      hemisphere.groundColor.setHex([0, 0xa7b6b9, 0x142238, 0x34464d][index] || 0xffffff);
      hemisphere.intensity = [baseline.hemiIntensity, 1.55, .92, 1.12][index];
      if (!index) { hemisphere.color.copy(baseline.skyColor); hemisphere.groundColor.copy(baseline.groundColor); }
    }
    snow.visible = index === 1; rain.visible = index === 3;
  }

  function update(time = 0, carPosition = null) {
    if (!carPosition) return;
    const x = carPosition.x ?? 0, y = carPosition.y ?? 0, z = carPosition.z ?? 0;
    if (stage === 1) {
      for (let i = 0; i < snowCount; i++) {
        const [a, b, c, d] = snowSeeds[i], j = i * 3;
        snowPositions[j] = x + (a - .5) * 74 + Math.sin(time * .8 + d * 15) * 1.4;
        snowPositions[j + 1] = y - 3 + ((b * 29 - time * (2 + d * 2)) % 29 + 29) % 29;
        snowPositions[j + 2] = z + (c - .5) * 86;
      }
      snowGeometry.attributes.position.needsUpdate = true;
    } else if (stage === 3) {
      for (let i = 0; i < rainCount; i++) {
        const [a, b, c, d] = rainSeeds[i], j = i * 6;
        const px = x + (a - .5) * 60, py = y - 3 + ((b * 26 - time * 32) % 26 + 26) % 26;
        const pz = z + (c - .5) * 74;
        rainPositions[j] = px; rainPositions[j + 1] = py; rainPositions[j + 2] = pz;
        rainPositions[j + 3] = px - 0.35 - d * .3; rainPositions[j + 4] = py - 1.8; rainPositions[j + 5] = pz + .15;
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
  }
  setStage(0);
  return {
    setStage, update,
    dispose() {
      setStage(0);
      scene.remove(snow, rain);
      snowGeometry.dispose(); snow.material.dispose(); rainGeometry.dispose(); rain.material.dispose();
      flakeTexture.dispose(); backgrounds.slice(1).forEach(texture => texture.dispose());
    },
  };
}
