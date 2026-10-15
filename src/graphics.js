// Small renderer polish layer. The terrain geometry and its physics live in scene.js.
export function setupGraphics(THREE, renderer, scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(256, 256);
  let seed = 72931;
  const random = () =>
    (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 122 + Math.floor(random() * 42);
    image.data[i] = v + 12;
    image.data[i + 1] = v - 2;
    image.data[i + 2] = v - 24;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  // Two broad, irregular wheel ruts make the track read as used earth at speed.
  for (const x of [72, 184]) {
    const rut = ctx.createLinearGradient(x - 19, 0, x + 19, 0);
    rut.addColorStop(0, "rgba(52,37,25,0)");
    rut.addColorStop(0.48, "rgba(52,37,25,.26)");
    rut.addColorStop(0.52, "rgba(52,37,25,.26)");
    rut.addColorStop(1, "rgba(52,37,25,0)");
    ctx.fillStyle = rut;
    ctx.fillRect(x - 19, 0, 38, 256);
  }
  for (let i = 0; i < 170; i++) {
    ctx.fillStyle =
      random() < 0.5 ? "rgba(58,45,31,.16)" : "rgba(238,211,165,.13)";
    ctx.beginPath();
    ctx.ellipse(
      random() * 256,
      random() * 256,
      1 + random() * 8,
      0.5 + random() * 3,
      random() * 6.28,
      0,
      6.28,
    );
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 50);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = 256;
  const normalContext = normalCanvas.getContext("2d");
  const normalImage = normalContext.createImageData(256, 256);
  for (let i = 0; i < normalImage.data.length; i += 4) {
    normalImage.data[i] = 112 + random() * 32;
    normalImage.data[i + 1] = 112 + random() * 32;
    normalImage.data[i + 2] = 242;
    normalImage.data[i + 3] = 255;
  }
  normalContext.putImageData(normalImage, 0, 0);
  const dirtNormal = new THREE.CanvasTexture(normalCanvas);
  dirtNormal.wrapS = dirtNormal.wrapT = THREE.RepeatWrapping;
  dirtNormal.repeat.copy(texture.repeat);
  const road = scene.children.find(
    (object) => object.isMesh && object.material?.color?.getHex() === 0x927450,
  );
  if (road) {
    road.material.map = texture;
    road.material.normalMap = dirtNormal;
    road.material.normalScale.set(0.62, 0.62);
    road.material.color.setHex(0xd2b895);
    road.material.needsUpdate = true;
    road.receiveShadow = true;
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
      scene.remove(headlight, headlight.target);
      scene.remove(beam);
      beam.geometry.dispose();
      beam.material.dispose();
      headlight.dispose();
      texture.dispose();
      dirtNormal.dispose();
      skyTexture.dispose();
      envTarget.dispose();
      scene.environment = null;
      splash.remove();
      if (road) {
        road.material.map = null;
        road.material.needsUpdate = true;
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
