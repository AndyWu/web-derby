import LZString from "lz-string";
import { RACE_SIZE, FAMILY_SEATS } from "./race-config.js";
import { VEHICLES } from "./vehicles.js";

const PREFIX = "DERBY1:";
const encode = (value) =>
  PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(value));
const decode = (value) => {
  if (
    typeof value !== "string" ||
    !value.startsWith(PREFIX) ||
    value.length > 100000
  )
    throw new Error("Not a Derby connection code.");
  let result;
  try {
    result = JSON.parse(
      LZString.decompressFromEncodedURIComponent(value.slice(PREFIX.length)),
    );
  } catch {
    throw new Error("Connection code is damaged. Scan or paste it again.");
  }
  if (!result || result.version !== 1 || !result.id || !result.sdp)
    throw new Error("Unsupported connection code.");
  return result;
};
function gather(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Local network discovery timed out. Try again on the same Wi-Fi.",
        ),
      );
    }, 18000);
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
    };
    pc.addEventListener("icegatheringstatechange", check);
  });
}

const finiteMessage = (data) =>
  Array.isArray(data) &&
  data.length > 0 &&
  data.length <= 1 + RACE_SIZE * 4 &&
  data.every(
    (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 3.4e38,
  );
const validInput = (data) =>
  finiteMessage(data) &&
  ([6, 8, 9].includes(data.length)) &&
  Math.abs(data[0]) <= 1 &&
  data.slice(1, 6).every((n) => n === 0 || n === 1) &&
  (data.length === 6 || ([-1, 0, 1].includes(data[6]) && [0, 1].includes(data[7]))) &&
  (data.length < 9 || (data[8] >= 0 && data[8] <= 1));
const validSnapshot = (data) =>
  finiteMessage(data) &&
  ((data[0] === 77 &&
    data.length === 2 &&
    Number.isInteger(data[1]) &&
    data[1] >= 1 &&
    data[1] < FAMILY_SEATS) ||
    (data[0] === 88 && data.length === 1 + RACE_SIZE * 4));

/** Unordered, unretransmitted binary state channel. No STUN or TURN. */
export class FamilyNetwork {
  constructor() {
    this.peers = new Map();
    this.role = null;
    this.onInput = () => {};
    this.onSnapshot = () => {};
    this.onVehicle = () => {};
    this.onRoster = () => {};
    this.onRace = () => {};
    this.onResults = () => {};
    this.onStatus = () => {};
  }
  get connectedCount() {
    return [...this.peers.values()].filter(
      (p) => p.channel?.readyState === "open",
    ).length;
  }
  _peer(id) {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const peer = { id, pc, channel: null };
    this.peers.set(id, peer);
    pc.onconnectionstatechange = () => {
      clearTimeout(peer.disconnectTimer);
      this.onStatus(pc.connectionState, id);
      if (["failed", "closed"].includes(pc.connectionState)) this._remove(peer);
      else if (pc.connectionState === "disconnected")
        peer.disconnectTimer = setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            this._remove(peer);
            this.onStatus("disconnected", id);
          }
        }, 5000);
    };
    pc.ondatachannel = (event) => this._channel(peer, event.channel);
    return peer;
  }
  _channel(peer, channel) {
    peer.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      this.onStatus("connected", peer.id);
      if (this.role === "guest" && Number.isInteger(this.vehicleIndex))
        this.sendVehicle(this.vehicleIndex);
      if (this.role === "host" && this.raceState)
        this._sendControl(peer, this.currentRaceState());
    };
    channel.onclose = () => {
      this._remove(peer);
      this.onStatus("disconnected", peer.id);
    };
    channel.onerror = () => this.onStatus("channel-error", peer.id);
    channel.onmessage = (event) => {
      let data;
      try {
        if (
          event.data instanceof ArrayBuffer &&
          event.data.byteLength <= (1 + RACE_SIZE * 4) * 4 &&
          event.data.byteLength % 4 === 0
        )
          data = Array.from(new Float32Array(event.data));
        else if (typeof event.data === "string" && event.data.length <= 512) {
          data = JSON.parse(event.data);
          if (
            Array.isArray(data) &&
            data.length === 2 &&
            data[0] === 66 &&
            this.role === "host" &&
            Number.isInteger(data[1]) &&
            data[1] >= 0 &&
            data[1] < VEHICLES.length
          )
            this.onVehicle(data[1], peer.id);
          else if (
            this.role === "guest" &&
            Array.isArray(data) &&
            data.length === RACE_SIZE + 1 &&
            data[0] === 79 &&
            data
              .slice(1)
              .every(
                (index) => Number.isInteger(index) && index >= 0 && index < VEHICLES.length,
              )
          )
            this.onRoster(data.slice(1));
          else if (
            this.role === "guest" &&
            Array.isArray(data) &&
            (data.length === 3 || data.length === 4) &&
            (data.length === 3 || (Number.isFinite(data[3]) && data[3] >= 0 && data[3] <= 10000)) &&
            data[0] === 82 &&
            Number.isSafeInteger(data[1]) &&
            data[1] > 0 &&
            (data[2] === 0 || data[2] === 1)
          )
            this.onRace(data[1], data[2], data[3] ?? 0);
          else if (
            this.role === "guest" &&
            Array.isArray(data) &&
            data.length === RACE_SIZE + 1 &&
            data[0] === 81 &&
            data
              .slice(1)
              .every(
                (value) =>
                  typeof value === "number" &&
                  Number.isFinite(value) &&
                  (value === -1 || value >= 0),
              )
          )
            this.onResults(data.slice(1));
          else if (
            this.role === "guest" &&
            validSnapshot(data) &&
            data[0] === 77
          )
            this.onSnapshot(data, peer.id);
          return;
        } else return;
      } catch {
        return;
      }
      if (this.role === "host" && validInput(data)) this.onInput(data, peer.id);
      else if (this.role === "guest" && validSnapshot(data))
        this.onSnapshot(data, peer.id);
    };
  }
  async hostOffer() {
    if (this.role === "guest")
      throw new Error("Leave the current room before hosting.");
    // An unanswered QR is replaceable, and does not consume a permanent seat.
    for (const [id, peer] of this.peers)
      if (!peer.answered && peer.channel?.readyState !== "open") {
        peer.pc.close();
        this.peers.delete(id);
      }
    if (this.peers.size >= FAMILY_SEATS - 1)
      throw new Error("This room already has six drivers, including the host.");
    this.role = "host";
    const id = crypto.randomUUID();
    const peer = this._peer(id);
    this._channel(
      peer,
      peer.pc.createDataChannel("derby", { ordered: false, maxRetransmits: 0 }),
    );
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      await gather(peer.pc);
      return encode({
        version: 1,
        id,
        type: "offer",
        sdp: peer.pc.localDescription.sdp,
      });
    } catch (error) {
      peer.pc.close();
      this.peers.delete(id);
      throw error;
    }
  }
  async joinOffer(payload) {
    const offer = decode(payload);
    if (offer.type !== "offer")
      throw new Error("Scan the host’s invitation first.");
    this.close();
    this.role = "guest";
    const peer = this._peer(offer.id);
    try {
      await peer.pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      await gather(peer.pc);
      return encode({
        version: 1,
        id: offer.id,
        type: "answer",
        sdp: peer.pc.localDescription.sdp,
      });
    } catch (error) {
      this.close();
      throw error;
    }
  }
  async acceptAnswer(payload) {
    const answer = decode(payload);
    const peer = this.peers.get(answer.id);
    if (this.role !== "host" || answer.type !== "answer" || !peer)
      throw new Error("This answer does not match the active invitation.");
    if (peer.pc.signalingState !== "have-local-offer")
      throw new Error("This invitation has already been used.");
    await peer.pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    peer.answered = true;
    return peer.id;
  }
  _send(peer, array) {
    if (!(this.role === "guest" ? validInput(array) : validSnapshot(array)))
      throw new TypeError("Invalid game message schema or nonfinite number.");
    if (
      peer.channel?.readyState === "open" &&
      peer.channel.bufferedAmount < 65536
    )
      peer.channel.send(new Float32Array(array));
  }
  sendInput(array) {
    if (this.role === "guest")
      for (const peer of this.peers.values()) this._send(peer, array);
  }
  broadcast(array) {
    if (this.role === "host")
      for (const peer of this.peers.values()) this._send(peer, array);
  }
  sendVehicle(index) {
    if (!Number.isInteger(index) || index < 0 || index >= VEHICLES.length)
      throw new TypeError("Vehicle index is outside the garage catalog.");
    this.vehicleIndex = index;
    clearInterval(this.vehicleTimer);
    if (this.role !== "guest") return;
    const send = () => {
      for (const peer of this.peers.values())
        if (
          peer.channel?.readyState === "open" &&
          peer.channel.bufferedAmount < 65536
        )
          peer.channel.send(JSON.stringify([66, index]));
    };
    send();
    this.vehicleTimer = setInterval(send, 1000);
  }
  sendSlot(id, slot) {
    if (!Number.isInteger(slot) || slot < 1 || slot >= FAMILY_SEATS)
      throw new TypeError("Guest slot must be 1–5.");
    const peer = this.peers.get(id);
    if (
      this.role === "host" &&
      peer?.channel?.readyState === "open" &&
      peer.channel.bufferedAmount < 65536
    )
      peer.channel.send(JSON.stringify([77, slot]));
  }
  broadcastRoster(indices) {
    if (
      !Array.isArray(indices) ||
      indices.length !== RACE_SIZE ||
      !indices.every(
        (index) => Number.isInteger(index) && index >= 0 && index < VEHICLES.length,
      )
    )
      throw new TypeError("Roster must contain ten valid garage vehicle indices.");
    if (this.role !== "host") return;
    const message = JSON.stringify([79, ...indices]);
    for (const peer of this.peers.values())
      if (
        peer.channel?.readyState === "open" &&
        peer.channel.bufferedAmount < 65536
      )
        peer.channel.send(message);
  }
  _sendControl(peer, message) {
    if (
      peer.channel?.readyState === "open" &&
      peer.channel.bufferedAmount < 65536
    )
      peer.channel.send(JSON.stringify(message));
  }
  currentRaceState() {
    return [...this.raceState, Math.max(0, (this.raceDeadline ?? 0) - performance.now())];
  }
  broadcastRace(epoch, active, countdownMs = 0) {
    if (
      !Number.isSafeInteger(epoch) ||
      epoch <= 0 ||
      (active !== 0 && active !== 1)
    )
      throw new TypeError(
        "Race state requires a positive safe epoch and active 0 or 1.",
      );
    if (this.role !== "host") return;
    this.raceState = [82, epoch, active];
    this.raceDeadline = performance.now() + Math.max(0, Math.min(10000, countdownMs));
    clearInterval(this.raceTimer);
    const send = () => {
      if (this.role === "host")
        for (const peer of this.peers.values())
          this._sendControl(peer, this.currentRaceState());
    };
    send();
    this.raceTimer = setInterval(send, 1000);
  }
  broadcastResults(finishTimes) {
    if (
      !Array.isArray(finishTimes) ||
      finishTimes.length !== RACE_SIZE ||
      !finishTimes.every(
        (value) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          (value === -1 || value >= 0),
      )
    )
      throw new TypeError(
        "Results require ten finite finish times, using -1 for unfinished.",
      );
    if (this.role === "host")
      for (const peer of this.peers.values())
        this._sendControl(peer, [81, ...finishTimes]);
  }
  _remove(peer) {
    clearTimeout(peer.disconnectTimer);
    if (peer.channel) peer.channel.onclose = null;
    peer.pc.onconnectionstatechange = null;
    this.peers.delete(peer.id);
    peer.pc.close();
    if (!this.peers.size) clearInterval(this.vehicleTimer);
  }
  close() {
    clearInterval(this.vehicleTimer);
    clearInterval(this.raceTimer);
    this.raceState = null;
    const peers = [...this.peers.values()];
    this.peers.clear();
    for (const peer of peers) this._remove(peer);
    this.role = null;
  }
}

