import * as THREE from "three";
import { RACE_SIZE, FAMILY_SEATS } from "./race-config.js";
import QRCode from "qrcode";
import jsQR from "jsqr";
import "./style.css";
import { createEnvironment, roadAt, surfaceAt } from "./scene.js";
import { VEHICLES, createVehicle } from "./vehicles.js";
import {
  createRacer,
  stepRacer,
  disposeRacer,
  resolveRacerContacts,
} from "./physics.js";
import { Controls } from "./controls.js";
import {
  FamilyNetwork,
  createFamilyPass,
  verifyFamilyPass,
  persistFamilyPass,
  loadFamilyPass,
} from "./network.js";
import { DerbyAudio } from "./audio.js";
import { setupGraphics } from "./graphics.js";
import { AI_DRIVERS, aiInput } from "./ai.js";
import { SnapshotBuffer } from "./replication.js";
import { createVehicleThumbnails } from "./thumbnails.js";
import { disposeVehicle } from "./resources.js";
import { addDashboardSwitch, updateDashboardSwitch } from "./dashboard-switch.js";

document.querySelector("#app").innerHTML = `<canvas class="game"></canvas>
<section class="screen" id="home"><div class="content"><div class="eyebrow">The countryside is calling · Est. 1975</div><div class="rule"></div><h1>Hollow<br><i>Run.</i></h1><p>Ten drivers. Two miles. Nothing but gravity.<br>A homemade soapbox derby down the old farm road.</p><div class="actions"><button class="primary" id="garage-btn">Take the wheel ↗</button><button id="family-btn">Family race</button></div><div class="help">BUILT BY HAND. DRIVEN BY FEEL.</div></div><div class="top-mark">SOAPBOX DERBY / 01</div><div class="footer">3218 METRES OF DIRT &nbsp; / &nbsp; ONE WAY DOWN</div></section>
<section class="screen hidden" id="garage"><div class="garage"><div class="eyebrow">The backyard garage</div><h2>Pick your pride & joy.</h2><p id="vehicle-desc"></p><div class="choices" id="choices"></div><div class="specs" id="specs"></div><div class="actions"><button class="primary" id="start">Roll downhill ↗</button><button id="gyro">Enable tilt steering</button><button id="back">Back</button></div><p class="help">DESKTOP: A / D steer · alternate W / S to paddle · SPACE brake · L light · R toggle gear<br>TOUCH: swipe DOWN at either edge to go · swipe UP to slow / reverse · rest BOTH thumbs to brake · dashboard switch for light. One forward swipe lasts 10 seconds. Tilt to steer.</p></div></section>
<div id="race-countdown" class="hidden" role="status" aria-live="polite"></div><div id="race-controls" class="hidden">
<div id="race-rank" aria-label="Race position">10<span>/10</span></div>
<div class="swipe-zone swipe-left" data-side="left" aria-label="Left thumb swipe area"><span class="swipe-arrow">↑</span><span>SLOW / REVERSE</span><i></i><strong>SWIPE</strong><span>FORWARD</span><span class="swipe-arrow">↓</span></div>
<div class="swipe-zone swipe-right" data-side="right" aria-label="Right thumb swipe area"><span class="swipe-arrow">↑</span><span>SLOW / REVERSE</span><i></i><strong>SWIPE</strong><span>FORWARD</span><span class="swipe-arrow">↓</span></div>
<div class="brake-feedback">HANDBRAKE · RELEASE A THUMB TO ROLL</div>
<button id="dashboard-light" aria-label="Toggle physical dashboard headlight switch" aria-pressed="false" title="Headlight switch (L)"></button>
</div>
<button class="race-menu hidden" id="pause">Garage ↗</button>
<section id="lobby" class="modal hidden"><div class="actions family-top"><button id="lobby-garage">Garage · choose car</button><button id="lobby-tilt">Enable tilt steering</button></div><div class="eyebrow">Offline family race · six family seats · ten cars</div><h2>Meet at the starting line.</h2><p>Race with ten cars, with bots filling every open place. Install once while online. Then connect every device to the same Wi-Fi or a supported Personal Hotspot. No signaling server is used. Hotspot support and local peer connections depend on your devices and network.</p><div class="actions"><button id="host">Host family race</button><button id="scan">Scan connection QR</button><button id="close-lobby">Close</button></div><p id="family-connections" role="status" aria-live="polite"></p><div class="qr-row"><div class="qr-placeholder" id="qr-placeholder">Your connection QR will appear here.<br>Host a race or scan an invitation.</div><canvas id="qr" class="hidden"></canvas><div><p id="network-status">Host displays an offer. Guest scans it and shows an answer. Host scans the answer. Repeat for each guest.</p><video id="scanner" playsinline muted class="hidden"></video></div></div><textarea id="code" placeholder="Connection code — copy/paste fallback" aria-label="Connection code"></textarea><div class="actions"><button id="accept">Use connection code</button><button id="copy">Copy code</button><button id="family-pass">Create demo family pass</button><button id="race-room">Start family race</button></div><p id="offline-status" class="help">Offline cache is preparing. Keep this page open while online.</p><p id="pass-status" class="help">Family pass is a signed six-seat local demo. It does not verify a purchase.</p></section>
<section id="finish" class="modal hidden"><div class="eyebrow">The old farm finish line</div><h2>You made it down.</h2><p id="results"></p><button id="again">Back to the garage</button></section><div id="portrait"><div><h2>Turn toward the road.</h2><p>Hold your device in landscape with both hands.</p></div></div>`;
const $ = (s) => document.querySelector(s),
  canvas = $("canvas.game");
