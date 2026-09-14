import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from './FirebaseClient';
import { CryptoSigner } from './CryptoSigner';
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

/**
 * Settles a shot against Cloud Functions when authenticated + configured;
 * otherwise queues offline and leaves local HUD balances alone.
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
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      const signature = await CryptoSigner.generateSignature(
        auth.uid,
        req.sessionId,
        req.betAmount,
        req.targetId,
        timestamp,
        nonce
      );

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
        nonce,
        signature
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
