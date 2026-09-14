# Fish Frenzy — TODO

## Sprint: Trust & Wallet (1–4)

- [x] **1. Real Firebase project wiring**
  - Env-based config (`VITE_FIREBASE_*`) instead of dummy keys
  - Document setup steps for Auth, RTDB, Functions, rules deploy (`docs/FIREBASE_SETUP.md`)
  - Offline/demo fallback when config is missing (`isFirebaseConfigured`)

- [x] **2. Server-authoritative payouts**
  - Cloud Function decides hit/kill/payout from signed shot + target
  - Client displays local FX; settlement via `ShotSettlement` → `processPlayerShot`
  - Shared RTP tables server-side + nonce replay protection

- [x] **3. Auth UX**
  - Start-screen guest banner + “Sign in with Google to save progress”
  - `AuthManager.linkGoogle()` for anonymous account upgrade
  - Persist display name via profile + Auth

- [x] **4. Balance sync on win/loss**
  - Deduct/credit via `processPlayerShot` when online
  - HUD updates from `WalletService.applyServerBalances` / snapshots
  - Offline continues local balances + offline queue

## Later

- [x] Boss fight phases
- [x] Confirm weapon stats applied in `WeaponController` (verified in code)
- [x] Multiplayer presence sprites + shared shots on canvas
- [x] Economy sinks (skin unlocks vs server wallet)
- [x] Capacitor store polish (icons, safe areas)
- [x] Sound mix / mute persistence
- [x] First-run onboarding tips
- [x] Analytics events
- [x] CI + Firebase emulator tests (server payout mirror unit tests in CI)
- [x] Split `UIManager` modals (armory skins extracted)
- [x] WebGL/asset error recovery
- [x] Feature flags via env
