# Hollow Run

A Three.js offline-first soapbox racing prototype, with a 3,218 metre procedural country course, ten salvaged vehicles, five AI drivers, physical cockpit controls, WebAudio, and QR-signaled local WebRTC.

## Run

`npm install`, then `npm run dev`. Production: `npm run build`, then `npx vite preview`. HTTPS or localhost is needed for device motion, camera, crypto and service workers. Install from Safari's Share → Add to Home Screen after the offline cache is ready.

## Controls

Landscape only on mobile. Enable tilt in the garage from a user gesture. A/D or arrows steer; alternate W/S to paddle; Space brakes; L toggles the lamp; R toggles forward/reverse gear. Touch: swipe down in either edge zone to go, up to slow/reverse, and rest both thumbs to brake. Use the dashboard lamp switch. Physical steering, pedals and levers animate with input. The hood flag communicates speed; there is no speed HUD.

## Multiplayer

Every device must load and cache the app beforehand, then share a local network with peer traffic enabled. Host creates an offer QR, guest scans it and returns an answer QR, host scans the answer; repeat up to five guests. Copy/paste is available. The host owns simulation and AI; guests send inputs and interpolate state. See NETWORK.md for limitations.

Apple documents Personal Hotspot for Wi-Fi + Cellular iPads using cellular data, not a general SIM-free ad-hoc bridge: https://support.apple.com/en-gb/guide/ipad/ipadb2c87b68/ipados . A web app cannot create a local Wi-Fi network. Complete SDP exceeds 250 bytes; compact QR compression preserves the data required to connect. Local WebRTC delivery latency depends on hardware and network.

## Scope and verification

This is a playable procedural prototype, not Last of Us visual fidelity. Paid Family Sharing requires a trusted entitlement issuer and purchase integration; included offline six-seat signatures are explicitly demo passes. Real six-iPad Safari gyro, camera, PWA storage retention and hotspot interoperability require device testing. Physics, AI unit tests and browser critic evidence live in `critique/`.

`npm test` covers physics, contacts, reverse gearing, input handling, AI full-course racing and Hermite interpolation. `node scripts/verify.mjs` provides focused browser modes: visual, mobile, scenes, network, controls, game and offline. Offline checks use a production preview on port 4173; isolated network checks use the development server on port 5173. The `DERBY_URL` and `DERBY_ROUND` environment variables select the target and evidence filenames.

Browser evidence also covers a real six-peer WebRTC star on one machine, QR pixel round-trips, guest truck rosters, disconnect takeover, and six signed demo profiles in IndexedDB. Loopback testing does not establish radio latency, Safari permissions, or six-device rendering performance. The physics combines road-guided travel with Cannon spring/contact suspension; water uses animated material and sky reflections rather than screen-space scene reflections. Models and scenery are procedural assets.

### iOS tilt steering

Open the HTTPS game directly in Safari on iPhone or iPad. Tap **Enable iOS tilt steering**, allow motion access, then hold the device upright in landscape until tilt steering is ready. Turn it like a steering wheel; use **Recenter** at a comfortable neutral position. Both landscape directions and accelerometer fallback are supported. Embedded browsers may block motion access. Automated Chromium and WebKit checks use simulated sensors; physical iOS validation remains necessary.

### Thumb drive controls

During a race, swipe down in either translucent edge zone to bank a ten-second forward push. Swipe up to brake progressively and ease into slow reverse. Hold both thumbs still in the zones for the handbrake; release either thumb to coast. When the forward push expires the car eases into a slow downhill roll. The dashboard LAMP switch controls the headlight, and the upper-left counter shows live race position out of six. These touch commands also travel through the authoritative family-race input channel.
