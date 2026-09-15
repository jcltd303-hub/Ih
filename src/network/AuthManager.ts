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
    displayName: GameConfig.localDisplayName,
    isAnonymous: true,
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
      if (!isFirebaseConfigured) {
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
        const existing = await new Promise<User | null>((resolve) => {
          const unsub = onAuthStateChanged(auth, (u) => {
            unsub();
            resolve(u);
          });
        });

        let user = existing;
        if (!user) {
          const cred = await signInAnonymously(auth);
          user = cred.user;
        }

        if (!user.displayName) {
          await updateProfile(user, { displayName: GameConfig.localDisplayName }).catch(() => {});
        }

        this.state = {
          user,
          uid: user.uid,
          displayName: user.displayName || GameConfig.localDisplayName,
          isAnonymous: user.isAnonymous,
          ready: true,
          configured: true
        };

        await this.ensureProfile(user.uid, this.state.displayName);
        this.emit();
        return this.getState();
      } catch (err) {
        console.warn('[AuthManager] Auth unavailable, using local offline identity:', err);
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
    })();

    return this.initPromise;
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
      await this.ensureProfile(this.state.uid, this.state.displayName);
      this.emit();
      return this.getState();
    } catch (e) {
      console.error('[AuthManager] Google link failed:', e);
      throw e;
    }
  }

  /** Sign out of Google / Firebase; fall back to anonymous guest session. */
  public async signOut(): Promise<AuthState> {
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
      await firebaseSignOut(auth);
      // Re-bootstrap anonymous so gameplay still works offline-friendly
      this.initPromise = null;
      return await this.ensureSignedIn();
    } catch (e) {
      console.error('[AuthManager] signOut failed:', e);
      throw e;
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