const modalFocus = new WeakMap();
function showModal(element) {
  modalFocus.set(element, document.activeElement);
  element.classList.remove("hidden");
  element.querySelector("button,textarea")?.focus({ preventScroll: true });
}
function hideModal(element) {
  element.classList.add("hidden");
  modalFocus.get(element)?.focus?.({ preventScroll: true });
}
function prepareDialog(element) {
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
  element.setAttribute(
    "aria-label",
    element.querySelector("h2")?.textContent || "Race dialog",
  );
}
document.querySelectorAll(".modal").forEach(prepareDialog);
document.addEventListener("keydown", (event) => {
  const modal = [...document.querySelectorAll(".modal")].find(
    (el) => !el.classList.contains("hidden"),
  );
  if (!modal) return;
  if (event.key === "Tab") {
    const items = [...modal.querySelectorAll("button,textarea")].filter(
      (el) => !el.disabled,
    );
    const first = items[0],
      last = items.at(-1);
    if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      first?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === "Escape") {
    event.preventDefault();
    hideModal(modal);
    if (modal.id === "lobby") stopScan();
    if (modal.id === "finish") garage();
  }
});
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
createEnvironment(THREE, scene);
const graphics = setupGraphics(THREE, renderer, scene);
const camera = new THREE.PerspectiveCamera(
  68,
  innerWidth / innerHeight,
  0.08,
  650,
);
const controls = new Controls(canvas),
  audio = new DerbyAudio(),
  net = new FamilyNetwork();
let selected = 0,
  car,
  racers = [],
  opponents = [],
  running = false,
  clockTime = 0,
  last = performance.now(),
  networkClock = 0,
  guestIndex = 1,
  slotClock = 0,
  startDelay = 0,
  startDeadline = 0,
  thumbnails = [],
  raceCompleted = false,
  renderEnabled = true,
  raceEpoch = 0,
  hostRaceActive = true;
const remoteInputs = new Map(),
  remoteAt = new Map(),
  remoteVehicles = new Map(),
  peerSlots = new Map(),
  snapshotBuffer = new SnapshotBuffer();
let snapshotTargets = null;
let lastStroke = [false, false],
  lastBounce = 0;
