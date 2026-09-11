import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForArcadeClientTesting",
  authDomain: "fish-frenzy-prod.firebaseapp.com",
  projectId: "fish-frenzy-prod",
  databaseURL: "https://fish-frenzy-prod-default-rtdb.firebaseio.com",
  storageBucket: "fish-frenzy-prod.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const functions = getFunctions(app);
