# Privy Inline Integration Overview

This document captures the inline Privy integration work completed for the PlayCanvas front end. It summarizes the architecture, highlights the key code paths, and lists the notable differences from the original popup-based flow.

## High-Level Architecture
- **Shared bundle (`pg-bundles`)**
  - Adds React, React DOM, and the Privy React SDK with Solana helpers to the existing webpack bundle.
  - Introduces `src/privyBridge.jsx`, a headless React app that mounts a hidden overlay, hosts `<PrivyProvider>`, and exposes a browser-global API under `window.PG_PRIVY`.
  - Exposes only the required globals (`window.SolanaSDK.web3`, `Colyseus`, `gsap`, etc.) so existing PlayCanvas scripts keep working without bundling unused wallet adapters.
- **PlayCanvas integration (`pg-frontend`)**
  - `PrivyManager` now supports two modes: `popup` (legacy) and `inline` (new default once enabled).
  - Inline mode bootstraps the bridge, subscribes to `PG_PRIVY` auth events, and routes login/logout/transaction/Twitter calls through the new API.
  - Popup mode remains intact as a fallback; configuration toggles determine which mode is active.

## Runtime Flow (Inline Mode)
1. `PrivyManager.bootstrapConfig` reads the PlayCanvas config asset and, when `privyIntegrationMode` is `"inline"`, calls `PG_PRIVY.initialize(...)` with runtime options (app id, Solana RPC URLs, login methods, appearance overrides).
2. The React bridge renders a dormant overlay DOM node. When Privy reports `ready`, the bridge notifies `PrivyManager` via `auth:stateChanged` events.
3. PlayCanvas scripts keep using the same `privyManager.login/logout/sendTransaction/linkTwitter/openUserPill` methods. The manager automatically forwards those calls to the inline bridge (or the popup host when configured).
4. Auth state updates continue to be broadcast through `app.fire('auth:stateChanged', ...)`, so downstream systems (`PlayerData`, `WalletWidget`, donation flow, etc.) remain unchanged.

## Configuration
`Scripts/config.json` gained additional keys that are only required when inline mode is enabled:

- `privyIntegrationMode`: `"popup"` (default) or `"inline"`.
- `privyAppId`: Privy application id (must be set for inline mode).
- Optional Solana RPC overrides:
  - `privySolanaRpcProxyUrl`
  - `privySolanaMainnetWsUrl`
  - `privySolanaDevnetRpcUrl`
  - `privySolanaDevnetWsUrl`
- `privyLoginMethods`: Defaults to `["twitter", "wallet"]`.

Leaving the file in `"popup"` mode preserves current behaviour until we are ready to switch.

## UI & Service Updates
- **Wallet widget (`Scripts/UI/WalletWidget.js`)**
  - Button handlers now handle promise rejections, surfacing feedback if inline operations fail or if Twitter is already linked.
- **Donation service (`Scripts/Donations/DonationService.js`)**
  - Updated copy to remove the popup-specific language while the workflow stays identical.
- **Privy manager (`Scripts/Core/PrivyManager.js`)**
  - Inline bridge initialization, event handling, and method overrides.
  - Maintains popup messaging listener for backwards compatibility.
  - Ensures pending actions are flushed once either mode becomes ready.
  - Twitter OAuth now prefers a dedicated tab/popup and only falls back to inline when every windowing strategy is blocked.

No other UI components required behavioural changes because the events (`auth:stateChanged`, `privy:userPillAction`, donation state notifications) remain the same.

## Deviations From The Draft Plan
| Plan Item | Actual Implementation |
|-----------|----------------------|
| Enable inline mode by default | Default remains the popup until configuration opt-in (`privyIntegrationMode: "inline"`) is set, to allow a gradual rollout. |
| Immediate removal of popup host | Popup code remains fully functional; inline mode falls back automatically if initialization fails (e.g., missing app id). |
| Dedicated React UI expansion | Only the Privy overlay is rendered today. Additional React-driven HUD elements can be layered into the bridge in follow-up tasks. |
| Token exchange on every inline event | Auth state changes are deduplicated before calling `handleAuthSuccess` to avoid repeated `/auth/exchange-privy` requests with identical credentials. |

## Testing & Verification
- `npm run build` executed in `pg-bundles` to ensure the updated bundle compiles (note: webpack reports bundle-size warnings; worth revisiting with code-splitting later).
- Manual walkthroughs still required:
  - Login/logout using inline mode on desktop and mobile.
  - Donation flow (including Solana Pay) to confirm transaction signing.
  - Twitter linking and the wallet widget controls.

Known warnings: Installing React 19 triggers peer dependency warnings from a few wallet libraries; these mirror the host-app setup and do not break the bundle, but we should monitor upstream updates.

## Next Steps
1. Populate `privyAppId` and switch `privyIntegrationMode` to `"inline"` in the production config when ready.
2. Smoke-test the inline experience across browsers and mobile (especially pointer/touch handling on the overlay).
3. Consider splitting the React bridge into a lazily-loaded chunk if load performance regresses.
4. Once stable, retire the `privy-host-app` deployment to simplify hosting and CSP settings.
