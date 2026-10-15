import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
  ],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const hardStop = setTimeout(() => process.exit(2), 90000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => !!window.__derby, null, { polling: 100 });
await page.evaluate(() => {
  window.__derby.renderEnabled = false;
});
await page.route("**/__reference-check", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><style>body{margin:0;background:#e7e2d5}canvas{display:block}</style>",
  }),
);
await page.goto("http://127.0.0.1:5173/__reference-check");
const models = await page.evaluate(async () => {
  const THREE = await import("/node_modules/three/build/three.module.js");
  const { createVehicle, VEHICLES } = await import("/src/vehicles.js");
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1200, 800);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7e2d5);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777765, 2.5));
  const key = new THREE.DirectionalLight(0xffefd3, 3);
  key.position.set(-3, 6, -5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe0edff, 1.7);
  fill.position.set(4, 4, 2);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0xd5d0c2, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.1, 100);
  camera.position.set(4.7, 3.5, -5.5);
  camera.lookAt(0, 0.85, -0.45);
  window.referenceScene = {
    THREE,
    scene,
    renderer,
    camera,
    createVehicle,
    VEHICLES,
  };
  return VEHICLES.map((v, i) => {
    const m = createVehicle(THREE, i, true);
    const required = [
      "wheel",
      "paddles",
      "brake",
      "gear",
      "headlight",
      "flag",
      "stats",
    ];
    if (required.some((k) => !m.userData[k]))
      throw Error("Missing playable controls: " + v.name);
    const bounds = new THREE.Box3().setFromObject(m);
    let meshes = 0;
    m.traverse((o) => {
      if (o.isMesh) meshes++;
    });
    return {
      name: v.name,
      meshes,
      size: bounds.getSize(new THREE.Vector3()).toArray(),
    };
  });
});
for (let i = 0; i < 4; i++) {
  await page.evaluate((index) => {
    const r = window.referenceScene;
    if (r.current) r.scene.remove(r.current);
    r.current = r.createVehicle(r.THREE, index);
    r.scene.add(r.current);
    r.renderer.render(r.scene, r.camera);
  }, i);
  await page.screenshot({
    path: `verification/reference-cars/model-${i + 1}.png`,
  });
}
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => !!window.__derby, null, { polling: 100 });
await page.evaluate(() => {
  window.__derby.renderEnabled = false;
  document.querySelector("#garage-btn").click();
});
await page.screenshot({ path: "verification/reference-cars/garage.png" });
const names = await page.locator("[data-car]").allTextContents();
for (let i = 0; i < 4; i++) {
  await page.evaluate((index) => {
    document.querySelector(`[data-car="${index}"]`).click();
    document.querySelector("#start").click();
  }, i);
  await page.waitForFunction(() => window.__derby.racers.length === 6, null, {
    polling: 100,
  });
  const name = await page.evaluate(() => window.__derby.racers[0].stats.name);
  if (name !== models[i].name)
    throw Error("Selected car did not reach simulation");
  await page.screenshot({
    path: `verification/reference-cars/cockpit-${i + 1}.png`,
  });
  await page.evaluate(() => document.querySelector("#pause").click());
}
await browser.close();
clearTimeout(hardStop);
if (names.length !== 10) throw Error("Garage must retain exactly ten cars");
await writeFile(
  "verification/reference-cars/results.json",
  JSON.stringify({ models, names, errors }, null, 2),
);
console.log(
  JSON.stringify({
    carCount: names.length,
    newCars: names.slice(0, 4),
    errors,
  }),
);
if (errors.length) process.exitCode = 1;
