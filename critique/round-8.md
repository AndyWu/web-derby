# CRITIQUE REPORT — ROUND 8

**Benchmark Comparison:** The Last of Us Series (Visual Weathering, PBR Mud/Water, Tactile Physics)

**Overall Build Score:** 16 / 20

The 23-test build corrects steering yaw, adds a persistent reverse gear, removes unintended reverse motor force, shows a first-drive guide, brightens truck thumbnails, and improves remote car placement. Synthetic browser input checks pass touch swipe, brake, held reverse, reverse remaining latched after release, R toggling it off, and tilt steering ([controls evidence](verify-controls.json)). Production screenshots at 844×390 show a much clearer [garage](round-8-mobile-garage.png), readable [guide](round-8-mobile-guide.png), and [portrait prompt](round-8-mobile-portrait.png). A critical layout issue remains: the garage Start button begins at y=404, below the 390 px viewport; Playwright scrolled it into view, but that cannot establish easy touch access for a player. This holds the score below 18.

## 1. Scene & Environment (2-Mile Country Dirt Road) [GPT-6 Sol - light]

- **Failure 1:** Current production screenshots of the revised mud and water edges have not been captured.
- **Failure 2:** Barn visibility from the road after the clearing change remains unverified.
- **Concrete Fix:** Capture the current cockpit at both hazards and the barn approach, then correct any hard seams or occlusion.

## 2. Network, Offline PWA & QR-WebRTC Star Topology [GPT-6 Astra - light]

- **Failure 1:** The two-page game proof remains limited to one guest; five-guest capacity is not field-tested.
- **Failure 2:** A real camera scan on Wi-Fi or Personal Hotspot has not been tested.
- **Concrete Fix:** Test physical QR setup with two devices, then connect all five guests on the target network.

## 3. Core Gameplay, Controls & Flag Physics [GPT-6 Sol - light]

- **Failure 1:** The Start button is below a 390 px landscape viewport in the garage (`y=404`), despite browser automation finding it.
- **Failure 2:** Larger iPad portrait sizes have not been checked for the rotate-device overlay.
- **Concrete Fix:** Keep garage actions within short landscape viewports and show the portrait prompt based on orientation across tablet sizes.

## 4. Audio & Diegetic Cockpit UI [GPT-6 Sol - light]

- **Failure 1:** First-drive guide content is readable, but it overlays the busy garage rather than presenting a distinct quiet onboarding scene.
- **Failure 2:** Bell, paddle, and impact audio still lack a physical speaker review.
- **Concrete Fix:** Increase guide backdrop opacity and review sound balance on the target phone/tablet.

## 5. The 10 Homemade Soap Box Trucks [GPT-6 Sol - light]

- **Failure 1:** Brightened thumbnails are clearer, but all ten cards remain crowded into a short 844×390 screen.
- **Failure 2:** Selected truck details, stats, and action buttons extend below the screen edge.
- **Concrete Fix:** Use a compact, vertically scrollable garage layout with the primary action persistently reachable.

## 6. Graphics, Lighting & PBR Shaders [GPT-6 Sol - light]

- **Failure 1:** New hazard graphics have no current production screenshot verification.
- **Failure 2:** The cockpit's large hood/wheel foreground still reduces forward road visibility.
- **Concrete Fix:** Inspect current mud/water views and reduce the foreground crop without losing the physical cockpit feel.

## 7. The 5 Tiered AI Agents [GPT-6 Sol - light]

- **Failure 1:** A single dropped guest was replaced successfully, but the five-AI production finish remains untested.
- **Failure 2:** Contact behavior is unit-tested but has not been observed in a browser race at speed.
- **Concrete Fix:** Capture a short browser collision and accelerated finish with five AI drivers and inspect the race board.

## NEXT-STEPS ROUTING CHECKLIST

- [ ] **@Scene-Agent (GPT-6 Sol [light]):** capture and review hazard and barn frames.
- [ ] **@Network-Agent (GPT-6 Astra [light]):** test real camera, hotspot, and five guests.
- [ ] **@Coding-Agent (GPT-6 Sol [light]):** fix short-landscape garage access and large-tablet portrait prompt.
- [ ] **@AudioUI-Agent (GPT-6 Sol [light]):** quiet guide backdrop and verify speaker mix.
- [ ] **@Trucks-Agent (GPT-6 Sol [light]):** preserve ten-card comparison in a scrollable mobile garage.
- [ ] **@Graphics-Agent (GPT-6 Sol [light]):** inspect current hazard shading and forward crop.
- [ ] **@AI-Agent (GPT-6 Sol [light]):** browser-check contact and full finish board.
