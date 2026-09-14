import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { assertRateLimit, assertBetAmount, MAX_SHOTS_PER_MINUTE, MAX_DAILY_SC_LOSS } from './limits';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

type FishType = 'small' | 'medium' | 'boss';

/**
 * Deterministic, provably-fair roll derived from the session's committed
 * server seed + client seed + a sequential nonce — same SHA-256
 * construction as ProvablyFairAuditor.verifyOutcome() on the client, so any
 * roll used to settle a shot can be independently recomputed once the
 * server seed is revealed.
 */
function deriveRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const hashHex = crypto.createHash('sha256').update(`${serverSeed}:${clientSeed}:${nonce}`).digest('hex');
  const intVal = parseInt(hashHex.substring(0, 8), 16);
  return intVal / 0xffffffff; // [0, 1)
}

/** Sequential RNG bound to a session; each call consumes the next nonce. */
function makeSessionRng(serverSeed: string, clientSeed: string, startNonce: number) {
  let n = startNonce;
  return {
    next: () => deriveRoll(serverSeed, clientSeed, n++),
    consumed: () => n - startNonce
  };
}

function evaluateServerHit(
  betAmount: number,
  fishType: FishType,
  skinBonus: number,
  targetRtp: number,
  rng: () => number
) {
  const looseness = targetRtp / 90;
  const baseHitRate = 0.24 * looseness;
  const isLuckyHit = rng() < 0.06 * looseness;
  const hitPayout = isLuckyHit ? betAmount * 1.0 : betAmount * baseHitRate;

  const critRoll = rng();
  const isSuperCrit = critRoll < 0.04 * looseness;
  const isCrit = !isSuperCrit && critRoll < 0.16 * looseness;
  const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
  const randomJitter = 0.9 + rng() * 0.3;
  const damage = 1.0 * skinBonus * critMultiplier * randomJitter;

  const baseInstant = fishType === 'small' ? 0.22 : fishType === 'medium' ? 0.1 : 0.032;
  const isInstantKill = rng() < baseInstant * looseness;

  return { hitPayout, isLuckyHit, damage, isCrit, isSuperCrit, isInstantKill };
}

function evaluateServerKill(
  baseMultiplier: number,
  fishType: FishType,
  targetRtp: number,
  rng: () => number
) {
  const looseness = targetRtp / 90;
  const roll = rng();
  if (roll < 0.02 * looseness) {
    return { finalMultiplier: baseMultiplier * 10, bonusLabel: '10X JACKPOT', isJackpot: true };
  }
  if (roll < 0.08 * looseness) {
    return { finalMultiplier: baseMultiplier * 3, bonusLabel: 'TRIPLE BOUNTY', isJackpot: false };
  }
  if (roll < 0.2 * looseness) {
    return { finalMultiplier: baseMultiplier * 1.5, bonusLabel: 'BONUS', isJackpot: false };
  }
  const typeBoost = fishType === 'boss' ? 1.2 : 1.0;
  return {
    finalMultiplier: baseMultiplier * typeBoost,
    bonusLabel: 'STANDARD WIN',
    isJackpot: false
  };
}

function baseMultiplierFor(fishType: FishType): number {
  if (fishType === 'boss') return 25;
  if (fishType === 'medium') return 4;
  return 1.2;
}

/**
 * Server-authoritative shot settlement.
 * Deducts bet, evaluates hit/kill using rolls derived from the session's
 * committed provably-fair seed, credits payout, returns balances for HUD sync.
 *
 * Request integrity comes from Firebase Auth (request.auth.uid, verified
 * server-side against the ID token) plus a per-request idempotency key —
 * NOT a shared-secret signature, which can't be kept secret from a client
 * that has to compute it itself.
 */
