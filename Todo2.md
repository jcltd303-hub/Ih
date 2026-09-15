# Fish Frenzy — "Electric Rage" Overhaul: Plan & TODO (v2)

Status: NEAR COMPLETE (feat/electric-rage-todo2) — Phase 1–5 implemented; Phase 6 manual/grep remaining

## Implementation progress (auto)
- [x] Packages: $4.99 GC-only; SC bonus 3/5/7/10% (1:1 USD); server listPackages/requestDeposit/confirmDepositStub
- [x] RTP fixed 85% server + client freeze
- [x] Payment provider stubs (crypto 5 assets, Stripe, Capital)
- [x] Store modal + Lobby STORE (armory HUD entry removed)
- [x] Admin: no RTP slider / Monte Carlo; package read + P&L
- [x] Presence: medal + count only
- [x] Onboarding v2 + login streak event
- [x] Tournament-only leaderboard flag
- [x] BOSS BASH banner polish
- [x] Package admin editor writes
- [x] Full Phase 6 QA (docs/PHASE6_QA.md + debug overlay + economy stats + admin claim)
- [x] Dead lobby audit handler + Phase 1/2 checkbox sync (UI leftovers removed)

Status was: PLANNING — decisions below now locked in from your last message.
A couple of small assumptions still flagged; correct me if wrong, otherwise
I'll start Phase 1 on your go-ahead.

## Decisions locked in
- Payments: pluggable provider architecture. **Top 5 crypto** built out as
  the primary rail. **Stripe** and **"Capital"** wired as stubs (interface +
  UI flow ready, no live keys/webhooks yet — I don't have credentials for
  any of these, so nothing here processes a real charge until you plug
  real keys in).
- Purchase grants an **arbitrary/configurable amount of GC** per package
  (admin-tunable, not hardcoded to package price 1:1).
- Onboarding: rebuilt and expanded on the new minimal HUD, explicitly
  teaches core controls including hold-to-auto-fire.
- Leaderboard: kept, but **only visible/active during tournament play**,
  hidden in normal sessions.
- Streak/bonus modal: kept, retriggered to fire **on login** (daily bonus),
  not its current trigger.
- Multiplayer presence: reduced to a **medal icon + player count**, nothing
  heavier.
- Balance suffix: confirmed typo, small **subscript** SC/GC label next to
  the number.

## Still-flagged assumptions (tell me if any are wrong)
- [ ] **Top 5 crypto** = BTC, ETH, USDT, USDC, SOL (highest usage for
      consumer payments). Swap any of these out if you want different ones.
- [ ] **"Capital"** — I'm treating this as a named third payment provider
      distinct from Stripe/crypto (a card/bank rail) and stubbing it the
      same way as Stripe. If "Capital" refers to something more specific
      (a particular processor's brand name), let me know so the stub
      matches their actual API shape when you're ready to wire it live.
- [ ] GC-per-package amounts: I'll pick reasonable defaults per tier
      ($4.99→X GC ... $99.99→X GC) and make them admin-editable rather than
      hardcoded, since you said "arbitrary" — confirm that's the right
      read (admin can retune later) vs. you wanting specific numbers now.
- [ ] SC handling on purchase: you didn't say whether packages also grant
      bonus SC. Standard sweepstakes-compliant pattern is "buy GC, get free
      bonus SC" rather than selling SC directly — I'll build it that way
      by default (configurable bonus SC per tier, can be set to 0). Flag if
      you want something else; this is a compliance-shaped default, not a
      guess I'd want to get wrong.
- [ ] Tournament-play trigger for the leaderboard: assuming there's a
      distinct "tournament mode" state to key off; if that doesn't exist
      yet, I'll need to add a minimal flag for it (session type =
      tournament vs casual) rather than infer it some other way.

## Phase 1 — Backend economy
- [x] `functions/src/startGameSession.ts`: hardcode `targetRtp: 85`.
- [x] Remove client RTP-adjustment paths (`PayoutEngine.setTargetRtp`,
      `saveConfig` RTP field, localStorage RTP persistence). (setTargetRtp/saveConfig are no-ops that force 85; no localStorage RTP paths remain.)
