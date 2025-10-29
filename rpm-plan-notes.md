Phase 1 — RPM iframe integration
- Replaced HtmlAvatarCustomizer with RPM Creator overlay, wiring Ready Player Me iframe flow and secure postMessage handling.
- Added global input suspension/resume around the overlay while leaving audio untouched; exposed `avatar:rpm:*` events for later phases.
- Extended avatar customizer CSS to support full-screen or 90% inset layouts and new loading/error states.

Deviations / Follow-ups
- Awaiting the real Ready Player Me subdomain to configure `rpmSubdomain`; until then origin checks stay in safeguard mode and exports remain ignored.

Phase 2 — RPM avatar loading
- Implemented GLB loading pipeline in AvatarLoader with caching, atomic swaps, and anchor rebinding for Ready Player Me avatars.
- Wired AvatarCustomization/AvatarController to call the new loader for local and remote players, persisting avatarId descriptors and reacting to iframe exports.
- Updated movement/animation scripts to react to avatar swaps; fallback animations still pending for RPM rigs (Phase 4).
Deviations / Follow-ups
- Need to finish RPM animation retargeting (Phase 4) and verify network sync schema for avatarId with backend.

Phase 3 — LOD & Sync
- Added Ready Player Me descriptor pipeline end-to-end (frontend + colyseus) so avatarId and URL validate on the server, persist, and sync to peers.
- Introduced distance-based LOD swapping (desktop/mobile presets, hysteresis, caching) driven from client postUpdate, with sanitized remote roots so rotations follow the new model.
- Updated iframe integration to use clearCache and general origin fallback for development with the configured pls-give subdomain.
Deviations / Follow-ups
- Need QA on actual device tiers to tune LOD thresholds and confirm rotations after long sessions.

Phase 4 — Jump & Emotes
- Added animation clip registry + playClip abstraction, wiring Wave menu/spacebar to shared triggers and networking.
- Implemented simple grounded jump with impulse and cooldown, reusing animation events for replication.
- Enabled additional emote options in the radial menu and kept placeholders ready for RPM clips.
Deviations / Follow-ups
- Placeholder triggers rely on existing anim graph; once RPM clips are imported we should swap registry entries and retune cooldowns.



