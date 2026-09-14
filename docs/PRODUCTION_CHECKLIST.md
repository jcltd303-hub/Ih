# Fish Frenzy — Production checklist

## Code complete (this repo)

- [x] Server shot settlement, session commit–reveal, wallet rules (client write denied)
- [x] Rate limit (shots/min), max bet, daily SC loss cap (`functions/src/limits.ts`)
- [x] Optional App Check init (`VITE_FIREBASE_APPCHECK_SITE_KEY`)
- [x] Age gate + Terms / Privacy / Responsible play pages (`public/legal/`)
- [x] `VITE_FF_REAL_SC` blocks SC when Firebase not configured
- [x] Multiplayer documented as **cosmetic presence** (not authoritative)
- [x] Reduced-motion CSS class + `prefers-reduced-motion`
- [x] Analytics hooks, onboarding, operator Monte Carlo (demo tools)
- [x] Fairness audit UI (reveal seed)

## Ops / business (you must do)

- [ ] Create **prod + staging** Firebase projects; set `VITE_FIREBASE_*` in CI/hosting secrets
- [ ] Enable Anonymous + Google Auth; test recovery
- [ ] `firebase deploy` rules + functions; `firebase functions:secrets:set HMAC_SECRET_KEY`
- [ ] Enable **App Check** enforcement on callables in Firebase console
- [ ] Legal counsel: sweepstakes / social casino / skill path; jurisdiction; age policy
- [ ] Staging load test + pen test on wallet endpoints
- [ ] Monitoring/alerts on function errors and realized RTP vs 90%
- [ ] Store listings, real brand icons, privacy nutrition labels
- [ ] Optional Sentry (or similar) DSN

## Enable real SC mode

```bash
# .env.local
VITE_FF_REAL_SC=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_APPCHECK_SITE_KEY=...
```

Deploy functions first. Client SC then expects online settlement.

## Limits (server)

| Cap | Value |
|-----|-------|
| Max bet SC/GC | 10 |
| Shots / minute / UID | 120 |
| Daily SC net loss | 500 |
| Target RTP | 90% |
