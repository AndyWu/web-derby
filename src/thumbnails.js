// Render the actual vehicle meshes once for the garage cards. The game and
// thumbnail scene share a renderer, so every state we change is restored.
export function createVehicleThumbnails(THREE, renderer, createVehicle, count) {
  const width = 220,
    height = 130;
  const previousSize = renderer.getSize(new THREE.Vector2());
  const previousRatio = renderer.getPixelRatio();
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousAlpha = renderer.getClearAlpha();
  const previousAutoClear = renderer.autoClear;
  const previousShadow = renderer.shadowMap.enabled;
  const previousExposure = renderer.toneMappingExposure;
  const previousViewport = renderer.getViewport(new THREE.Vector4());
  const previousScissor = renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = renderer.getScissorTest();
  const thumbnails = [];
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    renderer.shadowMap.enabled = false;
    renderer.toneMappingExposure = Math.max(previousExposure, 1.55);
    renderer.setClearColor(0xb5c5ab, 1);
    for (let index = 0; index < count; index++) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xb5c5ab);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9b9b77, 3.2));
      const sun = new THREE.DirectionalLight(0xfff0cc, 3.4);
      sun.position.set(-3, 7, -5);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xd5e6ff, 2.2);
      fill.position.set(4, 4, 3);
      scene.add(fill);
      const vehicle = createVehicle(THREE, index, false);
      scene.add(vehicle);
      const camera = new THREE.OrthographicCamera(
        -2.22,
        2.22,
        1.31,
        -1.31,
        0.1,
        30,
      );
      camera.position.set(3.2, 2.65, -4.3);
      camera.lookAt(0, 0.91, -0.43);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      thumbnails.push(renderer.domElement.toDataURL("image/png"));
      scene.remove(vehicle);
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      vehicle.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const entries = Array.isArray(object.material)
          ? object.material
          : object.material
            ? [object.material]
            : [];
        for (const material of entries) materials.add(material);
      });
      for (const material of materials) {
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
    }
  } finally {
    renderer.setPixelRatio(previousRatio);
    renderer.setSize(previousSize.x, previousSize.y, false);
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.setClearColor(previousColor, previousAlpha);
    renderer.autoClear = previousAutoClear;
    renderer.shadowMap.enabled = previousShadow;
    renderer.toneMappingExposure = previousExposure;
  }
  return thumbnails;
}