function choose(i) {
  selected = i;
  if (net.role === "guest") net.sendVehicle?.(i);
  if (car) disposeVehicle(car);
  car = createVehicle(THREE, i, true);
  addDashboardSwitch(THREE, car);
  scene.add(car);
  const display = roadAt(18);
  car.position.set(display.x - 1, display.y + 0.42, display.z);
  car.rotation.y = display.heading - Math.PI;
  $("#vehicle-desc").textContent =
    VEHICLES[i].name +
    " — " +
    VEHICLES[i].subtitle +
    ". " +
    (VEHICLES[i].trait || "");
  $("#specs").innerHTML =
    `<div><span>${VEHICLES[i].mass} kg</span>WEIGHT</div><div><span>${Math.round((VEHICLES[i].handling / 1.5) * 10)}/10</span>HANDLING</div><div><span>${VEHICLES[i].grip.toFixed(2)}</span>GRIP</div>`;
  $("#choices").innerHTML = VEHICLES.map(
    (v, j) =>
      `<button class="${i === j ? "selected" : ""}" data-car="${j}">${thumbnails[j] ? '<img src="' + thumbnails[j] + '" alt="" />' : ""}${v.name}</button>`,
  ).join("");
  document
    .querySelectorAll("[data-car]")
    .forEach((b) => (b.onclick = () => choose(+b.dataset.car)));
}
choose(0);
function garage() {
  if (net.role === "host" && raceEpoch) net.broadcastRace?.(raceEpoch, 0);
  running = false;
  controls.resetDrive();
  audio.suspendRace?.();
  if (!thumbnails.length)
    thumbnails = createVehicleThumbnails(THREE, renderer, createVehicle, VEHICLES.length);
  $("#home").classList.add("hidden");
  $("#garage").classList.remove("hidden");
  $("#pause").classList.add("hidden");
  $("#finish").classList.add("hidden");
  choose(selected);
}
function start(skipGuide = false) {
  if (net.role === "guest" && skipGuide !== true) {
    showModal($("#lobby"));
    status("The host starts the family race. Leave the room to race solo.");
    return;
  }
  if (
    skipGuide !== true &&
    navigator.maxTouchPoints > 0 &&
    !localStorage.getItem("derby-controls-seen")
  ) {
    showModal($("#drive-guide"));
    return;
  }
  raceCompleted = false;
  controls.resetDrive();
  snapshotBuffer.clear();
  snapshotTargets = null;
  racers.forEach(disposeRacer);
  racers = Array.from({ length: RACE_SIZE }, (_, i) =>
    createRacer(
      VEHICLES[
        i === 0 ? selected : (remoteVehicles.get(i) ?? (i + selected) % VEHICLES.length)
      ],
      i,
    ),
  );
  racers.forEach((r, i) => {
    r.s = 5 + Math.floor(i / 3) * 5;
    r.lateral = ((i % 3) - 1) * 2;
    stepRacer(r, {}, 0.001, roadAt, surfaceAt);
  });
  opponents.forEach(disposeVehicle);
  opponents = racers.slice(1).map((r, i) => {
    const g = createVehicle(
      THREE,
      remoteVehicles.get(i + 1) ?? (i + 1 + selected) % VEHICLES.length,
    );
    scene.add(g);
    return g;
  });
  startDelay = net.role === "host" ? 10 : 3;
  startDeadline = performance.now() + startDelay * 1000;
  running = true;
  if (net.role === "host") {
    raceEpoch = Math.max(Date.now(), raceEpoch + 1);
    net.broadcastRace?.(raceEpoch, 1, 10000);
  }
  $("#home").classList.add("hidden");
  $("#garage").classList.add("hidden");
  $("#lobby").classList.add("hidden");
  $("#pause").classList.remove("hidden");
  audio.start().then(() => audio.startRace?.());
  try {
    screen.orientation?.lock?.("landscape").catch(() => {});
  } catch {}
}
$("#garage-btn").onclick = () => { familyGarage = false; $("#back").textContent = "Back"; garage(); };
let familyGarage = false;
$("#back").onclick = () => {
  $("#garage").classList.add("hidden");
  if (familyGarage || net.role === "host" || net.role === "guest") {
    familyGarage = false;
    refreshFamilyLobby();
    showModal($("#lobby"));
  } else $("#home").classList.remove("hidden");
};
$("#start").onclick = start;
$("#pause").onclick = garage;
$("#again").onclick = garage;
function refreshTiltUI(state = controls.gyroStatus) {
  const labels = {
    requesting: "Allow motion in the iOS prompt",
    waiting: "Hold centered — waiting for motion…",
    enabled: "Tilt steering is ready",
    "no-data": "No sensor readings — retry motion",
    unsupported: "Motion is not exposed by this browser",
    insecure: "Tilt needs the HTTPS game",
    denied: "Motion permission was denied",
    blocked: "This browser blocked motion access",
  };
  const help = {
    requesting: "Choose Allow when iOS asks to access motion and orientation.",
    waiting:
      "Hold your iPhone or iPad in landscape, like a steering wheel. Keep it centered for the first reading.",
    enabled:
      "Turn your device gently. The wheel below follows real sensor readings. Recenter whenever you change your grip.",
    "no-data":
      "Permission may be granted, but no usable readings arrived. Try again in Safari on the device, outside an embedded browser.",
    unsupported:
      "For iPhone or iPad steering, open the game directly in Safari. Desktop testing supports A / D and touch steering.",
    insecure:
      "Open the published HTTPS game directly in Safari, then enable motion.",
    denied:
      "Motion access must be allowed by iOS. Open this game directly in Safari and retry; a saved denial may need changing in the website’s permissions.",
    blocked:
      "An embedded browser or its permissions policy may block motion. Open the game directly in Safari and tap Enable tilt.",
  };
  const active = ["requesting", "waiting", "enabled"].includes(state);
  for (const id of ["gyro", "guide-tilt", "lobby-tilt"]) {
    const button = $("#" + id);
    if (button) {
      button.disabled = state === "requesting";
      button.textContent =
        state === "requesting"
          ? "Requesting motion…"
          : state === "enabled"
            ? "Tilt enabled — recenter"
            : "Enable iOS tilt steering";
    }
  }
  document.querySelectorAll(".tilt-feedback").forEach((panel) => {
    panel.classList.toggle("hidden", state === "not-enabled");
    panel.querySelector(".tilt-feedback-title").textContent =
      labels[state] || "Enable iOS tilt steering";
    panel.querySelector(".tilt-feedback-copy").textContent = help[state] || "";
    panel
      .querySelector(".tilt-recenter")
      .classList.toggle("hidden", !["enabled", "waiting"].includes(state));
    panel.querySelector(".tilt-safari-link").classList.toggle("hidden", active);
  });
}
// The permission APIs must be invoked directly in the click handler's activation.
function requestTilt() {
  if (controls.gyroStatus === "enabled") {
    controls.recalibrate();
    return Promise.resolve(true);
  }
  const request = controls.enableGyro();
  return request.then(() => refreshTiltUI());
}
$("#gyro").onclick = requestTilt;
$("#lobby-tilt").onclick = requestTilt;
$("#lobby-garage").onclick = () => {
  hideModal($("#lobby"));
  stopScan();
  garage();
  $("#back").textContent = "Back to family race";
  familyGarage = true;

};
const garageActions = $("#garage .actions");
$("#garage .garage").prepend(garageActions);
$("#family-btn").onclick = () => {
  refreshFamilyLobby();
  refreshTiltUI();
  showModal($("#lobby"));
};
$("#close-lobby").onclick = () => {
  hideModal($("#lobby"));
  stopScan();
};
async function displayCode(code) {
  $("#qr-placeholder").classList.add("hidden");
  $("#qr").classList.remove("hidden");
  $("#code").value = code;
  await QRCode.toCanvas($("#qr"), code, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "L",
  });
}
const guide = document.createElement("section");
guide.id = "drive-guide";
guide.className = "modal hidden";
guide.innerHTML =
  '<div class="eyebrow">Before the starting bell</div><h2>Both hands on the wheel.</h2><p>Hold your device in landscape, centered and comfortable. Enable tilt, then turn it like a steering wheel. Swipe DOWN in either translucent edge zone for a 10-second forward push. A faster swipe accelerates harder and reaches a higher speed. Swipe UP to slow down, then gently reverse. Rest both thumbs still in the zones to hold the handbrake; release a thumb to roll. After a push runs out, the car settles into a slow downhill coast. Use the dashboard LAMP switch for the headlight.</p><div class="actions"><button id="guide-tilt">Enable tilt while centered</button><button class="primary" id="hands-ready">Hands ready — roll out</button></div>';
