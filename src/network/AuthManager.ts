import {
  onAuthStateChanged,
  signInAnonymously,
  User,
  updateProfile,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './FirebaseClient';
import { GameConfig } from '../config/GameConfig';

export type AuthState = {
  user: User | null;
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  ready: boolean;
  configured: boolean;
};

type Listener = (state: AuthState) => void;

/**
 * Anonymous Firebase Auth bootstrap + optional Google link for save progress.
 */
export class AuthManager {
  private static instance: AuthManager | null = null;
  private state: AuthState = {
    user: null,
    uid: GameConfig.localPlayerId,
    displayName: (typeof localStorage !== 'undefined' && localStorage.getItem('fish_frenzy_pilot_callsign')) || GameConfig.localDisplayName,
    isAnonymous: !(typeof localStorage !== 'undefined' && localStorage.getItem('fish_frenzy_pilot_callsign')),
    ready: false,
    configured: isFirebaseConfigured
  };
  private listeners: Listener[] = [];
  private initPromise: Promise<AuthState> | null = null;

  public static getInstance(): AuthManager {
    if (!this.instance) this.instance = new AuthManager();
    return this.instance;
  }

  public getState(): AuthState {
    return { ...this.state };
  }

  public getUid(): string {
    return this.state.uid;
  }

  public onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((l) => l(snapshot));
  }

  public async ensureSignedIn(): Promise<AuthState> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const savedCallsign = typeof localStorage !== 'undefined'
        ? localStorage.getItem('fish_frenzy_pilot_callsign')
        : null;
      const initialDisplayName = savedCallsign || GameConfig.localDisplayName;

      if (!isFirebaseConfigured) {
        this.state = {
          user: null,
          uid: GameConfig.localPlayerId,
          displayName: initialDisplayName,
          isAnonymous: !savedCallsign,
          ready: true,
          configured: false
        };
        this.emit();
        return this.getState();
      }

      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
        const authPromise = new Promise<User | null>((resolve) => {
          const unsub = onAuthStateChanged(auth, (u) => {
            unsub();
            resolve(u);
          });
        });

        const existing = await Promise.race([authPromise, timeoutPromise]);

        let user = existing;
        if (!user) {
          const cred = await Promise.race([
            signInAnonymously(auth),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 2000))
          ]);
          user = cred.user;
        }

        if (!user.displayName || (savedCallsign && user.displayName !== savedCallsign)) {
          await updateProfile(user, { displayName: initialDisplayName }).catch(() => {});
        }

        this.state = {
          user,
          uid: user.uid,
          displayName: user.displayName || initialDisplayName,
          isAnonymous: !savedCallsign && user.isAnonymous,
          ready: true,
          configured: true
        };

        await this.ensureProfile(user.uid, this.state.displayName);
        this.emit();
        return this.getState();
      } catch (err) {
        console.warn('[AuthManager] Auth unavailable, using local pilot identity:', err);
        this.state = {
          user: null,
          uid: GameConfig.localPlayerId,
          displayName: initialDisplayName,
          isAnonymous: !savedCallsign,
          ready: true,
          configured: isFirebaseConfigured
        };
        this.emit();
        return this.getState();
      }
    })();

    return this.initPromise;
  }

  /** Set custom pilot callsign and persist in localStorage + Firebase profile */
  public async setPilotCallsign(name: string): Promise<AuthState> {
    const trimmed = name.trim().slice(0, 18);
    if (!trimmed) throw new Error('Callsign cannot be empty.');

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fish_frenzy_pilot_callsign', trimmed);
    }

    if (this.state.user) {
      await updateProfile(this.state.user, { displayName: trimmed }).catch(() => {});
      await this.ensureProfile(this.state.user.uid, trimmed);
    }

    this.state = {
      ...this.state,
      displayName: trimmed,
      isAnonymous: false
    };

    this.emit();
    return this.getState();
  }

  /** Link anonymous account to Google (saves progress across devices). */
  public async linkGoogle(): Promise<AuthState> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase is not configured. Add VITE_FIREBASE_* to .env.local');
    }
    await this.ensureSignedIn();
    const provider = new GoogleAuthProvider();
    try {
      if (this.state.user && this.state.isAnonymous) {
        const result = await linkWithPopup(this.state.user, provider);
        this.state = {
          user: result.user,
          uid: result.user.uid,
          displayName: result.user.displayName || this.state.displayName,
          isAnonymous: false,
          ready: true,
          configured: true
        };
      } else {
        const result = await signInWithPopup(auth, provider);
        this.state = {
          user: result.user,
          uid: result.user.uid,
          displayName: result.user.displayName || GameConfig.localDisplayName,
          isAnonymous: result.user.isAnonymous,
          ready: true,
          configured: true
        };
      }
      if (typeof localStorage !== 'undefined' && this.state.displayName) {
        localStorage.setItem('fish_frenzy_pilot_callsign', this.state.displayName);
      }
      await this.ensureProfile(this.state.uid, this.state.displayName);
      this.emit();
      return this.getState();
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
        console.warn('[AuthManager] Google Sign-In provider not configured in Firebase console:', e?.message || e);
        throw new Error('Google Sign-In is not enabled on this Firebase project. Local Pilot Callsign profile is active.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        console.warn('[AuthManager] Google popup cancelled by user.');
        throw new Error('Sign-in popup was cancelled.');
      } else if (code === 'auth/popup-blocked') {
        console.warn('[AuthManager] Google popup blocked by browser.');
        throw new Error('Sign-in popup was blocked by browser.');
      } else {
        console.warn('[AuthManager] Google sign-in failed:', e?.message || e);
        throw new Error(e?.message || 'Google sign-in failed.');
      }
    }
  }

  /** Sign out of Google / Firebase; fall back to anonymous guest session. */
  public async signOut(): Promise<AuthState> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('fish_frenzy_pilot_callsign');
    }
    if (!isFirebaseConfigured || !auth) {
      this.state = {
        user: null,
        uid: GameConfig.localPlayerId,
        displayName: GameConfig.localDisplayName,
        isAnonymous: true,
        ready: true,
        configured: false
      };
      this.emit();
      return this.getState();
    }
    try {
      await firebaseSignOut(auth).catch(() => {});
      // Re-bootstrap anonymous so gameplay still works offline-friendly
      this.initPromise = null;
      return await this.ensureSignedIn();
    } catch (e) {
      console.warn('[AuthManager] signOut fallback to local guest:', e);
      this.state = {
        user: null,
        uid: GameConfig.localPlayerId,
        displayName: GameConfig.localDisplayName,
        isAnonymous: true,
        ready: true,
        configured: isFirebaseConfigured
      };
      this.emit();
      return this.getState();
    }
  }

  private async ensureProfile(uid: string, displayName: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          displayName,
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp()
        }).catch((e) => {
          console.warn('[AuthManager] Profile create skipped (rules/offline):', e);
        });
      }
    } catch (e) {
      console.warn('[AuthManager] ensureProfile failed:', e);
    }
  }
}
