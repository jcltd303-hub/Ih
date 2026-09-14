# Fish Frenzy — Business Logic Audit

## 🔴 Critical: provably-fair system is disconnected from real outcomes

- `functions/src/startGameSession.ts` commits `serverSeed` / `serverSeedHash`
  per session (correct commit-reveal pattern).
- `src/utils/ProvablyFairAuditor.ts` (and `FairnessSession.verifyRoll`) can
  deterministically recompute a roll from `serverSeed:clientSeed:nonce`.
- **But** `functions/src/processPlayerShot.ts` never used the seed — every
  hit/crit/kill roll was `Math.random()`. The session's `nonce` field was
  read and incremented but never fed into anything.

Net effect: the "provably fair" verification flow was real cryptography
wired to nothing. A player who revealed the seed and recomputed rolls would
get numbers with no relationship to what they were actually paid.

**Fix applied:** every roll is now derived from
`sha256(serverSeed:clientSeed:nonce)` (same construction as
`ProvablyFairAuditor`), consuming one nonce per roll. An active session is
now required (previously optional — silently skipped if missing, which
meant no seed material at all).

## 🔴 Critical: HMAC secret was shipped to the browser

`src/network/CryptoSigner.ts` (runs in the browser) and
`functions/src/processPlayerShot.ts` (server) shared the same hardcoded
fallback secret. Since the client computed the signature itself, the
"secret" was readable in the shipped JS bundle by anyone. It provided the
*appearance* of request-integrity protection with none of the substance.

**Fix applied:** dropped client-side signing entirely. The real security
boundary is Firebase Auth (the server verifies `request.auth.uid`
independently via the ID token) plus a per-request idempotency key. A
shared secret known to the client added nothing. `CryptoSigner` is kept as
a deprecated stub in case anything else imports it.

## 🟠 High: region/compliance check could fail open

`functions/src/validateRegion.ts` only read `x-vercel-ip-country` /
`cf-ipcountry`. Firebase Cloud Functions won't have those headers unless
specifically fronted by that CDN. If absent, country silently defaulted to
`'US'` and state fell through to **`clientClaimedState`** — fully
client-controlled input — for what is a legal jurisdiction gate.

**Fix applied:** fail closed when no verified edge header is present
(don't default to allow, don't trust client-claimed state). You should
still confirm in production which header your actual deployment target
injects — this is a compliance/legal verification item, not something
resolvable from the repo alone.

## 🟡 Medium: daily SC loss cap was checked after the loss landed

`assertDailyScLoss` ran after the payout transaction committed, so the bet
that crossed the cap was always allowed through; only the next bet got
blocked.

**Fix applied:** moved the check inside the transaction, evaluated against
existing loss + this bet's potential loss, before committing.

## Behavior changes to be aware of

- `processPlayerShot` now **requires** an active `sess_*` session. The
  client already does this via `FairnessSession.begin()` in
  `GameScene.startPlay()`, so no client change was needed there — but any
  other caller that skipped session creation will now get
  `failed-precondition` instead of silently falling back to unseeded
  randomness.
- `ShotSettlement` no longer sends a `signature` field; `processPlayerShot`
  no longer checks for one.

## Suggested follow-ups (not yet implemented)

- Public "verify my last session" tool so players can recompute rolls
  themselves from a revealed seed.
- Anomaly detection on `fairNonceStart`/`fairNonceEnd` gaps and win-rate
  deviation from `targetRtp`.
- Audit for other hardcoded fallback secrets
  (`grep -rn "|| '" functions/src src`).
- End-to-end emulator test asserting `processPlayerShot` results match an
  independently computed `ProvablyFairAuditor.verifyOutcome`.
