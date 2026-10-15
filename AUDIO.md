# Derby audio integration

Create one `DerbyAudio` instance. Call `await audio.start()` in a button or key handler to unlock Web Audio, then call `audio.startRace()` when the physical gate releases. The latter plays three struck metal notes.

During racing, call `audio.update(racer.speed, surfaceAt(racer.s, racer.lateral), input.brake, dt)` each frame. `surface` accepts a string or an object with `type`; asphalt, gravel, dirt, grass, field, and mud have different tire textures. Call `audio.stroke(-1)` or `audio.stroke(1)` on left/right kick actions. Call `audio.impact('wood' | 'metal' | 'barrier', strength, side)` for collisions, with `strength` in 0–1 and `side` in -1–1.

Call `audio.suspendRace()` on return to garage so the running textures fade out. Call `audio.setMuted(flag)` for the sound toggle and `audio.dispose()` during teardown. All sounds are synthesized; no external audio files are required.
