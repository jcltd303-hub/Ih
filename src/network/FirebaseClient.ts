import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getFunctions, Functions } from 'firebase/functions';

/**
 * Firebase is configured via Vite env vars (see .env.example).
 * When keys are missing, we still init a placeholder so imports don't crash;
 * AuthManager / WalletService fall back to local offline mode.
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

export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);
export const functions: Functions = getFunctions(app);
