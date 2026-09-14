import {
  collection,
  doc,
  onSnapshot,
  getFirestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import { firebaseApp } from '../firebase';
import { AuthManager } from './AuthManager';

export type WalletCurrency = 'GC' | 'SC';

export interface WalletBalances {
  goldCoins: number;
  sweepstakesCoins: number;
}

export interface WalletRequestResult {
  requestId: string;
  type: 'deposit' | 'withdrawal';
  currency: WalletCurrency;
  amount: number;
  status: 'pending';
}

type BalanceListener = (balances: WalletBalances) => void;

const DEFAULT_BALANCES: WalletBalances = {
  goldCoins: 10000,
  sweepstakesCoins: 50,
};

export class WalletService {
  private static instance: WalletService | null = null;

  private readonly db = getFirestore(firebaseApp);
  private readonly functions: Functions = getFunctions(firebaseApp);

  private balances: WalletBalances = { ...DEFAULT_BALANCES };
  private unsubscribeWallet: Unsubscribe | null = null;
  private listeners = new Set<BalanceListener>();

  private constructor() {}

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  public getBalances(): WalletBalances {
    return { ...this.balances };
  }

  public getBalance(currency: WalletCurrency): number {
    return currency === 'GC'
      ? this.balances.goldCoins
      : this.balances.sweepstakesCoins;
  }

  public subscribe(listener: BalanceListener): () => void {
    this.listeners.add(listener);
    listener(this.getBalances());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async connect(): Promise<WalletBalances> {
    this.disconnect();

    const uid = AuthManager.getInstance().getUid();

    if (!uid) {
      this.setBalances(DEFAULT_BALANCES);
      return this.getBalances();
    }

    const walletRef = doc(
      collection(this.db, 'users', uid, 'wallet'),
      'balances'
    );

    this.unsubscribeWallet = onSnapshot(
      walletRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();

        this.setBalances({
          goldCoins: Number(data.goldCoins ?? 0),
          sweepstakesCoins: Number(data.sweepstakesCoins ?? 0),
        });
      },
      (error) => {
        console.error('[WalletService] wallet subscription failed', error);
      }
    );

    return this.getBalances();
  }

  public disconnect(): void {
    if (this.unsubscribeWallet) {
      this.unsubscribeWallet();
      this.unsubscribeWallet = null;
    }
  }

  /**
   * Creates a pending deposit request.
   *
   * This intentionally does NOT credit the local wallet. A payment processor
   * or operator workflow must confirm the request before the wallet changes.
   */
  public async requestDeposit(
    amount: number,
    currency: WalletCurrency = 'SC'
  ): Promise<WalletRequestResult> {
    this.assertValidAmount(amount);

    const callable = httpsCallable<
      { amount: number; currency: WalletCurrency },
      WalletRequestResult
    >(this.functions, 'requestDeposit');

    const result = await callable({
      amount,
      currency,
    });

    return result.data;
  }

  /**
   * Creates a pending withdrawal request.
   *
   * The backend atomically reserves/debits the balance before returning.
   * The live Firestore listener will update the lobby/HUD.
   */
  public async requestWithdrawal(
    amount: number,
    currency: WalletCurrency = 'SC'
  ): Promise<WalletRequestResult> {
    this.assertValidAmount(amount);

    if (amount > this.getBalance(currency)) {
      throw new Error(`Insufficient ${currency} balance.`);
    }

    const callable = httpsCallable<
      { amount: number; currency: WalletCurrency },
      WalletRequestResult
    >(this.functions, 'requestWithdrawal');

    const result = await callable({
      amount,
      currency,
    });

    return result.data;
  }

  private assertValidAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Enter a valid amount.');
    }
  }

  private setBalances(next: WalletBalances): void {
    this.balances = {
      goldCoins: Math.max(0, Math.floor(next.goldCoins)),
      sweepstakesCoins: Math.max(0, Math.floor(next.sweepstakesCoins)),
    };

    for (const listener of this.listeners) {
      listener(this.getBalances());
    }
  }
}
