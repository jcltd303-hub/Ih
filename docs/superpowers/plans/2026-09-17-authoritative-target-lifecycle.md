# Authoritative Target Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every payout-bearing gameplay target server-issued and session-bound, enforce an irreversible close/reveal boundary, and verify hostile-client behavior.

**Architecture:** Firebase Functions remain the sole financial authority. A session owns a private server-side target registry; the client may reference issued target IDs but cannot create or mutate payout state. Session closure is a one-way server transition that blocks further settlement before seed reveal. Boss progression remains private/server-authoritative.

**Tech Stack:** TypeScript, Firebase Admin SDK, Firestore transactions, Vitest, Firebase Emulator where available.

**Spec:** `docs/superpowers/specs/2026-09-17-production-settlement-security-design.md`

## Global Constraints

- Active server seeds remain inaccessible to clients until irreversible session close/reveal.
- Client collision, fish type, skin bonus, kill, and progression claims are never financial authorities.
- Accepted shots have exactly one financial effect and one canonical retry result.
- Firebase Auth remains the user boundary.
- Preserve deterministic fairness and payout-table versioning.
- Keep the current Firebase-native architecture.
- First release remains play-money only.

---

### Task 1: Server-issued target registry

**Files:**
- Modify: `functions/src/startGameSession.ts`
- Modify: `functions/src/processPlayerShot.ts`
- Modify: `functions/src/authoritativeTargets.ts`
- Test: `functions/test/authoritativeSettlement.test.ts`

- [ ] Write failing tests proving an unknown target cannot settle and an issued target is bound to its session.
- [ ] Run targeted tests and confirm failure.
- [ ] Add server-side target issuance/validation helpers and create an initial target registry for each session.
- [ ] Change settlement to require an issued target and reject arbitrary client-created IDs.
- [ ] Run targeted tests and confirm pass.
- [ ] Commit the target lifecycle change.

### Task 2: Irreversible session close/reveal

**Files:**
- Modify: `functions/src/startGameSession.ts`
- Modify: `functions/src/processPlayerShot.ts`
- Test: `functions/test/sessionLifecycle.test.ts`

- [ ] Write failing tests proving active sessions cannot reveal early and closed/revealed sessions reject shots.
- [ ] Implement an explicit close transition with server-side close state.
- [ ] Make reveal legal only after close and keep the private seed inaccessible before it.
- [ ] Ensure close/reveal is idempotent without reopening the session.
- [ ] Run targeted tests and commit.

### Task 3: Server-authoritative boss progression

**Files:**
- Modify: `functions/src/processPlayerShot.ts`
- Modify: `functions/src/startGameSession.ts`
- Test: `functions/test/authoritativeSettlement.test.ts`

- [ ] Add tests that forged client boss/progression values cannot alter payout or progression.
- [ ] Store/update boss progression only inside the settlement transaction using authoritative target state.
- [ ] Ensure public metadata cannot be used as a writable progression source.
- [ ] Run targeted tests and commit.

### Task 4: Hostile-client and rules verification

**Files:**
- Modify/Create: `functions/test/*`
- Modify: `firestore.rules`
- Modify: `docs/verification/baseline-2026-09-17.md`

- [ ] Add tests for duplicate request IDs, changed-input reuse, cross-session targets, forged payout inputs, and closed sessions.
- [ ] Add Firestore emulator rules coverage if emulator configuration supports it; otherwise add explicit static security assertions and document the limitation.
- [ ] Run typecheck, frontend tests, Functions build, and the complete CI-equivalent verification commands.
- [ ] Update verification documentation with exact results.
- [ ] Commit the verification tranche and open a PR only after all checks pass.
