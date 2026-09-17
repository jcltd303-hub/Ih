# Production Settlement Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reproducible CI baseline and close the two release-blocking trust-boundary defects: player-readable active fairness seeds and client-controlled financially relevant gameplay inputs.

**Architecture:** Keep Firebase as the runtime architecture. Separate client-readable session metadata from server-only settlement state, derive all payout inputs from authoritative server records, and preserve the existing transactional/idempotent settlement flow. CI must build and test both the web app and Functions package before these changes can be promoted.

**Tech Stack:** React/Vite, TypeScript, Firebase Auth, Firestore, Cloud Functions for Firebase, Vitest, Firebase Emulator Suite, npm.

**Spec:** `docs/superpowers/specs/2026-09-17-production-settlement-security-design.md`

## Global Constraints

- Keep the first release play-money only; do not enable purchased or redeemable currency as part of these changes.
- Active server seeds must never be readable by a client before the corresponding session is irreversibly closed/revealed.
- Client collision, fish type, skin bonus, kill, and progression claims are inputs at most; they are never authoritative financial facts.
- Every accepted shot must have exactly one financial effect and a canonical retry result.
- Use the existing Firebase Auth identity (`request.auth.uid`) as the user boundary.
- Preserve session-bound deterministic fairness and payout-table versioning.
- Do not add a new backend platform or payment provider in this tranche.

---

### Task 1: Establish the clean baseline and CI gates

**Files:**
- Modify: `package.json`
- Modify: `functions/package.json`
- Modify: `.github/workflows/Deploy.yml`
- Create: `docs/verification/baseline-2026-09-17.md`

**Interfaces:**
- Produces CI commands that can be reused by every later security PR: root `npm ci`, root `npm run typecheck`, root `npm run test:ci`, root `npm run build`, Functions dependency install, and Functions build.
- Does not change settlement behavior.

- [ ] **Step 1: Inspect the workflow and scripts before editing.**
  Confirm the workflow currently performs the same root build as `package.json`, and confirm the Functions package has a `build` script using TypeScript compilation.

- [ ] **Step 2: Add a CI-only verification script for the Functions package.**
  In the root `package.json`, add:

```json
"functions:build": "npm --prefix functions ci && npm --prefix functions run build"
```

  Keep `test:ci` and `typecheck` intact.

- [ ] **Step 3: Update the deployment workflow to run verification before deployment.**
  The verification job must execute, in order:

```bash
npm ci
npm run typecheck
npm run test:ci
npm run build
npm run functions:build
```

  Deployment must not execute if any command exits non-zero.

- [ ] **Step 4: Run the baseline locally in a clean checkout.**
  Run:

```bash
npm ci
npm run typecheck
npm run test:ci
npm run build
npm run functions:build
```

  Record the exact command results and any existing failures in `docs/verification/baseline-2026-09-17.md`; do not label an unrun check as passing.

- [ ] **Step 5: Commit the baseline gate.**

```bash
git add package.json .github/workflows/Deploy.yml docs/verification/baseline-2026-09-17.md
git commit -m "ci: enforce production verification gates"
```

**Acceptance:** A fresh checkout runs the complete frontend and Functions verification sequence, and deployment is impossible when any required check fails.

---

### Task 2: Make active fairness state server-only

**Files:**
- Modify: `functions/src/startGameSession.ts`
- Modify: `functions/src/processPlayerShot.ts`
- Modify: `functions/src/revealSessionSeed.ts`
- Modify: `firestore.rules`
- Create: `functions/src/sessionState.ts`
- Create: `functions/test/sessionSecurity.test.ts`

**Interfaces:**
- `createServerSessionState(userId: string, sessionId: string, state: ServerSessionState): Promise<void>` stores private seed/nonce state outside the client-readable session document.
- `getServerSessionState(userId: string, sessionId: string): Promise<ServerSessionState>` is callable only from trusted Functions code.
- `ServerSessionState` contains at minimum `serverSeed`, `clientSeed`, `nonce`, and the session's payout-table snapshot/version.

- [ ] **Step 1: Write the emulator security test that attempts to read an active seed as the authenticated player.**
  Seed an active session whose public document contains metadata but whose server seed is stored separately. Authenticate as the owner and assert the client can read the public session metadata but cannot read the private server-state document.

- [ ] **Step 2: Run the security test and verify it fails against the current layout/rules.**
  Run:

```bash
npx vitest run functions/test/sessionSecurity.test.ts
```

  Expected failure: the current session document exposes `serverSeed`, or the private path is not yet protected.

- [ ] **Step 3: Create the server-state repository boundary.**
  Implement `functions/src/sessionState.ts` using a private collection such as `serverSessionState/{userId}/sessions/{sessionId}`. Keep all reads/writes in Functions code using Admin SDK. Do not export this path to client SDK code.

- [ ] **Step 4: Change session creation to publish only public metadata.**
  `startGameSession.ts` must write `serverSeed` only to the private state and write the commitment hash, client seed, session status, payout-table snapshot/version, and non-sensitive timestamps to the client-readable session document.

