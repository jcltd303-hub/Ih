# Fish Frenzy — Production checklist

Use this before any **real-value SC** or public store launch. GC / offline arcade can ship earlier with “demo” labeling.

## P0 — Must ship for real SC

- [ ] **Firebase project** (prod + staging) with real `VITE_FIREBASE_*` in CI secrets — never commit keys that can write admin data
- [ ] **Anonymous + Google Auth** enabled; test account recovery
- [ ] Deploy **`firestore.rules`**, **`database.rules.json`**, **Cloud Functions**
- [ ] **`HMAC_SECRET_KEY`** (and any seed secrets) only in Functions secrets — not in the web bundle
- [ ] **SC balances** mutate only in Cloud Functions (`ensureUserWallet`, `processPlayerShot`) — client writes denied by rules
- [ ] **`startGameSession` / `revealSessionSeed`** live; every SC session starts with commit–reveal
- [ ] **Rate limits** on callable functions (App Check + per-UID quotas)
- [ ] **App Check** (Play Integrity / DeviceCheck) on callables
- [ ] Legal: jurisdiction, age gate, ToS, privacy policy, responsible-play links
- [ ] Confirm product is **sweepstakes / social casino / skill** path with counsel — do not invent compliance

## P1 — Strongly recommended

- [ ] Staging environment + emulator tests in CI for rules + `processPlayerShot`
- [ ] Monitoring: function errors, RTP realized vs 90% target, wallet anomalies
- [ ] Max bet / max daily SC loss caps server-side
- [ ] Multiplayer marked cosmetic **or** made authoritative
- [ ] WebGL context loss recovery (reload CTA already present)
- [ ] Penetration test on wallet and session endpoints
- [ ] Freeze client RTP tools as **operator/demo only**; production math on server at **90%** target

## P2 — Store / polish

- [ ] Real icons/splash (replace generated placeholders)
- [ ] Capacitor iOS/Android store listings, privacy nutrition labels
- [ ] Crash reporting (e.g. Sentry)
- [ ] Accessibility: contrast, touch targets, reduced-motion option

## Demo / GC-only (acceptable now)

- [x] Playable loop, lobby stake, hold-to-fire
- [x] Local P&L + Monte Carlo for operators
- [x] Offline fallback when Firebase unset
- [x] Client commit–reveal **fallback** when offline (not sufficient for SC)

## Current architecture notes

| Layer | Role |
|-------|------|
| Client `PayoutEngine` | UX FX + operator Monte Carlo / local demo ledger |
| `processPlayerShot` | Authoritative SC debit/credit when configured |
| `FairnessSession` | Commit hash at session start; reveal for audit |
| Firestore rules | Wallet write **false** for clients |

**Rule of thumb:** if SC can buy anything of value, the browser is untrusted. Ship Functions first.
