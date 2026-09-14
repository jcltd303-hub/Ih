import {
  onAuthStateChanged,
  signInAnonymously,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './FirebaseClient';
import { GameConfig } from '../config/GameConfig';

export type AuthState = {
  user: User | null;
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  ready: boolean;
};

type Listener = (state: AuthState) => void;

/**
 * Anonymous Firebase Auth bootstrap + first-time user profile.
 * Wallet documents are created client-side only when missing AND rules allow;
 * production should prefer the ensureUserWallet Cloud Function (Admin SDK).
 */
export class AuthManager {
  private static instance: AuthManager | null = null;
  private state: AuthState = {
    user: null,
    uid: GameConfig.localPlayerId,
    displayName: GameConfig.localDisplayName,
    isAnonymous: true,
    ready: false
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

  /** Sign in anonymously (or reuse existing session) and ensure profile docs. */
  public async ensureSignedIn(): Promise<AuthState> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Reuse existing session if present
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
          ready: true
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
          ready: true
        };
        this.emit();
        return this.getState();
      }
    })();

    return this.initPromise;
  }

  private async ensureProfile(uid: string, displayName: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        // Profile metadata only — balances via Admin/ensureUserWallet when deployed
        await setDoc(userRef, {
          displayName,
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp()
        }).catch((e) => {
          // Rules may block create; Cloud Function path is preferred in prod
          console.warn('[AuthManager] Profile create skipped (rules/offline):', e);
        });
      }
    } catch (e) {
      console.warn('[AuthManager] ensureProfile failed:', e);
    }
  }
}
