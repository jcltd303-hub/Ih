# Phase 6 — Electric Rage QA checklist

Run on `feat/electric-rage-todo2` before merge.

## Manual

- [ ] Age gate → theme → Play
- [ ] Onboarding tips (or skip) cover hold-to-fire + Lobby stake
- [ ] Login once/day shows streak modal
- [ ] Lobby: set SC/GC + bet; combat HUD read-only stake
- [ ] Hold-to-fire: 1× bet per successful shot
- [ ] Insufficient balance opens Store
- [ ] Store: 5 tiers; $4.99 GC only; top tier ~10% SC; crypto/Stripe/Capital tabs
- [ ] Simulate pay (stub) credits GC (+ SC if bonus)
- [ ] Tournament table unlocks RANKS; practice/public does not
- [ ] Boss raid shows **BOSS BASH** title
- [ ] Operator: no RTP slider; packages GC editable (needs admin claim or `ALLOW_PACKAGE_EDIT_ALL=1`)
- [ ] Debug toggle shows FPS overlay

## Grep (should be clean of product UI)

```bash
grep -ri 'armory\|ARMORY\|provably fair\|Monte Carlo\|RTP slider' src/ui --include='*.ts'
```

Allowed: server fairness RNG, PayoutEngine Monte Carlo internal API (not exposed in Operator UI).

## Deploy notes

```bash
firebase deploy --only functions,firestore:rules
# Staging package edits:
# firebase functions:config or env ALLOW_PACKAGE_EDIT_ALL=1
# Prod: set custom claim { "admin": true } on operator UIDs
```