export const processPlayerShot = onCall(async (request) => {
  const data = request.data || {};
  const {
    sessionId,
    currencyType,
    betAmount,
    targetId,
    clientHitConfirmed,
    fishType: rawFishType,
    skinBonus: rawSkinBonus,
    timestamp,
    requestId
  } = data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to fire shots.');
  }
  if (currencyType !== 'SC' && currencyType !== 'GC') {
    throw new HttpsError('invalid-argument', 'Invalid currency.');
  }
  assertBetAmount(betAmount, currencyType);
  await assertRateLimit(userId, 'shot', MAX_SHOTS_PER_MINUTE);

  if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('sess_')) {
    throw new HttpsError('invalid-argument', 'A committed fairness session is required.');
  }
  if (!requestId || typeof requestId !== 'string' || typeof timestamp !== 'number') {
    throw new HttpsError('invalid-argument', 'Missing request fields.');
  }
  if (Math.abs(Date.now() - timestamp) > 60000) {
    throw new HttpsError('invalid-argument', 'Request timestamp expired.');
  }

  const fishType: FishType =
    rawFishType === 'boss' || rawFishType === 'medium' || rawFishType === 'small'
      ? rawFishType
      : 'small';
  const skinBonus = typeof rawSkinBonus === 'number' && rawSkinBonus > 0 ? Math.min(rawSkinBonus, 3) : 1;

  // Idempotency key: prevents a retried/duplicated call from paying out
  // twice. It only needs to be unique per attempt — it is not a secret and
  // does not need to be signed.
  const requestRef = db
    .collection('users')
    .doc(userId)
    .collection('processedRequests')
    .doc(String(requestId));

  const userWalletRef = db.collection('users').doc(userId).collection('wallet').doc('balances');
  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const today = new Date().toISOString().slice(0, 10);
  const dailyStatsRef = db.collection('users').doc(userId).collection('dailyStats').doc(today);

  const result = await db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (requestDoc.exists) {
      throw new HttpsError('already-exists', 'Duplicate request.');
    }

    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists || sessionSnap.data()?.status !== 'active') {
      throw new HttpsError(
        'failed-precondition',
        'No active fairness session. Call startGameSession first.'
      );
    }
    const session = sessionSnap.data()!;
    const serverSeed: string = session.serverSeed;
    const clientSeed: string = session.clientSeed;
    const targetRtp: number = Number(session.targetRtp) || 90;
    const startNonce: number = Number(session.nonce) || 0;

    const walletDoc = await transaction.get(userWalletRef);
    if (!walletDoc.exists) {
      throw new HttpsError('not-found', 'User wallet not found. Call ensureUserWallet first.');
    }
    const walletData = walletDoc.data()!;
    const balanceKey = currencyType === 'SC' ? 'sweepstakesCoins' : 'goldCoins';
    const currentBalance = Number(walletData[balanceKey]) || 0;

    if (currentBalance < betAmount) {
      throw new HttpsError('failed-precondition', 'Insufficient funds for bet.');
    }

    // Enforce the daily SC loss cap BEFORE settling, so a single bet can
    // never push a player past the cap (previously checked after the fact).
    let existingNetLoss = 0;
    if (currencyType === 'SC') {
      const dailySnap = await transaction.get(dailyStatsRef);
      existingNetLoss = dailySnap.exists ? Number(dailySnap.data()!.scNetLoss) || 0 : 0;
      if (existingNetLoss >= MAX_DAILY_SC_LOSS) {
        throw new HttpsError('failed-precondition', `Daily SC loss cap (${MAX_DAILY_SC_LOSS}) reached.`);
      }
    }

    const rng = makeSessionRng(serverSeed, clientSeed, startNonce);

    let payoutAmount = 0;
    let hitResult: ReturnType<typeof evaluateServerHit> | null = null;
    let killResult: ReturnType<typeof evaluateServerKill> | null = null;
    let killed = false;

    const isCollision =
      Boolean(clientHitConfirmed) && typeof targetId === 'string' && targetId !== 'pending_collision';

    if (isCollision) {
      hitResult = evaluateServerHit(betAmount, fishType, skinBonus, targetRtp, rng.next);
      payoutAmount += hitResult.hitPayout;

      if (hitResult.isInstantKill || data.clientKillConfirmed === true) {
        killed = true;
        killResult = evaluateServerKill(baseMultiplierFor(fishType), fishType, targetRtp, rng.next);
        payoutAmount += betAmount * killResult.finalMultiplier * 0.7;
      }
    }

    const netLoss = betAmount - payoutAmount;
    if (currencyType === 'SC' && netLoss > 0 && existingNetLoss + netLoss > MAX_DAILY_SC_LOSS) {
      throw new HttpsError('failed-precondition', `Daily SC loss cap (${MAX_DAILY_SC_LOSS}) reached.`);
    }

    const finalBalance = currentBalance - betAmount + payoutAmount;

    transaction.set(requestRef, {
      ts: timestamp,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    transaction.update(sessionRef, { nonce: startNonce + rng.consumed() });
    transaction.update(userWalletRef, {
      [balanceKey]: finalBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (currencyType === 'SC' && netLoss > 0) {
      transaction.set(
        dailyStatsRef,
        {
          scNetLoss: existingNetLoss + netLoss,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    return {
      success: true,
      currencyType,
      betAmount,
      payoutAmount,
      finalBalance,
      goldCoins: balanceKey === 'goldCoins' ? finalBalance : Number(walletData.goldCoins) || 0,
      sweepstakesCoins:
        balanceKey === 'sweepstakesCoins' ? finalBalance : Number(walletData.sweepstakesCoins) || 0,
      hit: hitResult,
      kill: killResult,
      killed,
      serverAuthoritative: true,
      fairNonceStart: startNonce,
      fairNonceEnd: startNonce + rng.consumed()
    };
  });

  return result;
});