document.body.append(guide);
const tiltPanel = () =>
  `<div class="tilt-feedback hidden"><svg class="tilt-dial" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="6"/><path d="M8 22 27 30M56 22 37 30M32 38v20"/></svg><div><strong class="tilt-feedback-title" role="status" aria-live="polite"></strong><p class="tilt-feedback-copy"></p><button class="tilt-recenter hidden" type="button">Recenter wheel</button><a class="tilt-safari-link hidden" href="${new URL(import.meta.env.BASE_URL, location.href).href}" target="_blank" rel="noopener">Game link to open in Safari ↗</a></div></div>`;
$("#garage .actions").insertAdjacentHTML("afterend", tiltPanel());
$("#drive-guide .actions").insertAdjacentHTML("afterend", tiltPanel());
$("#lobby .actions").insertAdjacentHTML("afterend", tiltPanel());
document
  .querySelectorAll(".tilt-recenter")
  .forEach((button) => (button.onclick = () => controls.recalibrate()));
controls.onGyroStatus = refreshTiltUI;
$("#guide-tilt").onclick = requestTilt;
$("#hands-ready").onclick = () => {
  localStorage.setItem("derby-controls-seen", "1");
  hideModal(guide);
  start(true);
};
function refreshFamilyLobby() {
  const connected = net.connectedCount;
  const host = net.role === "host";
  $("#family-connections").textContent = connected
    ? `${connected + 1} connected family drivers on this link. ${host ? `${RACE_SIZE - connected - 1} bot places remain. Scan each guest’s answer before starting.` : "Enable tilt on this iPad, then wait for the host to start."}`
    : "No other players connected yet. Host creates an offer → guest scans it → host scans the guest’s answer. Sharing Wi-Fi alone does not join a race.";
  $("#race-room").disabled = !host || connected === 0;
  $("#race-room").textContent = host && connected > 0
    ? `Start with ${connected + 1} family drivers`
    : net.role === "guest" ? "Waiting for host" : "Connect a guest to start";
}
const status = (t) => ($("#network-status").textContent = t);
prepareDialog(guide);
const leaveButton = document.createElement("button");
leaveButton.id = "leave-room";
leaveButton.textContent = "Leave family room";
$("#close-lobby").after(leaveButton);
leaveButton.onclick = () => {
  net.close();
  peerSlots.clear();
  remoteInputs.clear();
  remoteAt.clear();
  remoteVehicles.clear();
  snapshotBuffer.clear();
  snapshotTargets = null;
  raceEpoch = 0;
  hostRaceActive = true;
  raceCompleted = false;
  stopScan();
  hideModal($("#lobby"));
  garage();
  status("You left the room. Host or scan an invitation to reconnect.");
};
net.onStatus = (s, id) => {
  refreshFamilyLobby();
  if (s === "connected" && net.role === "host" && !peerSlots.has(id)) {
    const slot = Array.from({ length: FAMILY_SEATS - 1 }, (_, i) => i + 1).find(
      (n) => ![...peerSlots.values()].includes(n),
    );
    if (slot) {
      peerSlots.set(id, slot);
      net.sendSlot?.(id, slot);
    }
  }
  if (s === "connected" && net.role === "guest") net.sendVehicle?.(selected);
  if (["disconnected", "failed", "closed"].includes(s)) {
    const slot = peerSlots.get(id);
    remoteInputs.delete(slot);
    remoteAt.delete(slot);
    if (!net.peers.has(id)) {
      peerSlots.delete(id);
      remoteVehicles.delete(slot);
    }
    if (
      net.role === "guest" &&
      net.connectedCount === 0 &&
      !net.peers.has(id)
    ) {
      hostRaceActive = false;
      raceCompleted = false;
      garage();
      status(
        "Host disconnected. Scan a fresh invitation or leave the family room.",
      );
      return;
    }
  }
  status(`${s} · ${net.connectedCount + 1} / ${FAMILY_SEATS} family drivers · ${RACE_SIZE} cars on track`);
};
net.onVehicle = (index, id) => {
  const slot = peerSlots.get(id);
  if (!slot || remoteVehicles.get(slot) === index) return;
  remoteVehicles.set(slot, index);
  if (racers[slot]) {
    racers[slot].stats = VEHICLES[index];
    disposeRacer(racers[slot]);
  }
  if (opponents[slot - 1]) {
    disposeVehicle(opponents[slot - 1]);
    opponents[slot - 1] = createVehicle(THREE, index);
    scene.add(opponents[slot - 1]);
  }
};
net.onRoster = (indices) => {
  indices.forEach((vehicle, slot) => remoteVehicles.set(slot, vehicle));
  if (net.role === "guest") {
    const slots = Array.from({ length: RACE_SIZE }, (_, i) => i).filter((slot) => slot !== guestIndex);
    slots.forEach((slot, i) => {
      if (opponents[i]?.userData.vehicleIndex === indices[slot]) return;
      if (opponents[i]) disposeVehicle(opponents[i]);
      const model = createVehicle(THREE, indices[slot]);
      model.userData.vehicleIndex = indices[slot];
      opponents[i] = model;
      scene.add(model);
    });
  }
};
net.onRace = (epoch, active, remainingMs = 0) => {
  const changed = epoch !== raceEpoch;
  raceEpoch = epoch;
  hostRaceActive = active;
  if (!active) {
    const wasRacing = running || raceCompleted;
    raceCompleted = false;
    if (wasRacing) garage();
    status("The host is in the garage. Waiting for the next starting bell.");
  } else {
    if (changed || (!running && !raceCompleted)) start(true);
    if (running) startDeadline = performance.now() + remainingMs;
  }
};
net.onResults = (times) => {
  times.forEach((time, i) => {
    if (racers[i] && time >= 0) {
      racers[i].finishTime = time;
      racers[i].finished = true;
    }
  });
  if (raceCompleted) renderResults();
};
net.onInput = (arr, id) => {
  const slot = peerSlots.get(id);
  if (slot && arr.length >= 6) {
    remoteAt.set(slot, performance.now() / 1000);
    remoteInputs.set(slot, {
      steer: Math.max(-1, Math.min(1, arr[0])),
      leftPaddle: !!arr[1],
      rightPaddle: !!arr[2],
      brake: !!arr[3],
      headlight: !!arr[4],
      reverse: !!arr[5],
      swipeDirection: arr[6] || 0,
      touchDrive: !!arr[7],
      swipeStrength: arr[8] ?? 0.5,
    });
  }
};
net.onSnapshot = (arr) => {
  if (arr[0] === 77) {
    guestIndex = arr[1];
    return;
  }
  if (arr[0] === 88) {
    if (!hostRaceActive) return;
    if (!running && !raceCompleted) start(true);
    snapshotTargets = arr.slice(1);
    snapshotBuffer.push(
      Array.from({ length: RACE_SIZE }, (_, i) =>
        snapshotTargets.slice(i * 4, i * 4 + 4),
      ),
      performance.now() / 1000,
    );
  }
};
$("#host").onclick = async () => {
  try {
    status("Gathering local connection candidates…");
    await displayCode(await net.hostOffer());
    refreshFamilyLobby();
    status("Guest: scan this offer, then show your answer QR.");
  } catch (e) {
    status(e.message);
  }
};
async function useCode(code) {
  try {
    if (net.role === "host") {
      await net.acceptAnswer(code);
      status("Answer accepted. Connecting…");
    } else {
      await displayCode(await net.joinOffer(code));
      refreshFamilyLobby();
      status("Show this answer QR to the host.");
    }
  } catch (e) {
    status(e.message);
  }
}
$("#accept").onclick = () => useCode($("#code").value.trim());
$("#copy").onclick = () =>
  navigator.clipboard
    .writeText($("#code").value)
    .catch(() => status("Select and copy the code manually."));
