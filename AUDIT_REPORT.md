# Fish Frenzy — Business Logic Audit

## Round 1 (fixed)

### Critical: provably-fair system was disconnected from real outcomes
Every roll is now derived from `sha256(serverSeed:clientSeed:nonce)`, matching `ProvablyFairAuditor` on the client. An active session is required.

### Critical: HMAC secret was shipped to the browser
Client-side signing removed. Authorization is Firebase Auth + a per-request idempotency key. `CryptoSigner` kept as a deprecated stub.

### High: region/compliance check could fail open
`validateRegion.ts` now fails closed when no verified edge header is present; no longer trusts client-claimed state.

### Medium: daily SC loss cap was checked after the loss landed
Now checked pre-commit, inside the same transaction as the payout.

## Round 2

### 🔴 Critical (open, needs a product decision): server never verifies a hit or kill actually happened
`processPlayerShot` still takes `clientHitConfirmed` / `clientKillConfirmed` / `fishType` / `skinBonus` as given. The fair-RNG fix makes the *roll* trustworthy but not the *claim* that triggers it — someone calling the function directly can assert a hit on every request. Fully solving this means either replicating hit detection server-side (expensive given boid/collision physics) or building statistical anomaly detection on claimed hit/kill rates. Flagged, not solved.

**Partial mitigation shipped:** kill-claim dedup. `processPlayerShot` now tracks `sessions/{sessionId}/killedTargets/{targetId}` and only pays out a kill once per targetId per session; a repeated claim for the same target still gets the hit payout (rolled fairly) but not a second kill payout. This closes the "replay the same successful targetId to double the kill payout" vector. It does **not** close the ability to fabricate a fresh `targetId` per request — that's the bigger open item above.

Also shipped: a claimed-win burst limiter (`MAX_CLAIMED_WIN_SC_PER_MINUTE` / `_GC_PER_MINUTE` in `limits.ts`), a rolling 60s cap on total payout claimed per currency, independent of the shot-count rate limit, so a burst of large wins can't slip through right at a rate-limit window boundary. Tunable, not a precise economic model — revisit with real payout telemetry.

### 🟠 High (open): compliance_audit_logs can be polluted by the client
`src/compliance/AuditLogger.ts` writes client-side into the same Firestore collection that `validateRegion.ts` writes to via Admin SDK. Firestore rules make it create-only, but a client can still self-report fabricated entries under their own uid. Not yet fixed — recommend separating collections or adding a server-only-settable `verifiedByServer` flag enforced by rules.

### 🟡 Medium (informational, no fix needed): operator payout panel is per-browser localStorage
Confirmed `startGameSession.ts` hardcodes `targetRtp: 90` server-side, so a player editing their own localStorage can't change their real odds — this only affects local/offline visual numbers. Just don't present this panel as real aggregate P&L to operators.

### Housekeeping shipped
- `cleanupProcessedRequests.ts`: scheduled function (`every 24 hours`) deleting idempotency-key docs older than 48h via a batched collection-group query. Needs the collection-group index in `firestore.indexes.json` (added) deployed before the function runs.
- Player-facing fairness verification: `ShotSettlement` now surfaces `fairNonceStart`/`fairNonceEnd` from each settlement and feeds the running high-water mark into `FairnessSession`. `auditModal.ts` shows the verifiable nonce range for the session and lets the player check any specific nonce's roll on demand once the seed is revealed, instead of a single hardcoded sample.

## Suggested follow-ups (still not implemented)
- Statistical anomaly detection on claimed hit/instant-kill rates vs. expected probabilities, as a lighter-weight step toward the open Critical item above.
- Separate `compliance_audit_logs` (server-verified) from client telemetry, or add a rules-enforced `verifiedByServer` flag.
- Audit for other hardcoded fallback secrets (`grep -rn "|| '" functions/src src`).
- End-to-end emulator test asserting `processPlayerShot` results match an independently computed `ProvablyFairAuditor.verifyOutcome`.