- [ ] **Step 5: Change shot settlement to read the private seed state.**
  `processPlayerShot.ts` must obtain `serverSeed`, `clientSeed`, and `nonce` from `getServerSessionState`. Remove every dependency on `session.serverSeed` from the client-readable document.

- [ ] **Step 6: Change reveal handling to close the private state before exposing the seed.**
  `revealSessionSeed.ts` must require an irreversibly closed session, read the private seed, and publish the seed only as the final revealed value. A revealed/closed state must never be accepted by `processPlayerShot`.

- [ ] **Step 7: Tighten Firestore rules.**
  Remove the session rule that permits unrestricted owner reads of every session field. Permit the client to read public session metadata only through the public session path. Explicitly deny all client reads/writes to the private server-state collection before the default deny rule.

- [ ] **Step 8: Add negative tests for overlapping rules.**
  Attempt reads of the private state as the owner, another authenticated user, and unauthenticated client. Assert all are denied. Attempt client writes and deletes and assert denial.

- [ ] **Step 9: Run the complete Functions test suite.**

```bash
npm --prefix functions run build
npm run test:ci
```

- [ ] **Step 10: Commit the seed isolation change.**

```bash
git add functions/src/startGameSession.ts functions/src/processPlayerShot.ts functions/src/revealSessionSeed.ts functions/src/sessionState.ts functions/test/sessionSecurity.test.ts firestore.rules
git commit -m "security: isolate active fairness seeds"
```

**Acceptance:** An authenticated player can read normal session metadata but cannot read the active server seed or private nonce state. Settlement obtains those values only through trusted Functions code, and seed reveal is possible only after irreversible session closure.

---

### Task 3: Make financially relevant shot inputs authoritative

**Files:**
- Modify: `functions/src/processPlayerShot.ts`
- Modify: `functions/src/startGameSession.ts`
- Create: `functions/src/authoritativeTargets.ts`
- Create: `functions/test/authoritativeSettlement.test.ts`

**Interfaces:**
- `getAuthoritativeTarget(session: FirebaseFirestore.DocumentData, targetId: string): AuthoritativeTarget | null` returns the server-owned target state or `null`.
- `getEntitledSkinBonus(userId: string, loadout: FirebaseFirestore.DocumentData): number` returns a server-validated bonus from an allowlisted entitlement/loadout mapping.
- `AuthoritativeTarget` contains at minimum `targetId`, `fishType`, `maxHealth`, `remainingHealth`, and encounter/session identity.

- [ ] **Step 1: Write tests for forged fish type and forged skin bonus.**
  Submit a client request whose target is a `small` fish while the payload claims `boss` and whose payload claims `skinBonus: 3`. Assert the settlement uses the server target type and server entitlement rather than either client value.

- [ ] **Step 2: Write tests for unknown and cross-session target IDs.**
  Submit a target ID that is absent from the active encounter and a target ID belonging to another session. Assert both produce no payout and do not advance boss state.

- [ ] **Step 3: Write a test for a forged client kill claim.**
  Set `clientKillConfirmed: true` while the authoritative server roll does not satisfy the kill condition. Assert no kill payout is issued.

- [ ] **Step 4: Run the new tests and confirm they fail against the client-derived inputs.**

```bash
npx vitest run functions/test/authoritativeSettlement.test.ts
```

- [ ] **Step 5: Introduce authoritative target records.**
  Create `authoritativeTargets.ts` with a narrow parser/validator. The settlement function must resolve the target from server-owned encounter state rather than `rawFishType`.

- [ ] **Step 6: Replace client fish type selection.**
  Remove the conditional that maps `rawFishType` into `FishType`. If the authoritative target is absent, reject the financially relevant collision or settle it as a miss according to the existing product semantics; do not invent a target tier.

- [ ] **Step 7: Replace client skin bonus selection.**
  Remove `rawSkinBonus` from payout calculation. Resolve the bonus from the server-owned loadout/entitlement state and cap it according to the configured entitlement rules.

- [ ] **Step 8: Treat client collision and kill flags as non-authoritative.**
  `clientHitConfirmed` may be retained only as a performance/UI hint. It must never select payout tier, payout amount, or kill status by itself. `clientKillConfirmed` must not be used to create or increase a reward.

- [ ] **Step 9: Bind boss progression to the authoritative target.**
  Only an authoritative boss target in the current session can change `bossProgress`. The progress update must occur inside the same transaction as the settlement.

- [ ] **Step 10: Run regression tests.**

```bash
npm --prefix functions run build
npm run test:ci
```

- [ ] **Step 11: Commit authoritative settlement inputs.**

```bash
git add functions/src/processPlayerShot.ts functions/src/startGameSession.ts functions/src/authoritativeTargets.ts functions/test/authoritativeSettlement.test.ts
git commit -m "security: make shot settlement inputs authoritative"
```

