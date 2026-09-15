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
import { app } from './FirebaseClient';
import { AuthManager } from './AuthManager';

export type WalletCurrency = 'GC' | 'SC';

export interface WalletBalances {
  goldCoins: number;
  sweepstakesCoins: number;
  source?: 'server' | 'local' | 'pending';
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
  source: 'local',
};

export class WalletService {
  private static instance: WalletService | null = null;

  private readonly db = getFirestore(app);
  private readonly functions: Functions = getFunctions(app);

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

  public onChange(listener: BalanceListener): () => void {
    return this.subscribe(listener);
  }

  /**
   * Static access for boss raid payouts, cloud function responses, and background settlements.
   */
  public static applyServerBalances(
    gcOrBalances: number | { goldCoins?: number; sweepstakesCoins?: number },
    sc?: number
  ): void {
    WalletService.getInstance().applyServerBalances(gcOrBalances as any, sc);
  }

  /**
   * Applies server-confirmed balances (from shot settlement, boss raid payout, or admin action).
   * Dispatches updates to all active UI listeners immediately.
   */
  public applyServerBalances(
    gcOrBalances: number | { goldCoins?: number; sweepstakesCoins?: number },
    sc?: number
  ): void {
    let gc = this.balances.goldCoins;
    let sweep = this.balances.sweepstakesCoins;

    if (typeof gcOrBalances === 'object' && gcOrBalances !== null) {
      if (typeof gcOrBalances.goldCoins === 'number' && Number.isFinite(gcOrBalances.goldCoins)) {
        gc = gcOrBalances.goldCoins;
      }
      if (typeof gcOrBalances.sweepstakesCoins === 'number' && Number.isFinite(gcOrBalances.sweepstakesCoins)) {
        sweep = gcOrBalances.sweepstakesCoins;
      }
    } else if (typeof gcOrBalances === 'number' && Number.isFinite(gcOrBalances)) {
      gc = gcOrBalances;
      if (typeof sc === 'number' && Number.isFinite(sc)) {
        sweep = sc;
      }
    }

    this.setBalances({
      goldCoins: Math.max(0, Math.floor(gc)),
      sweepstakesCoins: Math.max(0, WalletService.roundSc(sweep)),
      source: 'server',
    });
  }

  /** SC keeps 2 decimal places; GC is whole coins. */
  public static roundSc(n: number): number {
    return Math.round(Math.max(0, n) * 100) / 100;
  }

  /**
   * Optimistic local spend for a shot. Returns false if insufficient funds.
   * Amount is in the given currency (SC fractional OK; GC integer).
   */
  public trySpend(currency: WalletCurrency, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (currency === 'SC') {
      const cost = WalletService.roundSc(amount);
      if (this.balances.sweepstakesCoins + 1e-9 < cost) return false;
      this.setBalances({
        goldCoins: this.balances.goldCoins,
        sweepstakesCoins: WalletService.roundSc(this.balances.sweepstakesCoins - cost),
        source: this.balances.source ?? 'local',
      });
      return true;
    }
    const cost = Math.max(0, Math.round(amount));
    if (this.balances.goldCoins < cost) return false;
    this.setBalances({
      goldCoins: this.balances.goldCoins - cost,
      sweepstakesCoins: this.balances.sweepstakesCoins,
      source: this.balances.source ?? 'local',
    });
    return true;
  }

  /** Credit GC and/or SC (e.g. payouts). */
  public credit(rewardGc: number, rewardSc: number): WalletBalances {
    const nextGc = Math.max(0, this.balances.goldCoins + Math.max(0, Math.floor(rewardGc)));
    const nextSc = WalletService.roundSc(this.balances.sweepstakesCoins + Math.max(0, rewardSc));
    this.setBalances({
      goldCoins: nextGc,
      sweepstakesCoins: nextSc,
      source: this.balances.source ?? 'local',
    });
    return this.getBalances();
  }

  /**
   * Credits a boss raid bounty or tournament reward, atomically computing the next balance
   * and applying it across all HUD listeners.
   */
  public static creditRaidReward(rewardGc: number, rewardSc: number): WalletBalances {
    return WalletService.getInstance().creditRaidReward(rewardGc, rewardSc);
  }

  public creditRaidReward(rewardGc: number, rewardSc: number): WalletBalances {
    return this.credit(rewardGc, rewardSc);
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
          source: 'server',
        });
      },
      (error) => {
        console.warn('[WalletService] wallet subscription fallback to local storage:', error?.message || error);
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
      sweepstakesCoins: WalletService.roundSc(next.sweepstakesCoins),
      source: next.source ?? this.balances.source ?? 'local',
    };

    for (const listener of this.listeners) {
      listener(this.getBalances());
    }
  }
}
