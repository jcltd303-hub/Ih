import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './FirebaseClient';
import { GameConfig } from '../config/GameConfig';
import { AuthManager } from './AuthManager';

export type WalletBalances = {
  goldCoins: number;
  sweepstakesCoins: number;
  source: 'server' | 'local' | 'pending';
};

type Listener = (balances: WalletBalances) => void;

/**
 * Server-authoritative wallet when online; local fallback for arcade demo offline.
 * Clients never write balances — only Cloud Functions / Admin SDK may mutate wallet docs.
 */
export class WalletService {
  private static instance: WalletService | null = null;
  private balances: WalletBalances = {
    goldCoins: GameConfig.startingGc,
    sweepstakesCoins: GameConfig.startingSc,
    source: 'local'
  };
  private listeners: Listener[] = [];
  private unsubFirestore: (() => void) | null = null;

  public static getInstance(): WalletService {
    if (!this.instance) this.instance = new WalletService();
    return this.instance;
  }

  public getBalances(): WalletBalances {
    return { ...this.balances };
  }

  public onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.getBalances());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const snap = this.getBalances();
    this.listeners.forEach((l) => l(snap));
  }

  /**
   * Subscribe to Firestore wallet for the signed-in user.
   * Falls back to GameConfig starting balances offline.
   */
  public async connect(): Promise<WalletBalances> {
    const auth = await AuthManager.getInstance().ensureSignedIn();
    const uid = auth.uid;

    // Best-effort: ask backend to create wallet if missing (no-op if function undeployed)
    try {
      const ensure = httpsCallable(functions, 'ensureUserWallet');
      await ensure({});
    } catch {
      // Expected in local/demo without functions
    }

    if (this.unsubFirestore) {
      this.unsubFirestore();
      this.unsubFirestore = null;
    }

    // Skip live subscription for offline placeholder uid
    if (uid === GameConfig.localPlayerId || !auth.user) {
      this.balances = {
        goldCoins: GameConfig.startingGc,
        sweepstakesCoins: GameConfig.startingSc,
        source: 'local'
      };
      this.emit();
      return this.getBalances();
    }

    const walletRef = doc(db, 'users', uid, 'wallet', 'balances');

    try {
      const initial = await getDoc(walletRef);
      if (initial.exists()) {
        const data = initial.data();
        this.balances = {
          goldCoins: Number(data.goldCoins) || GameConfig.startingGc,
          sweepstakesCoins: Number(data.sweepstakesCoins) || GameConfig.startingSc,
          source: 'server'
        };
        this.emit();
      }
    } catch (e) {
      console.warn('[WalletService] Initial wallet read failed:', e);
    }

    this.unsubFirestore = onSnapshot(
      walletRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        this.balances = {
          goldCoins: Number(data.goldCoins) || 0,
          sweepstakesCoins: Number(data.sweepstakesCoins) || 0,
          source: 'server'
        };
        this.emit();
      },
      (err) => {
        console.warn('[WalletService] Wallet subscription error, staying on local:', err);
        this.balances = { ...this.balances, source: 'local' };
        this.emit();
      }
    );

    return this.getBalances();
  }

  /** Optimistic local adjust for offline arcade; server remains source of truth online. */
  public applyLocalDelta(gcDelta: number, scDelta: number): void {
    if (this.balances.source === 'server') {
      // Online: HUD should refresh from snapshot after Cloud Function settles
      return;
    }
    this.balances = {
      goldCoins: Math.max(0, this.balances.goldCoins + gcDelta),
      sweepstakesCoins: Math.max(0, this.balances.sweepstakesCoins + scDelta),
      source: 'local'
    };
    this.emit();
  }

  public disconnect(): void {
    if (this.unsubFirestore) {
      this.unsubFirestore();
      this.unsubFirestore = null;
    }
  }
}