let stream,
  scanning = false;
function stopScan() {
  scanning = false;
  stream?.getTracks().forEach((t) => t.stop());
  $("#scanner").classList.add("hidden");
}
$("#scan").onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const v = $("#scanner");
    v.srcObject = stream;
    v.classList.remove("hidden");
    await v.play();
    scanning = true;
    const scratch = document.createElement("canvas"),
      ctx = scratch.getContext("2d", { willReadFrequently: true });
    function scan() {
      if (!scanning) return;
      if (v.videoWidth) {
        scratch.width = v.videoWidth;
        scratch.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const data = ctx.getImageData(0, 0, scratch.width, scratch.height),
          qr = jsQR(data.data, data.width, data.height);
        if (qr) {
          stopScan();
          useCode(qr.data);
          return;
        }
      }
      requestAnimationFrame(scan);
    }
    scan();
  } catch (e) {
    status("Camera unavailable: " + e.message);
  }
};
$("#family-pass").onclick = async () => {
  try {
    const pass = await createFamilyPass(6);
    await persistFamilyPass(pass, [
      "Driver 1",
      "Driver 2",
      "Driver 3",
      "Driver 4",
      "Driver 5",
      "Driver 6",
    ]);
    const claims = await verifyFamilyPass(pass);
    $("#pass-status").textContent = claims
      ? "Signed demo family pass saved offline: 6 seats. Purchase verification requires a trusted issuer."
      : "Pass verification failed.";
  } catch (e) {
    $("#pass-status").textContent = e.message;
  }
};
loadFamilyPass()
  .then((saved) => {
    if (saved)
      $("#pass-status").textContent =
        `Signed demo family pass loaded offline: ${saved.profiles.length} profiles. Purchase verification requires a trusted issuer.`;
  })
  .catch(() => {});
