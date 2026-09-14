# Firebase setup (Fish Frenzy)

## 1. Project

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Anonymous** (and **Google** if desired)
3. Create **Firestore** + **Realtime Database**
4. Register a **Web app** and copy config into `.env.local` (from `.env.example`)
5. Update `.firebaserc` `"default"` project id

## 2. Deploy rules + functions

```bash
npm run firebase:deploy:rules
npm run firebase:deploy:functions
# or all:
npm run firebase:deploy
```

Set the HMAC secret used by `processPlayerShot`:

```bash
firebase functions:secrets:set HMAC_SECRET_KEY
# or legacy env in functions config
```

## 3. Local emulators

```bash
# terminal A
npm run firebase:emulators

# terminal B — .env.local
VITE_USE_EMULATORS=true
VITE_FIREBASE_PROJECT_ID=demo-fish-frenzy
npm run dev
```

`FirebaseClient` will call `connect*Emulator` for Auth (9099), Firestore (8080), RTDB (9000), Functions (5001).

## 4. Offline arcade

Without `VITE_FIREBASE_API_KEY` (or with Dummy key), the client stays in **local** wallet/auth mode.