const to64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const from64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
/** Self-issued demo signature: proves integrity only, never a paid entitlement. */
export async function createFamilyPass(seats = 6) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 6)
    throw new Error("Choose one to six seats.");
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const claims = {
    version: 1,
    kind: "self-issued-demo",
    seats,
    issued: Date.now(),
    id: crypto.randomUUID(),
  };
  const body = JSON.stringify(claims);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(body),
  );
  return {
    body,
    signature: to64(signature),
    publicKey: await crypto.subtle.exportKey("jwk", keys.publicKey),
  };
}
export async function verifyFamilyPass(pass) {
  try {
    if (typeof pass === "string") pass = JSON.parse(pass);
    const key = await crypto.subtle.importKey(
      "jwk",
      pass.publicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      from64(pass.signature),
      new TextEncoder().encode(pass.body),
    );
    const claims = JSON.parse(pass.body);
    if (
      !valid ||
      claims.kind !== "self-issued-demo" ||
      claims.version !== 1 ||
      !Number.isInteger(claims.seats) ||
      claims.seats < 1 ||
      claims.seats > 6
    )
      return null;
    return { ...claims, purchased: false };
  } catch {
    return null;
  }
}

function openFamilyDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("derby-family", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("family");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close older Derby tabs to open family storage."));
  });
}
/** Local profiles only; this does not establish trusted purchase ownership. */
export async function persistFamilyPass(pass, profiles = []) {
  const claims = await verifyFamilyPass(pass);
  if (!claims) throw new Error("Invalid demo family pass.");
  if (
    !Array.isArray(profiles) ||
    profiles.length > claims.seats ||
    profiles.length > 6
  )
    throw new Error("The family pass supports at most six profiles.");
  const names = profiles.map((profile, index) => {
    const name = typeof profile === "string" ? profile : profile?.name;
    if (typeof name !== "string" || !name.trim() || name.length > 40)
      throw new Error("Profile names must be 1–40 characters.");
    return { id: index + 1, name: name.trim() };
  });
  const db = await openFamilyDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("family", "readwrite");
      tx.objectStore("family").put({ pass, profiles: names }, "active");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("Family storage was interrupted."));
    });
  } finally {
    db.close();
  }
  return { pass, profiles: names, claims };
}
export async function loadFamilyPass() {
  const db = await openFamilyDB();
  let saved;
  try {
    saved = await new Promise((resolve, reject) => {
      const request = db
        .transaction("family")
        .objectStore("family")
        .get("active");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
  if (!saved) return null;
  const claims = await verifyFamilyPass(saved.pass);
  if (
    !claims ||
    !Array.isArray(saved.profiles) ||
    saved.profiles.length > claims.seats ||
    saved.profiles.some(
      (p) =>
        typeof p?.name !== "string" || !p.name.trim() || p.name.length > 40,
    )
  )
    return null;
  return { ...saved, claims };
}
