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

- [ ] Boss fight phases
- [ ] Confirm weapon stats applied in `WeaponController` (already wired; re-verify in playtest)
- [ ] Multiplayer presence sprites + shared shots on canvas
- [ ] Economy sinks (skin unlocks vs server wallet)
- [ ] Capacitor store polish (icons, safe areas)
- [ ] Sound mix / mute persistence
- [ ] First-run onboarding tips
- [ ] Analytics events
- [ ] CI + Firebase emulator tests
- [ ] Split `UIManager` modals
- [ ] WebGL/asset error recovery
- [ ] Feature flags via env
