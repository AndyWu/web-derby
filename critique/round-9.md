# CRITIQUE REPORT — ROUND 9

**Benchmark Comparison:** The Last of Us Series (Visual Weathering, PBR Mud/Water, Tactile Physics)

**Overall Build Score:** 17 / 20

The short-landscape garage repair works: in production Chromium at 844×390, Start is fully inside the viewport (`y=312–356`) and the [garage](round-9-mobile-garage.png) keeps all ten choices accessible. The [first-drive guide](round-9-mobile-guide.png) remains readable. Both [phone portrait](round-9-mobile-portrait.png) and [1024×1366 tablet portrait](round-9-tablet-portrait.png) show the rotate prompt, while a desktop portrait viewport does not ([mobile evidence](verify-mobile.json)). Offline reload still passes after the new icons ([offline evidence](verify-offline.json)). Browser transport testing connected five guests to one host, delivered inputs and snapshots, and rejected a seventh seat ([six-peer evidence](verify-six-peers.json)). Six demo profiles survived reload and rejected tampering or a seventh profile ([family proof](verify-family.json)). This is close to a complete prototype, though its materials and real-device tactile quality remain below the benchmark.

## 1. Scene & Environment (2-Mile Country Dirt Road) [GPT-6 Sol - light]

- **Failure 1:** The revised hazard seams still lack fresh production screenshot verification.
- **Failure 2:** The barn approach after the clearing adjustment has not been checked from the driver's seat.
- **Concrete Fix:** Capture mud, water, and barn approach frames in the final build and correct any visually hard borders or occlusion.

## 2. Network, Offline PWA & QR-WebRTC Star Topology [GPT-6 Astra - light]

- **Failure 1:** Six peers worked on one loopback browser host, but a physical Personal Hotspot session remains untested.
- **Failure 2:** Camera QR scanning remains untested on actual iPads or phones.
- **Concrete Fix:** Run a physical two-device QR and hotspot acceptance test before relying on the offline family flow in the field.

## 3. Core Gameplay, Controls & Flag Physics [GPT-6 Sol - light]

- **Failure 1:** The six-peer proof checks transport, but it does not run a complete six-player game to finish.
- **Failure 2:** Browser route tests still need focused modes because a full software-WebGL flow is slow and timing-sensitive.
- **Concrete Fix:** Add an accelerated six-seat game lifecycle test that checks start, pause/return, disconnect/rejoin, and finish.

## 4. Audio & Diegetic Cockpit UI [GPT-6 Sol - light]

- **Failure 1:** Start bell and impact mix have not been heard on real speakers.
- **Failure 2:** The first-drive guide explains controls with text but lacks a brief motion example for tilt and paddle timing.
- **Concrete Fix:** Validate sound on the target device and add a short animated control demonstration to onboarding.

## 5. The 10 Homemade Soap Box Trucks [GPT-6 Sol - light]

- **Failure 1:** In 844×390, the compact truck strip makes the thumbnails small again.
- **Failure 2:** Fine visual differences among several trucks remain hard to see at that size.
- **Concrete Fix:** Keep the compact strip but show a larger selected-truck detail panel when a card is tapped.

## 6. Graphics, Lighting & PBR Shaders [GPT-6 Sol - light]

- **Failure 1:** The current visual build lacks final mud/water/barn screenshots at race height.
- **Failure 2:** Even in prior shots, road and foliage shading remain far simpler than the weathered benchmark.
- **Concrete Fix:** Capture final scene frames and prioritize large visible material variation over further tiny geometric detail.

## 7. The 5 Tiered AI Agents [GPT-6 Sol - light]

- **Failure 1:** AI and contact behavior pass tests, but no production browser trace covers a complete six-car finish.
- **Failure 2:** The finish board has not been inspected with one remote driver and five remaining racers in a final build.
- **Concrete Fix:** Run an accelerated browser finish and verify every result line, including a disconnected guest's AI substitute.

## NEXT-STEPS ROUTING CHECKLIST

- [ ] **@Scene-Agent (GPT-6 Sol [light]):** capture final mud, water, and barn approach frames.
- [ ] **@Network-Agent (GPT-6 Astra [light]):** perform real QR and hotspot acceptance testing.
- [ ] **@Coding-Agent (GPT-6 Sol [light]):** prove a complete game lifecycle with rejoin and finish.
- [ ] **@AudioUI-Agent (GPT-6 Sol [light]):** review physical speaker mix and improve control demonstration.
- [ ] **@Trucks-Agent (GPT-6 Sol [light]):** show larger selected truck on short landscape screens.
- [ ] **@Graphics-Agent (GPT-6 Sol [light]):** inspect final scene material response.
- [ ] **@AI-Agent (GPT-6 Sol [light]):** verify a six-car browser finish board.
