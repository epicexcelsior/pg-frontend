# **PLS GIVE** • Making Generosity 1000x More Fun.

---

## 🔗 Links

- 🎮 **Play the game:** [play.plsgive.com](https://play.plsgive.com)
- 🌐 **Site:** [plsgive.com](https://plsgive.com)
- 🐦 **X / Twitter:** [@playplsgive](https://x.com/playplsgive)
- 💬 **Discord:** [dsc.gg/plsgive](https://dsc.gg/plsgive)
- 📽️ **Pitch:** [https://www.youtube.com/watch?v=ZS4BxUBT_ls](https://www.youtube.com/watch?v=ZS4BxUBT_ls)
- 📽️ **Demo:** [https://www.youtube.com/watch?v=ZS4BxUBT_ls](https://www.youtube.com/watch?v=TLdWDhbMP9E)

---

## 🧭 Repo Map

### 1. 🎮 Frontend (You Are Here)
**`pg-frontend`**  
- All scripts that run on the PlayCanvas client
- Visual changes were made with the PlayCanvas editor

---

### 2. 🕸️ Realtime Game Server & Backend (Colyseus)
**`pg-colyseus`** - https://github.com/epicexcelsior/pg-colyseus
- Handles rooms, player presence, booth claiming, chat, world sync, *everything* client-side in the game
- Facilitates security & database interactions
- Hosted on a DigitalOcean VPS

---

### 3. 🔐 **Privy Host App** (Auth, transactions)
**`privy-host-app`** - https://github.com/epicexcelsior/privy-host-app
- React host for Privy to open in a pop-up separately from PlayCanvas frontend
- Handles auth with external wallets or X OAuth (creates embedded wallet)
- Handles SOL token transfers
- Key export functionality is included

---

### 4. 📨 **Helius RPC Proxy**
**`helius-rpc-proxy`** - https://github.com/epicexcelsior/helius-rpc-proxy
- Proxy for Helius RPC requests (transfer transactions, fetching user lamport balances, etc.) to avoid exposing API keys. Handles rate limiting & headers
- Hosted on a Cloudflare Worker

---

### 5. 📦 **PlayCanvas External Bundle**
**`pg-bundles`** - https://github.com/epicexcelsior/pg-bundles
- Host JS bundles (Solana Wallet Adapter, Helius client, shared UI, RPC helpers)  
- Loaded by PlayCanvas via external scripts to avoid re-publishing the scene

---

### 6. 🚁 **Landing Page**
**`pg-landing`** - https://github.com/epicexcelsior/pg-landing
- Public URL: https://plsgive.com  
- Hosted on Cloudflare Pages  
