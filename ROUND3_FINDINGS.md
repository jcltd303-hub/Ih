# Round 3 — Findings & Fixes

Pulled `main` after the "Electric Rage" overhaul (PRs #9–#15, authored by
another agent using `Todo2.md`). Most of that plan is genuinely implemented
well. This round covers items 1–4 you asked for, plus one build-breaking bug
found while doing #2/#4 that had to be fixed alongside it.

## 1. Gated `confirmDepositStub` (was critical, live, exploitable)

Any signed-in user could call `requestDeposit` (creates a real pending
deposit, no payment) then `confirmDepositStub` (credits the wallet with
that package's full GC + bonus SC, checking only that the deposit belonged
to them and was pending — no payment verification at all). The Store UI
had a visible "Simulate pay (stub)" button wired straight to it.

**Fixed:** `confirmDepositStub` now requires either the `admin` custom
claim or an explicit `ALLOW_STUB_PAYMENTS=1` env var (default off) —
same pattern as `updatePackages`, but a separate flag so payment-stub
access and package-editing access aren't conflated. The Store UI now only
renders the "Simulate pay" button when `FeatureFlags.stubPayments` is on
(default off); otherwise it shows "payment pending" and would fail closed
even if someone forced the button to render, since the server now rejects
non-admins regardless of what the client shows.

**You still need to:** confirm `ALLOW_STUB_PAYMENTS` and
`ALLOW_PACKAGE_EDIT_ALL` are not set in your deployed functions
environment. I can't check your live env config from here.

## 2. Re-applied kill-dedupe + win-burst limiter to `processPlayerShot.ts`

These were built in an earlier session but didn't survive the RTP-85
rewrite that landed on `main`. Restored: `killedTargets` dedupe (a target
can only pay out a kill once per session) and a rolling 60s claimed-win
burst limiter per currency (`MAX_CLAIMED_WIN_SC_PER_MINUTE` /
`_GC_PER_MINUTE` in `limits.ts`).

## 3. Admin-claim / env-flag check

No script in the repo grants the `admin` custom claim to any account —
`docs/PHASE6_QA.md`'s own deploy notes say to set it manually via Firebase
console/CLI, which is reasonable practice, but means I can't verify from
the repo alone whether any account currently has it, or whether
`ALLOW_PACKAGE_EDIT_ALL` is set anywhere live. Please check your Cloud
Functions environment config directly.

## 4. QA pass

- **Build-breaking bug found and fixed:** `WeaponController.ts`'s
  `dispatchServerShot()` and its offline-queue sync handler referenced
  `CryptoSigner`, `nonce`, and `signature` — none of which are imported or
  declared anywhere in that file (`CryptoSigner` isn't imported at all).
  Every fired shot's initial server dispatch was throwing a
  `ReferenceError`, silently caught, and falling into the offline queue —
  whose sync handler had the identical bug, so it never successfully
  replayed either. Net effect: **shots that missed were never actually
  charged server-side** (only tracked client-side in `PayoutEngine`'s local
  ledger), while shots that hit were charged correctly via the separate
  `ShotSettlement.settle()` call in the hit-detection path.

  Fixed by removing the broken `dispatchServerShot()` entirely and its
  broken schema in the offline sync handler, and adding one
  `ShotSettlement.settle()` call for the miss case (off-screen despawn),
  matching the existing hit-case call. Result: exactly one server
  settlement per shot, hit or miss, matching the "1× bet per shot"
  behavior `PHASE6_QA.md` already expects — this wasn't a new economics
  decision, just wiring the existing intended design so it actually runs
  instead of crashing.
- `WalletService.ts` now uses a live Firestore `onSnapshot` listener as
  the source of truth (plus optimistic `applyServerBalances` pushes) —
  this looks like it already addresses the earlier "balance doesn't always
  update" report. I don't have a repro to confirm against; flag it again
  if it's still happening.
- Manual code-level walkthrough of sign-in → session start → fire → hit/miss
  → boss → store → admin looks consistent given the fixes above. I was not
  able to run the actual build/bundle from here (no network access in this
  environment) — recommend running `PHASE6_QA.md`'s manual + grep checklist
  for real before this reaches players, especially given the shot-dispatch
  bug this round found by reading, not running, the code.

## Not yet done
- Real payment webhook verification for any of the three providers
  (crypto/Stripe/Capital) — all three are still stubs, as planned; nothing
  here processes an actual charge.