$("#race-room").onclick = () => {
  if (net.role !== "host" || net.connectedCount === 0) {
    refreshFamilyLobby();
    status("Connect another iPad first: complete both offer and answer QR scans, then wait for Connected.");
    return;
  }
  if (net.role === "guest") {
    status("Waiting for the host to start.");
    return;
  }
  start();
  for (const [id, p] of net.peers) {
    if (p.channel?.readyState === "open")
      p.channel.send(JSON.stringify([77, peerSlots.get(id)]));
  }
};
refreshFamilyLobby();
function resize() {
  $("#portrait").style.display =
    navigator.maxTouchPoints > 0 && innerHeight > innerWidth ? "flex" : "none";
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
function place(mesh, r) {
  mesh.position.set(r.position.x, r.position.y, r.position.z);
  mesh.quaternion.set(
    r.quaternion.x,
    r.quaternion.y,
    r.quaternion.z,
    r.quaternion.w,
  );
}
function renderResults() {
  const r = racers[net.role === "guest" ? guestIndex : 0];
  if (!r) return;
  $("#results").textContent =
    r.finishTime == null
      ? `Your ${VEHICLES[selected].name} completed the two-mile descent.`
      : `Your ${VEHICLES[selected].name} completed the two-mile descent in ${Math.floor(r.finishTime / 60)}m ${Math.floor(r.finishTime % 60)}s.`;
  const board = document.createElement("ol");
  [...racers]
    .sort(
      (a, b) =>
        (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity) || b.s - a.s,
    )
    .forEach((entry) => {
      const li = document.createElement("li");
      li.textContent =
        (entry.index === (net.role === "guest" ? guestIndex : 0)
          ? "You"
          : peerSlots.size && remoteInputs.has(entry.index)
            ? "Family driver " + entry.index
            : AI_DRIVERS[Math.max(0, entry.index - 1)].name) +
        " — " +
        (entry.finished
          ? Math.floor((entry.finishTime ?? entry.elapsed) / 60) +
            "m " +
            Math.floor((entry.finishTime ?? entry.elapsed) % 60) +
            "s"
          : "still on the road");
      board.append(li);
    });
  $("#results").append(board);
}
for (const zone of document.querySelectorAll(".swipe-zone")) {
  zone.style.touchAction = "none";
  zone.addEventListener("pointerdown", controls._onPointerDown);
  zone.addEventListener("pointermove", controls._onPointerMove);
  zone.addEventListener("pointerup", controls._onPointerUp);
  zone.addEventListener("pointercancel", controls._onPointerUp);
  zone.addEventListener("lostpointercapture", controls._onPointerUp);
}
$("#dashboard-light").onclick = () => {
  controls.input.headlight = !controls.input.headlight;
};
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  clockTime += dt;
  const input = controls.update(dt);
  document
    .querySelectorAll(".tilt-dial")
    .forEach(
      (dial) => (dial.style.transform = `rotate(${-controls.gyro * 65}deg)`),
    );
  const raceUI = running && ![...document.querySelectorAll(".modal")].some(el => !el.classList.contains("hidden"));
  $("#race-controls").classList.toggle("hidden", !raceUI);
  $("#race-controls").classList.toggle("braking", input.brake);
  $("#dashboard-light").setAttribute("aria-pressed", String(input.headlight));

  for (const zone of document.querySelectorAll(".swipe-zone")) {
    zone.classList.toggle("touching", [...controls.pointers.values()].some(p => p.side === (zone.dataset.side === "left" ? "leftPaddle" : "rightPaddle")));
  }
  const countdown = running && startDeadline > performance.now();
  $("#race-countdown").classList.toggle("hidden", !countdown);
  if (countdown) {
    const text = `Ready… ${Math.ceil((startDeadline - performance.now()) / 1000)}`;
    if ($("#race-countdown").textContent !== text) $("#race-countdown").textContent = text;
  }
  if (running) {
    const local = net.role === "guest" ? guestIndex : 0;
    startDelay = Math.max(0, (startDeadline - performance.now()) / 1000);
    if (net.role !== "guest" && startDelay === 0) {
      racers.forEach((r, i) =>
        stepRacer(
          r,
          i === 0
            ? input
            : (now / 1000 - (remoteAt.get(i) ?? -100) < 1
                ? remoteInputs.get(i)
                : null) ||
                aiInput(
                  AI_DRIVERS[i - 1],
                  r,
                  racers,
                  clockTime,
                  roadAt,
                  surfaceAt,
                ),
          dt,
          roadAt,
          surfaceAt,
        ),
      );
      resolveRacerContacts(racers, dt);
    } else if (snapshotTargets) {
      racers.forEach((r, i) => {
        const a =
          snapshotBuffer.sample(now / 1000)?.[i] ||
          snapshotTargets.slice(i * 4, i * 4 + 4);
        if (a.length === 4) {
          r.elapsed += dt;
          r.s = a[0];
          r.lateral = a[1];
          r.speed = a[2];
          r.steer = a[3];
          r.finished = r.s >= 3218;
          const p = roadAt(r.s);
          const derivative =
              Math.cos(r.s * 0.004) * 0.14 + Math.cos(r.s * 0.011) * 0.088,
            norm = Math.hypot(1, derivative);
          r.position = {
            x: p.x + r.lateral / norm,
            y: p.y + 0.42,
            z: p.z + (derivative * r.lateral) / norm,
          };
          const yaw = p.heading - Math.PI;
          r.quaternion = {
            x: 0,
            y: Math.sin(yaw / 2),
            z: 0,
            w: Math.cos(yaw / 2),
          };
        }
      });
    }
    const r = racers[local];
    const order = [...racers].sort((a,b) => {
      if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity) || a.index-b.index;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.s-a.s || a.index-b.index;
    });
    const rank = order.indexOf(r)+1;
    $("#race-rank").innerHTML = `${rank}<span>/${racers.length}</span>`;
    $("#race-rank").setAttribute("aria-label", `Race position ${rank} of ${racers.length}`);
    place(car, r);
    racers
      .filter((_, i) => i !== local)
      .forEach((r, i) => place(opponents[i], r));
    camera.position.copy(car.localToWorld(new THREE.Vector3(0, 1.78, 0.28)));
    const target = car.localToWorld(
      new THREE.Vector3(input.steer * 0.3, 1.45, -25),
    );
    camera.lookAt(target);
    updateDashboardSwitch(THREE, car, camera, $("#dashboard-light"), input.headlight, innerWidth, innerHeight);
    const strokes = [input.leftPaddle, input.rightPaddle];
    strokes.forEach((on, i) => {
      if (on && !lastStroke[i]) audio.stroke?.(i ? 1 : -1);
    });
    lastStroke = strokes;
    if (Math.abs(r.bounce - lastBounce) > 0.04)
      audio.impact?.(
        surfaceAt(r.s, r.lateral).type,
        Math.min(1, Math.abs(r.bounce - lastBounce) * 5),
      );
    lastBounce = r.bounce;
    const u = car.userData;
    if (u.wheel) u.wheel.rotation.z = -input.steer * 0.7;
    if (u.paddles)
      u.paddles.forEach(
        (p, i) =>
          (p.rotation.x = (i ? input.rightPaddle : input.leftPaddle)
            ? -0.35
            : 0),
      );
    if (u.brake) u.brake.rotation.x = input.brake ? -0.5 : 0;
    if (u.gear) u.gear.rotation.x = input.reverse ? 0.4 : 0;
    if (u.headlight) u.headlight.visible = input.headlight;
    graphics.update(clockTime, r.speed, car, surfaceAt(r.s, r.lateral));
    audio.update(r.speed, surfaceAt(r.s, r.lateral).type, input.brake, dt);
    slotClock += dt;
    if (net.role === "guest" && slotClock > 1) {
      slotClock = 0;
      net.sendVehicle?.(selected);
    }
    if (net.role === "host" && slotClock > 1) {
      slotClock = 0;
      net.broadcastResults?.(racers.map((entry) => entry.finishTime ?? -1));
      if (raceCompleted) renderResults();
      net.broadcastRoster?.(
        racers.map((r, i) =>
          i === 0 ? selected : (remoteVehicles.get(i) ?? (i + selected) % VEHICLES.length),
        ),
      );
      for (const [id, p] of net.peers)
        if (p.channel?.readyState === "open")
          p.channel.send(JSON.stringify([77, peerSlots.get(id)]));
    }
    networkClock += dt;
    if (networkClock >= 1 / 60) {
      networkClock = 0;
      if (net.role === "guest")
        net.sendInput([
          input.steer,
          +input.leftPaddle,
          +input.rightPaddle,
          +input.brake,
          +input.headlight,
          +input.reverse,
          input.swipeDirection,
          +input.touchDrive,
          input.swipeStrength,
        ]);
      else if (net.role === "host")
        net.broadcast([
          88,
          ...racers.flatMap((r) => [r.s, r.lateral, r.speed, r.steer]),
        ]);
    }
    if (r.s >= 3218) {
      r.finished = true;
    }
    if (r.finished && !raceCompleted) {
      raceCompleted = true;
      if (net.role !== "host") running = false;
      showModal($("#finish"));
      renderResults();
      if (net.role === "host")
        net.broadcastResults?.(racers.map((entry) => entry.finishTime ?? -1));
    }
  } else {
    audio.update(0, "dirt", false, dt);
    if (car?.userData.wheel) car.userData.wheel.rotation.z = -input.steer * 0.7;
    camera.position.set(11, 3, -9);
    camera.lookAt(1, 0.3, -24);
    graphics.update(clockTime, 0, car);
  }
  if (renderEnabled) renderer.render(scene, camera);
}
requestAnimationFrame(animate);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(async () => {
      await navigator.serviceWorker.ready;
      $("#offline-status").textContent =
        "Offline cache installed. On iPad, add this app to your Home Screen before leaving Wi-Fi.";
    })
    .catch((e) => {
      $("#offline-status").textContent =
        "Offline cache unavailable: " + e.message;
    });
window.__derby = {
  net,
  controls,
  get racers() {
    return racers;
  },
  get peerSlots() {
    return [...peerSlots];
  },
  get vehicles() {
    return [...remoteVehicles];
  },
  get startDelay() { return startDelay; },
  get running() {
    return running;
  },
  get renderEnabled() {
    return renderEnabled;
  },
  set renderEnabled(value) {
    renderEnabled = !!value;
  },
  start,
  roadAt,
  surfaceAt,
};
