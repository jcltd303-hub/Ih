import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported, Analytics as FirebaseAnalytics } from 'firebase/analytics';

/**
 * Firebase web app configuration for fish-frenzy-mobile.
 * Values can be overridden via Vite env (see .env.example).
 * Set VITE_USE_EMULATORS=true to point Auth/Firestore/RTDB/Functions at local emulators.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAQNRCYDsorUxuyZYp_iolRWLWNnXhH6B4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fish-frenzy-mobile.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://fish-frenzy-mobile-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fish-frenzy-mobile',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fish-frenzy-mobile.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '5130585649',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:5130585649:web:26ac3b9b28af881b117710',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-N2PKR17E84'
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !String(firebaseConfig.apiKey).includes('Dummy')
);

export const useEmulators =
  import.meta.env.VITE_USE_EMULATORS === 'true' || import.meta.env.VITE_USE_EMULATORS === '1';

export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);
export const functions: Functions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || undefined
);

export let analytics: FirebaseAnalytics | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (e) {
          console.warn('[Firebase Analytics] Initialization skipped:', e);
        }
      }
    })
    .catch(() => {});
}

let emulatorsConnected = false;

/** Idempotent emulator wiring for local dev. */
export function connectFirebaseEmulatorsIfNeeded(): void {
  if (!useEmulators || emulatorsConnected) return;
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    emulatorsConnected = true;
    console.info('[Firebase] Connected to local emulators');
  } catch (e) {
    console.warn('[Firebase] Emulator connect failed:', e);
  }
}

if (useEmulators) {
  connectFirebaseEmulatorsIfNeeded();
}
