// Small renderer polish layer. The terrain geometry and its physics live in scene.js.
export function setupGraphics(THREE, renderer, scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let seed = 72931;
  const random = () =>
    (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  const clampByte = value => Math.max(0, Math.min(255, value));
  // Scene ribbon UVs run across the entire road in U and 0..1 along 3218 m in V.
  // Two hundred repeats put one tile every 16 m, so gravel does not stretch.
  function soilMaps(size, rutted) {
    const makeCanvas = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; return canvas; };
    const colorCanvas = makeCanvas(), normalCanvas = makeCanvas(), roughCanvas = makeCanvas();
    const colorContext = colorCanvas.getContext('2d'), normalContext = normalCanvas.getContext('2d'), roughContext = roughCanvas.getContext('2d');
    const colorImage = colorContext.createImageData(size, size);
    const normalImage = normalContext.createImageData(size, size);
    const roughImage = roughContext.createImageData(size, size);
    const height = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = 8 * Math.sin(v * Math.PI * 8 + Math.sin(u * 11) * .9) + 5 * Math.sin(u * 23 + v * 17);
      const grain = (random() - .5) * 40;
      let groove = 0, tread = 0;
      if (rutted) for (const center of [.275, .725]) {
        const meander = .009 * Math.sin(v * Math.PI * 8 + center * 19);
        const distance = Math.abs(u - center - meander);
        groove += Math.exp(-Math.pow(distance / .058, 2));
        tread += Math.exp(-Math.pow(distance / .043, 2)) * Math.pow(Math.sin(v * Math.PI * 46 + u * 14), 8);
      }
      const pebble = random() < .026 ? 28 + random() * 36 : 0;
      const value = 177 + broad + grain + pebble - groove * 43 - tread * 10;
      const i = (y * size + x) * 4;
      colorImage.data[i] = clampByte(value + 11);
      colorImage.data[i + 1] = clampByte(value + 1);
      colorImage.data[i + 2] = clampByte(value - 14);
      colorImage.data[i + 3] = 255;
      height[y * size + x] = broad * .25 + grain * .28 + pebble * .34 - groove * 12 - tread * 5;
      const rough = clampByte(218 + grain * .5 - groove * 24 - pebble * .8);
      roughImage.data[i] = roughImage.data[i + 1] = roughImage.data[i + 2] = rough;
      roughImage.data[i + 3] = 255;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const left = height[y * size + (x + size - 1) % size], right = height[y * size + (x + 1) % size];
      const up = height[((y + size - 1) % size) * size + x], down = height[((y + 1) % size) * size + x];
      const i = (y * size + x) * 4;
      normalImage.data[i] = clampByte(128 + (left - right) * .75);
      normalImage.data[i + 1] = clampByte(128 + (up - down) * .75);
      normalImage.data[i + 2] = 245;
      normalImage.data[i + 3] = 255;
    }
    colorContext.putImageData(colorImage, 0, 0);
    normalContext.putImageData(normalImage, 0, 0);
    roughContext.putImageData(roughImage, 0, 0);
    const textures = [colorCanvas, normalCanvas, roughCanvas].map(canvas => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 200);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return texture;
    });
    textures[0].colorSpace = THREE.SRGBColorSpace;
    return textures;
  }
  const [texture, dirtNormal, dirtRoughness] = soilMaps(512, true);
  const [shoulderTexture, shoulderNormal, shoulderRoughness] = soilMaps(256, false);
  const road = scene.children.find(
    (object) => object.isMesh && object.material?.color?.getHex() === 0x927450,
  );
  if (road) {
    road.material.map = texture;
    road.material.normalMap = dirtNormal;
    road.material.roughnessMap = dirtRoughness;
    road.material.normalScale.set(.48, .48);
    road.material.color.setHex(0xd2b895);
    road.material.needsUpdate = true;
    road.receiveShadow = true;
  }
  const shoulders = scene.children.filter(object => object.isMesh && object.material?.color?.getHex() === 0x8a7959);
  for (const shoulder of shoulders) {
    shoulder.material.map = shoulderTexture;
    shoulder.material.normalMap = shoulderNormal;
    shoulder.material.roughnessMap = shoulderRoughness;
    shoulder.material.normalScale.set(.33, .33);
    // Keep the base color recognized by weather stage material switching.
    shoulder.material.color.setHex(0x8a7959);
    shoulder.material.needsUpdate = true;
  }

  // Break up the distant fields as well as the road: dry grass, earth and moss.
  const fieldCanvas = document.createElement("canvas");
  fieldCanvas.width = fieldCanvas.height = 256;
  const fieldContext = fieldCanvas.getContext("2d");
  const fieldImage = fieldContext.createImageData(256,256);
  for (let y=0;y<256;y++) for(let x=0;x<256;x++) {
    const patch = Math.sin(x*.05 + Math.sin(y*.04)*2)*Math.cos(y*.07) + .4*Math.sin(x*.17+y*.13);
    const grain = (random()-.5)*26;
    const i=(y*256+x)*4;
    fieldImage.data[i]=112+patch*17+grain;
    fieldImage.data[i+1]=125+patch*12+grain;
    fieldImage.data[i+2]=82+patch*11+grain;
    fieldImage.data[i+3]=255;
  }
  fieldContext.putImageData(fieldImage,0,0);
  const fieldTexture = new THREE.CanvasTexture(fieldCanvas);
  fieldTexture.colorSpace = THREE.SRGBColorSpace;
  fieldTexture.wrapS=fieldTexture.wrapT=THREE.RepeatWrapping;
  fieldTexture.repeat.set(3,150);
  fieldTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  for(const mesh of scene.children) if(mesh.isMesh && mesh.material?.vertexColors && mesh.material.color?.getHex()===0xffffff) {
    mesh.material.map=fieldTexture;
    mesh.material.needsUpdate=true;
  }

  const sun = scene.children.find((object) => object.isDirectionalLight);
  if (sun) {
    sun.color.setHex(0xffb475);
    sun.intensity = 2.6;
    sun.position.set(-170, 72, -95);
    sun.shadow.bias = -0.00045;
    sun.shadow.normalBias = 0.025;
  }
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 512;
  skyCanvas.height = 256;
  const sky = skyCanvas.getContext("2d");
  const gradient = sky.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#7387a4");
  gradient.addColorStop(0.48, "#c8a6a0");
  gradient.addColorStop(0.76, "#f3bd87");
  gradient.addColorStop(1, "#c8a593");
  sky.fillStyle = gradient;
  sky.fillRect(0, 0, 512, 256);
  const halo = sky.createRadialGradient(312, 164, 4, 312, 164, 86);
  halo.addColorStop(0, "rgba(255,239,179,.95)");
  halo.addColorStop(0.12, "rgba(255,210,145,.55)");
  halo.addColorStop(1, "rgba(255,184,126,0)");
  sky.fillStyle = halo;
  sky.fillRect(220, 70, 184, 184);
  sky.fillStyle = "#fff0bd";
  sky.beginPath();
  sky.arc(312, 164, 9, 0, Math.PI * 2);
  sky.fill();
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = skyTexture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(skyTexture);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  scene.fog = new THREE.FogExp2(0xb9a9a1, 0.00145);

  // Hazard ribbons share materials today; collect distinct instances so every
  // visible patch still receives the effect if the scene stops sharing them.
  const hazardMaterials = (color) => [
    ...new Set(
      scene.children
        .filter((object) => object.isMesh)
        .flatMap((object) =>
          Array.isArray(object.material) ? object.material : [object.material],
        )
        .filter((material) => material?.color?.getHex() === color),
    ),
  ];
  const waterMaterials = hazardMaterials(0x557178);
  const waterTime = { value: 0 };
  const priorWaterShaders = waterMaterials.map(
    (material) => material.onBeforeCompile,
  );
  waterMaterials.forEach((material) => {
    material.roughness = 0.18;
    material.metalness = 0.05;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = waterTime;
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec3 vWaterWorld;\nvoid main() {")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\n vWaterWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          "uniform float uWaterTime;\nvarying vec3 vWaterWorld;\nvoid main() {",
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          float wx = vWaterWorld.x * 1.9 + uWaterTime * 1.4;
          float wz = vWaterWorld.z * 1.25 - uWaterTime * .85;
          normal = normalize(normal + vec3(cos(wx) * .12, 0.0, sin(wz) * .12));`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + .12 * sin(vWaterWorld.x * 1.7 + uWaterTime) * sin(vWaterWorld.z * 2.1 - uWaterTime * .6), .08, .48);`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          diffuseColor.rgb += .055 * sin(vWaterWorld.x * 2.1 + uWaterTime * 2.0) * sin(vWaterWorld.z * 1.5 - uWaterTime);`,
        );
    };
    material.customProgramCacheKey = () => "animated-water-v1";
    material.needsUpdate = true;
  });
  const mudMaterials = hazardMaterials(0x463b2b);
  const priorMudShaders = mudMaterials.map(
    (material) => material.onBeforeCompile,
  );
  mudMaterials.forEach((material) => {
    material.roughness = 0.76;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec3 vMudWorld;\nvoid main() {")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\n vMudWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying vec3 vMudWorld;\nvoid main() {")
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          normal = normalize(normal + vec3(sin(vMudWorld.x * 3.1) * .09, 0.0, cos(vMudWorld.z * 2.7) * .09));`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + sin(vMudWorld.x * 2.7) * sin(vMudWorld.z * 1.9) * .16, .5, .96);`,
        );
    };
    material.customProgramCacheKey = () => "varied-mud-v1";
    material.needsUpdate = true;
  });

  const headlight = new THREE.SpotLight(
    0xffead2,
    18,
    34,
    Math.PI / 9,
    0.65,
    1.2,
  );
  headlight.visible = false;
  headlight.castShadow = false;
  scene.add(headlight);
  scene.add(headlight.target);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 0.08, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe6b4,
      transparent: true,
      opacity: 0.025,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.visible = false;
  scene.add(beam);
  const beamDirection = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const origin = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, -1);
  const swaying = scene.children.filter(
    (object) =>
      object.isInstancedMesh && object.geometry?.type === "ConeGeometry",
  );
  const wind = { value: 0 };
  const priorShaders = swaying.map((object) => object.material.onBeforeCompile);
  swaying.forEach((object) => {
    object.material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = wind;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <begin_vertex>",
          `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float gust = sin(uWindTime * 1.3 + instanceMatrix[3].x * 0.17 + instanceMatrix[3].z * 0.11);
          transformed.x += gust * max(0.0, transformed.y) * 0.055;
        #endif
      `,
        )
        .replace("void main() {", "uniform float uWindTime;\nvoid main() {");
    };
    object.material.customProgramCacheKey = () => "wind-v1";
    object.material.needsUpdate = true;
  });
  const splash = document.createElement("canvas");
  splash.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:3";
  document.body.appendChild(splash);
  const splashContext = splash.getContext("2d");
  const drops = [];
  let lastSplash = -10;
  const flagBases = new WeakMap();
  return {
    update(time = 0, speed = 0, car = null, surface = null) {
      wind.value = time;
      waterTime.value = time;
      const type = typeof surface === "string" ? surface : surface?.type;
      const width = splash.clientWidth,
        height = splash.clientHeight;
      if (
        width &&
        height &&
        (splash.width !== width || splash.height !== height)
      ) {
        splash.width = width;
        splash.height = height;
      }
      if (splashContext && width && height) {
        if (
          (type === "water" || type === "mud") &&
          Math.abs(speed) > 9 &&
          time - lastSplash > 0.17
        ) {
          lastSplash = time;
          const amount = Math.min(7, Math.floor(Math.abs(speed) / 8));
          for (let i = 0; i < amount; i++)
            drops.push({
              x: random() * width,
              y: height * (0.5 + random() * 0.38),
              r: 2 + random() * 7,
              life: 1,
              color: type === "mud" ? "91,70,48" : "178,211,216",
            });
        }
        splashContext.clearRect(0, 0, width, height);
        for (let i = drops.length - 1; i >= 0; i--) {
          const drop = drops[i];
          drop.life -= 0.025;
          if (drop.life <= 0) {
            drops.splice(i, 1);
            continue;
          }
          splashContext.fillStyle = `rgba(${drop.color},${drop.life * 0.25})`;
          splashContext.beginPath();
          splashContext.ellipse(
            drop.x,
            drop.y,
            drop.r,
            drop.r * 1.8,
            0.3,
            0,
            Math.PI * 2,
          );
          splashContext.fill();
        }
      }
      const point = car?.position ?? car?.mesh?.position;
      if (!point) {
        headlight.visible = false;
        beam.visible = false;
        return;
      }
      if (sun) {
        sun.position.set(point.x - 170, point.y + 72, point.z - 95);
        sun.target.position.copy(point);
        sun.target.updateMatrixWorld();
      }
      headlight.visible = !!car?.userData?.headlight?.visible;
      beam.visible = headlight.visible;
      const cloth = car?.userData?.flag?.userData?.cloth;
      if (cloth) {
        if (!flagBases.has(cloth)) {
          const oldGeometry = cloth.geometry;
          cloth.geometry = new THREE.PlaneGeometry(0.47, 0.31, 12, 4);
          cloth.geometry.translate(0.235, 0, 0);
          oldGeometry.dispose();
          flagBases.set(
            cloth,
            Float32Array.from(cloth.geometry.attributes.position.array),
          );
        }
        const positions = cloth.geometry.attributes.position;
        const base = flagBases.get(cloth);
        const strength = Math.min(1, Math.abs(speed) / 25);
        for (let i = 0; i < positions.count; i++) {
          const x = base[i * 3],
            y = base[i * 3 + 1],
            tail = Math.max(0, x) / 0.47;
          positions.setX(i, x * (1 + strength * 0.2));
          positions.setZ(
            i,
            Math.sin(time * (3 + Math.abs(speed) * 0.6) + x * 18 + y * 8) *
              (0.02 + strength * 0.08) *
              tail,
          );
        }
        positions.needsUpdate = true;
        cloth.geometry.computeVertexNormals();
      }
      origin.copy(point);
      headlight.position.copy(origin).add(new THREE.Vector3(0, 0.65, 0));
      forward.set(0, -0.08, -1);
      const quaternion = car?.quaternion ?? car?.mesh?.quaternion;
      if (quaternion) forward.applyQuaternion(quaternion);
      headlight.target.position
        .copy(headlight.position)
        .addScaledVector(forward, 20);
      headlight.intensity = 13 + Math.min(8, Math.abs(speed) * 0.1);
      beamDirection.copy(forward).normalize();
      beam.position.copy(headlight.position).addScaledVector(beamDirection, 11);
      beam.quaternion.setFromUnitVectors(up, beamDirection);
    },
    dispose() {
      fieldTexture.dispose();
      scene.remove(headlight, headlight.target);
      scene.remove(beam);
      beam.geometry.dispose();
      beam.material.dispose();
      headlight.dispose();
      texture.dispose();
      dirtNormal.dispose();
      dirtRoughness.dispose();
      shoulderTexture.dispose();
      shoulderNormal.dispose();
      shoulderRoughness.dispose();
      skyTexture.dispose();
      envTarget.dispose();
      scene.environment = null;
      splash.remove();
      if (road) {
        road.material.map = null;
        road.material.normalMap = null;
        road.material.roughnessMap = null;
        road.material.needsUpdate = true;
      }
      for (const shoulder of shoulders) {
        shoulder.material.map = null;
        shoulder.material.normalMap = null;
        shoulder.material.roughnessMap = null;
        shoulder.material.needsUpdate = true;
      }
      waterMaterials.forEach((material, i) => {
        material.onBeforeCompile = priorWaterShaders[i];
        material.needsUpdate = true;
      });
      mudMaterials.forEach((material, i) => {
        material.onBeforeCompile = priorMudShaders[i];
        material.needsUpdate = true;
      });
      swaying.forEach((object, i) => {
        object.material.onBeforeCompile = priorShaders[i];
        object.material.needsUpdate = true;
      });
    },
  };
}
