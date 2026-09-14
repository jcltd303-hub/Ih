# Firebase setup (Fish Frenzy)

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Sign-in method → Anonymous** (and Google if desired)
3. Create **Firestore** and **Realtime Database** (test → production rules below)
4. Register a **Web app** and copy config into `.env.local` (see `.env.example`)
5. Deploy rules and functions:

```bash
firebase deploy --only firestore:rules,database,functions
```

6. Set function secret:

```bash
firebase functions:secrets:set HMAC_SECRET_KEY
```

7. Enable **Anonymous** auth so `AuthManager.ensureSignedIn()` works.

Without env vars the client runs in **offline arcade** mode (local balances).
