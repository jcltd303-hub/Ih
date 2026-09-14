import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';

/**
 * Firebase via Vite env (see .env.example).
 * Set VITE_USE_EMULATORS=true to point Auth/Firestore/RTDB/Functions at local emulators.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForArcadeClientTesting',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fish-frenzy-prod.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fish-frenzy-prod',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://fish-frenzy-prod-default-rtdb.firebaseio.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fish-frenzy-prod.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    !String(import.meta.env.VITE_FIREBASE_API_KEY).includes('Dummy')
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
