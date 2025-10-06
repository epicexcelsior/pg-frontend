Hi Breakout judges!

**Game link:** https://play.plsgive.com
(landing page: https://plsgive.com)

This repo stores frontend (client-side) scripts for PlayCanvas.
Other important repos you can access:
- **Colyseus**: Backend game server, handles real-time features, booth claims, chat, and other shared states.
  -   https://github.com/epicexcelsior/pg-colyseus
- **Cloudflare Workers**: Backend for player AuthC, SIWS, and Solana transactions.
  -   https://github.com/epicexcelsior/pg-cf-workers

## Avatar Customization v2

This branch introduces the modular Quaternius-based avatar system used by the in-game customizer. Runtime scripts live under `Scripts/PlayerCustomization/` and drive slot-based swaps (head/body/legs/feet), lazy loading, caching, local persistence, and Colyseus recipe sync. The HTML front-end for the customizer sits in `UI/AvatarCustomizer/` with its bridge logic at `Scripts/UI/HtmlBridge/HtmlAvatarCustomizer.js`.

**Wire-up snapshot**
- Attach `avatarCustomization.js` to your gameplay bootstrap entity and assign `AvatarCatalog.json` to the `catalogAsset` attribute.
- Drop `HtmlAvatarCustomizer.js` on a UI helper entity, pointing it at the customizer HTML/CSS assets.
- Ensure the player prefab exposes `Armature` with `SlotHead`, `SlotBody`, `SlotLegs`, `SlotFeet`; `PlayerSync.playerPrefab` should reference `PlayerAvatarV2`.
- MessageBroker now relays `avatar:recipe`; server must echo `{ playerId, recipe }` to keep remote avatars in sync.

**Rollback**
If you need to fall back to the legacy Wolf3D character, reassign `PlayerSync.playerPrefab` to the previous template and disable the `avatarCustomization` and `htmlAvatarCustomizer` scripts. The remaining code is passive until those scripts run.