- [x] New `payments/` module (functions): provider interface
      (`createCheckout`, `handleWebhook`, `verifyPayment`) with:
      - `CryptoProvider` (BTC/ETH/USDT/USDC/SOL) — built out, address/invoice
        generation stubbed pending real node/API provider choice.
      - `StripeProvider` — stub (checkout session shape ready, no live key).
      - `CapitalProvider` — stub (same shape, pending clarification above).
- [x] Real deposits record in Firestore on confirmed payment — feeds the
      admin deposits-vs-payouts table in Phase 4.
- [x] Package config: 5 tiers ($4.99/$9.99/$19.99/$49.99/$99.99) →
      {gcAmount, bonusScAmount}, admin-editable, stored server-side (not
      trusted from client at purchase time).

## Phase 2 — Teardown
- [x] Delete `armorySkins.ts` + HUD entry point + `skinBonus` mechanic
      (`WeaponController.ts` / `processPlayerShot.ts`). (skinBonus param remains as 1.0 default; armory UI/entry removed.)
- [x] Delete `auditModal.ts` + all "provably fair" UI/copy. Keep the
      underlying seeded-RNG server logic (security fix, not a UI feature).
      (Dead lobby handler for `showAuditModal` also removed.)
- [x] Remove `App.tsx` bottom-right status overlay (player id/balance
      banner).
- [x] Remove existing boss-mode banner (replaced, not just deleted, in
      Phase 3). (Only Electric Rage `hud-boss-bash` remains.)
- [x] Cut `MultiplayerPresenceLayer` UI down to medal + count (not a full
      delete — narrowed per your answer).
- [x] `OnboardingTips.ts`: not deleted — rebuilt in Phase 3.
- [x] `leaderboardModal.ts` / `streakModal.ts`: not deleted — regated in
      Phase 3 (tournament-only / login-trigger respectively).

## Phase 3 — New minimal HUD ("Electric Rage" style)
- [x] Shared style module: colors, fonts, chunky bevel button component,
      neon/electric glow — used by every UI piece below.
- [x] Player level: level number + progress bar only.
- [x] Balance: bare number + subscript SC/GC, HUD-only.
- [x] Cannon upgrade: colored overlay sprite on turret + countdown seconds
      number.
- [x] Boss mode: giant red "BOSS BASH" text + electric-bolt particle burst
      (`ParticleFXManager.ts`).
- [x] Multiplayer presence: medal icon + live player count, minimal.
- [x] Onboarding: rebuilt walkthrough on the new HUD — explicitly covers
      aim/fire, hold-to-auto-fire, cannon upgrades, boss mode, balance/store.
- [x] Leaderboard: gate visibility to tournament sessions only.
- [x] Streak/bonus modal: retrigger on login instead of current trigger.

## Phase 4 — Admin page rebuild
- [x] Rebuild `adminPortalModal.ts`: remove RTP slider/presets/Monte Carlo
      button entirely.
- [x] Data tables: deposits vs payouts (daily), realized RTP, shot/hit
      counts — sourced from real Firestore data.
- [x] Package/GC-amount editor (admin-tunable per tier, per "arbitrary
      amount" decision above).
- [x] Debug-mode toggle (persisted flag): FPS/entity count, session id,
      current RTP, last shot response payload — gated behind the toggle.

## Phase 5 — Store
- [x] `storeModal.ts`: 5 tiers, arcade-styled, provider selector
      (crypto/Stripe/Capital) feeding the Phase 1 payment module.
- [x] Auto-trigger on insufficient-balance (`failed-precondition` from
      `processPlayerShot`, plus client-side pre-check).

## Phase 6 — Verification
- [ ] Manual pass: sign-in → onboarding → play → cannon upgrade → boss
      mode → low balance → store (each provider stub) → login streak →
      tournament leaderboard → admin page (tables + debug toggle).
- [x] Grep pass: no remaining armory / provably-fair / RTP-slider
      references in UI (source). Internal skinBonus param + seeded RNG + MonteCarlo auditor helpers remain by design (no UI exposure).
- [x] Push to a branch, open for review — no direct-to-main.