**Acceptance:** A modified client cannot choose fish tier, bonus entitlement, target identity, or kill state to increase a payout. Valid gameplay continues to settle deterministically from server-owned state and the session-bound fairness seed.

---

### Task 4: Harden settlement idempotency and financial consistency

**Files:**
- Modify: `functions/src/processPlayerShot.ts`
- Create: `functions/src/settlementResult.ts`
- Create: `functions/test/settlementIdempotency.test.ts`

**Interfaces:**
- `CanonicalSettlementResult` is the exact JSON-safe response returned for both first execution and every valid retry of the same `requestId`.
- `buildCanonicalSettlementResult(settlement): CanonicalSettlementResult` must not contain `undefined`, Firestore sentinel values, or non-serializable objects.

- [ ] **Step 1: Write a test asserting identical first and retry responses.**
  Execute the same request twice and compare the complete response object for deep equality.

- [ ] **Step 2: Write a test asserting request-ID reuse with changed inputs fails.**
  Reuse an existing `requestId` with a different bet/currency/target and assert the operation is rejected rather than returning a misleading result.

- [ ] **Step 3: Write a test for response loss after commit.**
  Simulate a committed settlement whose client response is discarded, then invoke the same `requestId`. Assert the stored canonical result is returned without another wallet mutation.

- [ ] **Step 4: Remove `createdAt: undefined` from stored retry responses.**
  Build a JSON-safe canonical response before storing it in `processedRequests`. Do not use `undefined` as a persisted Firestore field.

- [ ] **Step 5: Ensure duplicate lookup happens before non-idempotent admission checks where safe.**
  A previously committed operation must remain recoverable. Keep authentication and basic request-shape validation, but do not let a later rate-window boundary turn a successful retry into a different financial result.

- [ ] **Step 6: Keep all wallet, settlement, request, target-dedupe, boss-progress, and telemetry writes in the existing Firestore transaction.**
  Do not introduce a second non-transactional balance update.

- [ ] **Step 7: Run concurrency and retry tests.**

```bash
npx vitest run functions/test/settlementIdempotency.test.ts
npm --prefix functions run build
npm run test:ci
```

- [ ] **Step 8: Commit the idempotency hardening.**

```bash
git add functions/src/processPlayerShot.ts functions/src/settlementResult.ts functions/test/settlementIdempotency.test.ts
git commit -m "fix: canonicalize shot settlement retries"
```

**Acceptance:** Every accepted `requestId` produces one wallet effect and one canonical result. Retrying after a lost response returns that same result, while reusing the ID with different inputs is rejected.

---

### Task 5: Verify the release-blocking security properties end-to-end

**Files:**
- Create: `functions/test/securityRegression.test.ts`
- Modify: `docs/verification/baseline-2026-09-17.md`
- Modify: `AUDIT_REPORT.md`

**Interfaces:**
- Produces a machine-runnable regression suite covering the release blockers and a human-readable verification record.

- [ ] **Step 1: Add the complete hostile-client matrix.**
  Cover: active-seed read, private-state write, forged target, forged fish tier, forged skin bonus, forged kill, duplicate target kill, duplicate request, changed request under reused ID, insufficient funds, concurrent overspend, and closed-session shot.

- [ ] **Step 2: Run the matrix against the Firebase Emulator Suite.**

```bash
npm run emulators
```

  In a separate terminal run the security suite with the project configured for emulators. Record the exact command and result.

- [ ] **Step 3: Run all repository verification commands.**

```bash
npm ci
npm run typecheck
npm run test:ci
npm run build
npm run functions:build
```

- [ ] **Step 4: Inspect the final source for forbidden client-trust patterns.**
  Search for production settlement use of `rawFishType`, `rawSkinBonus`, `clientKillConfirmed`, and `session.serverSeed`. Any remaining occurrence must be outside authoritative payout logic and have an explicit test proving it cannot affect money.

- [ ] **Step 5: Update the audit report with evidence, not assumptions.**
  Mark each release blocker as verified only when the corresponding automated test and build result exists. Keep deployment/Firebase-console checks explicitly marked as requiring environment verification if they were not run.

- [ ] **Step 6: Commit the verification record.**

```bash
git add functions/test/securityRegression.test.ts docs/verification/baseline-2026-09-17.md AUDIT_REPORT.md
git commit -m "test: verify settlement security boundaries"
```

**Acceptance:** The hostile-client regression matrix passes, frontend and Functions builds pass, and the audit report contains reproducible evidence for each P0 property.

---

## Release gate after Task 5

Do not enable purchased or redeemable currency until all five tasks pass in CI and staging. The minimum demonstrated properties are:

1. Active fairness seeds are inaccessible to clients.
2. Settlement inputs that affect payout are server-authoritative.
3. Duplicate or retried requests cannot create duplicate financial effects.
4. Wallet and settlement writes are transactionally consistent.
5. Every required frontend and Functions check blocks deployment when it fails.

After this tranche, the next independent plan should cover the ledger/accounting model, hosting/environment separation, load testing, monitoring, and only then payment enablement.
