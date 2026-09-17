import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from './FirebaseClient';
import { AuthManager } from './AuthManager';
import { WalletService } from './WalletService';
import { debugOverlay } from '../ui/DebugOverlay';
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
 * Server target IDs are opaque capabilities issued by the fairness session.
 * The local fish ID is only a client-side lookup key and never becomes a
 * payout-bearing Firestore document ID.
 */
const serverTargetIds = new Map<string, string>();

async function resolveServerTargetId(sessionId: string, localTargetId: string): Promise<string> {
  const key = `${sessionId}:${localTargetId}`;
  const cached = serverTargetIds.get(key);
  if (cached) return cached;

  const issueTarget = httpsCallable(functions, 'issueGameplayTarget');
  const response = await issueTarget({ sessionId });
  const targetId = String((response.data as Record<string, unknown>)?.targetId || '');
  if (!targetId) throw new Error('Server did not issue a gameplay target.');
  serverTargetIds.set(key, targetId);
  return targetId;
}

/**
 * Settles a shot against Cloud Functions when authenticated + configured;
 * otherwise queues offline and leaves local HUD balances alone.
 *
 * Request integrity comes from Firebase Auth plus a server-issued target ID
 * and a per-attempt idempotency key. Client collision, fish type, skin,
 * damage and kill claims are informational only; the server recomputes all
 * payout-bearing facts.
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
    let serverTargetId: string;
    try {
      serverTargetId = await resolveServerTargetId(req.sessionId, req.targetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Target issuance failed';
      console.warn('[ShotSettlement] target issuance failed', message);
      return { online: false, success: false, payoutAmount: 0, error: message };
    }

    try {
      const processShot = httpsCallable(functions, 'processPlayerShot');
      const response = await processShot({
        sessionId: req.sessionId,
        currencyType: req.currencyType,
        betAmount: req.betAmount,
        targetId: serverTargetId,
        clientHitConfirmed: req.clientHitConfirmed,
        clientKillConfirmed: req.clientKillConfirmed === true,
        fishType: req.fishType || 'small',
        skinBonus: req.skinBonus ?? 1,
        timestamp,
        requestId
      });

      const data = (response.data || {}) as Record<string, unknown>;
      debugOverlay.setLastShotPayload(data);
      const goldCoins = Number(data.goldCoins);
      const sweepstakesCoins = Number(data.sweepstakesCoins);
      const payoutAmount = Number(data.payoutAmount) || 0;

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
      const code = typeof err === 'object' && err && 'code' in err ? String((err as any).code) : '';
      if (code.includes('failed-precondition') || /insufficient/i.test(message)) {
        window.dispatchEvent(new CustomEvent('ff-open-store'));
      }
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
