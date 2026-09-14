import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from './FirebaseClient';
import { AuthManager } from './AuthManager';
import { WalletService } from './WalletService';
import { OfflineTransactionQueue } from './OfflineTransactionQueue';

export type SettlementRequest = {
  sessionId: string;
  currencyType: 'GC' | 'SC';
  betAmount: number;
  targetId: string;
  clientHitConfirmed: boolean;
  clientKillConfirmed?: boolean;
  fishType?: 'small' | 'medium' | 'boss';
  skinBonus?: number;
};

export type SettlementResult = {
  online: boolean;
  success: boolean;
  payoutAmount: number;
  finalBalance?: number;
  goldCoins?: number;
  sweepstakesCoins?: number;
  serverAuthoritative?: boolean;
  error?: string;
};

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Settles a shot against Cloud Functions when authenticated + configured;
 * otherwise queues offline and leaves local HUD balances alone.
 *
 * Request integrity comes from Firebase Auth (the server independently
 * verifies request.auth.uid from the ID token) plus `requestId`, a
 * per-attempt idempotency key that only needs to be unique — not secret,
 * and not signed. A client-computed HMAC signature was removed here: any
 * secret the client can compute with is a secret the client bundle leaks,
 * so it added no real integrity guarantee.
 */
export class ShotSettlement {
  public static async settle(req: SettlementRequest): Promise<SettlementResult> {
    const auth = AuthManager.getInstance().getState();
    const offline = !isFirebaseConfigured || !auth.user || auth.uid.startsWith('player_');

    if (offline) {
      try {
        await OfflineTransactionQueue.getInstance().enqueueShot({
          userId: auth.uid,
          sessionId: req.sessionId,
          currencyType: req.currencyType,
          betAmount: req.betAmount,
          targetId: req.targetId,
          clientHitConfirmed: req.clientHitConfirmed
        });
      } catch {
        /* ignore */
      }
      return { online: false, success: true, payoutAmount: 0 };
    }

    const timestamp = Date.now();
    const requestId = makeRequestId();
    try {
      const processShot = httpsCallable(functions, 'processPlayerShot');
      const response = await processShot({
        sessionId: req.sessionId,
        currencyType: req.currencyType,
        betAmount: req.betAmount,
        targetId: req.targetId,
        clientHitConfirmed: req.clientHitConfirmed,
        clientKillConfirmed: req.clientKillConfirmed === true,
        fishType: req.fishType || 'small',
        skinBonus: req.skinBonus ?? 1,
        timestamp,
        requestId
      });

      const data = (response.data || {}) as Record<string, unknown>;
      const goldCoins = Number(data.goldCoins);
      const sweepstakesCoins = Number(data.sweepstakesCoins);
      const payoutAmount = Number(data.payoutAmount) || 0;

      // Push balances into wallet listeners / HUD
      if (Number.isFinite(goldCoins) && Number.isFinite(sweepstakesCoins)) {
        WalletService.getInstance().applyServerBalances(goldCoins, sweepstakesCoins);
      }

      return {
        online: true,
        success: Boolean(data.success),
        payoutAmount,
        finalBalance: Number(data.finalBalance),
        goldCoins,
        sweepstakesCoins,
        serverAuthoritative: Boolean(data.serverAuthoritative)
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Settlement failed';
      console.warn('[ShotSettlement]', message);
      try {
        await OfflineTransactionQueue.getInstance().enqueueShot({
          userId: auth.uid,
          sessionId: req.sessionId,
          currencyType: req.currencyType,
          betAmount: req.betAmount,
          targetId: req.targetId,
          clientHitConfirmed: req.clientHitConfirmed
        });
      } catch {
        /* ignore */
      }
      return { online: false, success: false, payoutAmount: 0, error: message };
    }
  }
}
