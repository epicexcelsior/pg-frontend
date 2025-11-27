# Multi-User Dev Mode Testing Guide

This guide explains how to test the game with multiple authenticated users in a single browser without Privy popups.

## Quick Start

### 1. Enable Dev Mode on Backend

Set the following environment variable in your backend (.env):

```bash
DEV_AUTH_ENABLED=true
```

**Important**: Dev mode only works when:
- `NODE_ENV=development` (production mode blocks dev auth)
- Backend is running on localhost or 127.0.0.1

### 2. Open Frontend with Dev User Parameter

Open multiple tabs in the same browser, each with a different `devUser` URL parameter:

```
Tab 1: http://localhost:5173/?devUser=alice
Tab 2: http://localhost:5173/?devUser=bob
Tab 3: http://localhost:5173/?devUser=charlie
```

### 3. Test Multi-Player Interactions

Each tab now runs as a different user:
- User ID: `dev_<username>_<hash>`
- Wallet: `DevWallet<deterministic-address>`
- Twitter handle: `dev_twitter_<username><suffix>`

The wallets are **deterministic** — the same username always gets the same wallet address, so state persists across page reloads.

## What Dev Mode Does

When you add `?devUser=alice` to the URL:

1. **Frontend detection**: URL parameter is detected at page load
2. **Instant authentication**: User is logged in immediately without Privy popups
3. **Fake user data**: Consistent fake user with deterministic wallet address
4. **Token exchange**: Dev user header sent to backend `/auth/exchange-privy` endpoint
5. **Game token issued**: Backend issues real game JWT with dev wallet address
6. **Full game access**: User can claim booths, donate, earn coins, etc.

## Dev Wallet Addresses

Each dev user gets a consistent wallet address using hash-based derivation:

```javascript
// Example: devUser="alice"
// Hash: stable numeric hash of "alice"
// Wallet: DevWallet<44-char-padded-index>
```

This ensures:
- ✓ Same user gets same wallet on page reload
- ✓ Different users get different wallets
- ✓ Wallets are recognizable as dev wallets
- ✓ No conflicts with real wallet addresses

## Example Workflows

### Test Booth Claiming Across Players

**Tab 1 (alice):**
- Navigate to a booth
- Claim it
- See "Claim me" → "Give to @alice" on 3D screen

**Tab 2 (bob):**
- Navigate to same booth
- See "Give to @alice" (alice's booth)
- Can donate to alice

**Switch back to Tab 1:**
- See donation effects from bob

### Test Referrals

**Tab 1 (alice):**
- Get referral code (if feature exists)
- Share URL with referral code

**Tab 2 (bob):**
- Click referral link or join with code
- Alice and Bob both get referral bonuses

### Test Player Profiles

**Tab 1 (alice):**
- Set description on claimed booth
- Set up avatar/profile

**Tab 2 (bob):**
- View alice's profile
- See alice's booth with description

## Important Notes

### ⚠️ Security

- **Dev mode is disabled in production** - environment variable check + NODE_ENV check
- **Localhost only** - frontend/backend restrict to localhost/127.0.0.1
- **Console warnings** - Browser console shows `[DEV MODE]` warnings when active
- **No real authentication** - Privy is completely bypassed

### 📝 Data Persistence

Dev users' data is stored in the backend database like any other user:
- User profile, wallet, earnings, booth claims
- Persists across page reloads
- Can be reset via database if needed

### 🔄 Switching Between Dev and Real Auth

Simply remove the `?devUser=alice` parameter to use real Privy login:

```
http://localhost:5173/              # Real Privy auth
http://localhost:5173/?devUser=alice  # Dev mode fake auth
```

Both modes can coexist - just change the URL.

### 🎛️ Configuration

**Frontend** (`config.json`):
- `devEnabled: true` - Flag to enable dev mode (defaults to true in dev)
- `solanaCluster: "mainnet-beta"` - Can be set to "devnet" for DevNet testing (future use)

**Backend** (`.env`):
- `DEV_AUTH_ENABLED=true` - Enable dev token acceptance
- Must be combined with `NODE_ENV=development`

## Debugging Dev Mode

Open browser DevTools console to see dev mode status:

```javascript
// Check if dev mode is active
window.PG_PRIVY?.debugState()
// Output: { devMode: true, devUser: "alice", ... }

// Check current auth state
window.PG_PRIVY?.getAuthState()

// Manually trigger dev login (shouldn't be needed)
window.PG_PRIVY?.login()
```

## Future: DevNet Integration

This foundation supports easy switching to Solana DevNet. When added, you'll be able to:

```
http://localhost:5173/?devUser=alice&cluster=devnet
```

This will:
- Use devnet RPC endpoints (free SOL faucet)
- Test real transactions without mainnet fees
- Keep separate dev app ID for Privy (if using real Privy in dev)

## Troubleshooting

### Dev mode not working?

1. Check browser console for errors
2. Verify URL has `?devUser=username`
3. Confirm `DEV_AUTH_ENABLED=true` on backend
4. Check backend `NODE_ENV=development`
5. Verify running on localhost/127.0.0.1

### Getting "Privy bridge unavailable"?

- Ensure `npm run build` was run in pg-bundles
- Check that bundle.js loaded in HTML (check Network tab)
- Check browser console for `[DEV MODE]` warnings

### Each devUser getting same wallet?

- This is expected if dev users have different hashes but hash to same wallet
- Extremely unlikely (1 in 10000 chance per user)
- Can add random suffix if needed

## Next Steps

1. **Start backend**: `npm run dev` in pg-colyseus with `DEV_AUTH_ENABLED=true`
2. **Build bundle**: `npm run build` in pg-bundles
3. **Start frontend**: `npm run dev` in pg-frontend
4. **Open tabs**: Use URLs with different `?devUser=` params
5. **Test**: Interact across tabs, claim booths, donate, etc.

Enjoy seamless multi-user testing! 🚀
