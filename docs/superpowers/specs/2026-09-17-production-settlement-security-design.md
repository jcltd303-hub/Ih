# Production Settlement Security Design

**Date:** 2026-09-17
**Repository:** `jcltd303-hub/Ih`
**Target architecture:** Firebase-native

## Goal

Prepare Ih for a controlled play-money production release by removing client authority over financially relevant gameplay, protecting active fairness state, making settlement idempotent and auditable, and enforcing reproducible build/test gates.

## Scope

This design covers the first production-security tranche only:

1. reproducible frontend and Functions baseline;
2. private active fairness state;
3. server-authoritative target, entitlement, boss, and payout inputs;
4. durable shot settlement and canonical idempotency;
5. accounting/ledger foundations and reconciliation tests;
6. CI enforcement and staging-oriented Firebase deployment checks.

Live payments, redemption, withdrawals, jurisdictional compliance, and native-store release are explicitly outside this tranche.

## Architecture

Firebase remains the primary platform: Firestore stores public session metadata and durable financial records; Cloud Functions own authoritative gameplay validation and settlement; Firebase Hosting serves the web client. Active server seeds and other secrets remain in server-only storage that client Firestore rules cannot read.

The client may report collision/input telemetry, but the server derives or verifies every value that can affect a payout. A shot has a durable operation ID and progresses through an explicit lifecycle. Wallet balances are treated as projections of immutable ledger effects, with transactions preventing double-spend and idempotency preventing duplicate settlement.

## Data boundaries

### Client-readable session state

May include session ID, public fairness commitment, client seed, rules version, status, and other non-secret presentation metadata.

Must not include the active server seed or secret validation material.

### Server-only session state

Contains the active server seed, authoritative target state, encounter/boss state, accepted-shot state, and other values that must not be client-readable or client-writable.

### Wallet/ledger state

Financially relevant writes originate only from trusted backend code. Ledger entries contain an immutable operation ID, account ID, currency, signed integer amount in documented accounting units, operation type, authoritative timestamp, source, and rules version where applicable.

## Settlement flow

A financially relevant shot follows:

`requested -> accepted/reserved -> resolved -> settled`

Rejected requests never create financial effects. Accepted requests have a durable operation ID. Replaying the same operation ID with the same canonical request returns the original settlement result. Reusing an operation ID with different inputs is rejected.

Client animation is presentation only and cannot create, modify, or cancel a financial effect.

## Authority rules

The server must verify:

- session ownership and status;
- target existence and eligibility;
- authoritative target type and health;
- fire cadence and anti-replay conditions;
- stake and currency validity;
- authoritative equipment/entitlement state;
- encounter/boss identity and progression;
- payout parameters and accounting-unit arithmetic.

Client-provided `clientHitConfirmed`, `targetId`, `fishType`, `skinBonus`, or equivalent fields are treated as untrusted claims or hints and cannot directly establish payout eligibility.

## Boss accounting

Boss progress is bound to a specific encounter and currency. The implementation must explicitly define how stake contributes to progress and must prevent low-stake accumulation followed by an unrelated high-stake finishing shot from creating an unintended reward. Currency changes, target replacement, repeated kills, simultaneous sessions, and session closure during a boss encounter receive regression coverage.

## Fairness

The system may expose a commitment before play and reveal the corresponding server seed only after the session is irreversibly closed. A revealed seed cannot remain active for a subsequently accepted shot. Historical sessions with exposed active seeds are not considered safe for value-bearing play and must be retired or otherwise excluded from such play.

## CI and delivery

Pull requests must run clean installation, frontend type checking, tests, frontend build, Functions build, and Firebase rules tests. Production promotion requires all checks to pass from a pinned commit. Staging and production Firebase projects remain separate.

The deployment workflow must not treat a GitHub Pages upload of server bundles as a valid execution environment. Firebase Hosting serves the frontend while Cloud Functions execute backend settlement code.

## Testing strategy

The first tranche requires:

- Firestore emulator tests proving clients cannot read active server seeds;
- forged-hit/target/type/bonus tests;
- entitlement and loadout tampering tests;
- boss progression abuse tests;
- duplicate and conflicting idempotency tests;
- concurrent insufficient-balance tests;
- lost-response recovery tests;
- session-close/in-flight settlement tests;
- ledger reconciliation tests;
- clean frontend and Functions build/test checks.

## Release gates

The play-money release is blocked until:

1. a fresh checkout builds frontend and Functions successfully;
2. required tests and rules tests pass in CI;
3. active fairness secrets are inaccessible to clients;
4. forged client gameplay claims cannot change financial outcomes;
5. duplicate operations produce exactly one financial effect;
6. concurrent operations cannot create an invalid balance;
7. accepted operations remain recoverable after client disconnect;
8. ledger and wallet projections reconcile exactly;
9. staging deployment is isolated from production;
10. rollback and recovery procedures have been demonstrated.

## Explicit non-goals

This design does not authorize or implement real-money deposits, withdrawals, prize redemption, payment-provider production credentials, or legal/compliance approval. Those require a separate financial-release design and external review.
