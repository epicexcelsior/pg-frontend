# Pls Give – Frontend (PlayCanvas)

This repo is the PlayCanvas game client: a 3D world plus HTML overlays (login, chat, donation, leaderboard, tutorials, etc.) running in desktop and mobile browsers.

Agents should read this file before editing scripts or UI.

---

## Build & Test

There is **no local build pipeline** here: PlayCanvas Editor manages building and hosting.

Use the PlayCanvas Editor:

- Edit scripts and UI assets in this repo, then upload/update them in the Editor.
- Use the Editor’s **Launch/Play** to run the game and test changes.
- Prefer **PlayCanvas hot reloading** over full page reloads where possible (see below).

For complex features that are painful to test end-to-end (e.g. sending a donation):

- Consider adding a small, temporary **debug-only path or panel** that triggers the feature with minimal setup.
- Keep it clearly marked and easy to remove/disable once you’re done.

---

## Architecture Overview

High-level layout:

- `Scripts/`
  - `Core/` – services (config, UI orchestration, audio, tutorials, auth token handling, etc.).
  - `Network/` – connection management and message routing to the backend (Colyseus/HTTP).
  - `Player/` – input, camera, animation, nameplates, local coin display.
  - `Booths/` – booth claiming and interaction logic.
  - `Donations/` – client-side donation flow hooks and FX.
  - `SceneMgmt/` – load orchestration, scene transitions.
  - `FX/` – camera shake, donation effects, toasts, polish.
  - `UI/` – HTML bridge scripts, theme helpers, HUD and overlays.
  - `Utils/` – general helpers (especially for UI input handling).
- `UI/`
  - HTML/CSS for overlays (Login, Donation, Leaderboard, Chat, Wallet widget, Avatar customizer, Tutorial steps, etc.).

**Separation of concerns:**

- PlayCanvas scripts manage **world/game logic and events**.
- HTML bridge scripts own **DOM interactions**, forwarding events into/out of the game.
- Networking goes through `Scripts/Network/` scripts, not directly from every gameplay script.

---

## Conventions & Patterns

### Scripting

- Existing code uses **Classic (`.js`) PlayCanvas scripts**.
- For **new scripts**, prefer **ESM (`.mjs`) scripts** with the modern `Script` base class and class syntax:
  - `import { Script } from 'playcanvas';`
  - `export class MyScript extends Script { static scriptName = 'myScript'; … }`. :contentReference[oaicite:1]{index=1}  
- Do **not** mass-migrate or rename existing scripts unless the task explicitly says so; script names are wired into the Editor.

General rules:

- Keep `initialize()` for setup, `update(dt)` for per-frame logic.
- Avoid allocations in `update()` (e.g. don’t create new vectors every frame).
- Use script attributes / `@attribute` comments so designers can tweak values in the Editor.

### Hot reloading

We want fast iteration:

- Enable PlayCanvas **hot-swapping** on scripts you expect to tweak often by implementing:
  - `swap(old) { /* copy state and fix listeners */ }`.
- In `swap(old)`:
  - Copy non-attribute state from `old` to `this`.
  - Remove event listeners from `old` and re-attach them on `this`.
  - Remember that declared attributes are copied automatically. :contentReference[oaicite:2]{index=2}  

Hot reload is especially useful for UI, camera, and FX scripts where you iterate frequently.

### UI behavior & UX rules

Key invariants:

- **No player movement or camera rotation while typing in any HTML input.**
  - Any new input (chat, donation amounts, feedback, username, booth description, etc.) must:
    - Signal when focus is gained, so movement/camera scripts pause input.
    - Signal when focus is lost, so controls resume.
- UI should **align with existing styling and behavior**:
  - Reuse current CSS classes, spacing, and button patterns.
  - Prefer extending existing panels/components instead of inventing new styles.

Additional UX expectations:

- **ESC closes the topmost open panel** where reasonable.
- Panels should not permanently block each other; avoid flows where one overlay makes another impossible to reach or close.
- All UI and interactions must work on **both desktop and mobile**:
  - Avoid hover-only interactions.
  - Ensure buttons and touch targets are large enough and not too close together.

### DOM & HTML bridges

- Game/world scripts should **not** query the DOM directly.
- HTML bridge scripts under `Scripts/UI/HtmlBridge/`:
  - Own `document.querySelector`/event handlers on DOM elements.
  - Emit PlayCanvas events into the app (e.g. “donation confirmed”, “login requested”).
  - React to game events to open/close panels, update text, etc.

Whenever you add or change UI:

- Wire new panels through an HTML bridge script rather than mixing DOM logic into gameplay scripts.
- Try to follow patterns used in existing HTML bridge files before inventing new ones.

### Networking

- Networking is centralized under `Scripts/Network/`.
- Gameplay scripts should:
  - Emit high-level events or call provided network service methods.
  - Avoid opening their own sockets or talking to Colyseus directly.
- New network behaviors should be added through the existing network manager/message broker patterns, not ad-hoc.

---

## Security

- The **backend is authoritative** for coins, donations, referrals, booth ownership, and player identity.
- Frontend must **not**:
  - Verify Solana signatures.
  - Treat local balances as final truth.
  - Embed secrets, private keys, or sensitive configuration.
- It’s fine to optimistically update UI, but always be prepared to reconcile with server state.

---

## Agent Guidance & Gotchas

- If you’re confused or missing context:
  - **Ask questions** instead of guessing.
  - Call out ambiguities or contradictions in existing code/docs.
- If you have a clearly better plan (simpler, safer, or more performant):
  - **Propose it and explain why**, even if it differs slightly from past patterns.
  - This includes mistakes or oversights in the context or instructions I give you; **push back** if you have a better recommendation.
- Be cautious with:
  - Renaming scripts or changing `scriptName` (will break Editor assignments).
  - Changing global UI interactions (e.g. ESC behavior) without checking how multiple panels interact.
- For large UI or input changes, consider adding a temporary debug UI to test quickly, and mention in your notes how to remove/disable it when the feature stabilizes.
