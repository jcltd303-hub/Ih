import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const HMAC_SECRET = process.env.HMAC_SECRET_KEY || 'fish_frenzy_secure_hmac_secret_key';

type FishType = 'small' | 'medium' | 'boss';

/** Server-side RTP / hit evaluation (authoritative). */
function evaluateServerHit(
  betAmount: number,
  fishType: FishType,
  skinBonus: number,
  targetRtp: number
) {
  const looseness = targetRtp / 90;
  const baseHitRate = 0.24 * looseness;
  const isLuckyHit = Math.random() < 0.06 * looseness;
  const hitPayout = isLuckyHit ? betAmount * 1.0 : betAmount * baseHitRate;

  const critRoll = Math.random();
  const isSuperCrit = critRoll < 0.04 * looseness;
  const isCrit = !isSuperCrit && critRoll < 0.16 * looseness;
  const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
  const randomJitter = 0.9 + Math.random() * 0.3;
  const damage = 1.0 * skinBonus * critMultiplier * randomJitter;

  const baseInstant = fishType === 'small' ? 0.22 : fishType === 'medium' ? 0.1 : 0.032;
  const isInstantKill = Math.random() < baseInstant * looseness;

  return { hitPayout, isLuckyHit, damage, isCrit, isSuperCrit, isInstantKill };
}

function evaluateServerKill(baseMultiplier: number, fishType: FishType, targetRtp: number) {
  const looseness = targetRtp / 90;
  const roll = Math.random();
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
 * Deducts bet, evaluates hit/kill when client reports a collision target,
 * credits payout, returns balances for HUD sync.
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
    nonce,
    signature
  } = data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to fire shots.');
  }
  if (typeof betAmount !== 'number' || betAmount <= 0 || betAmount > 1000) {
    throw new HttpsError('invalid-argument', 'Invalid bet amount.');
  }
  if (currencyType !== 'SC' && currencyType !== 'GC') {
    throw new HttpsError('invalid-argument', 'Invalid currency.');
  }
  if (!sessionId || !nonce || !signature || typeof timestamp !== 'number') {
    throw new HttpsError('invalid-argument', 'Missing signed shot fields.');
  }

  const payload = `${userId}:${sessionId}:${betAmount}:${targetId}:${timestamp}:${nonce}`;
  const expectedSignature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new HttpsError('permission-denied', 'Cryptographic signature verification failed.');
  }

  if (Math.abs(Date.now() - timestamp) > 60000) {
    throw new HttpsError('invalid-argument', 'Transaction timestamp expired.');
  }

  // Replay protection: store nonce briefly
  const nonceRef = db.collection('users').doc(userId).collection('nonces').doc(String(nonce));
  const fishType: FishType =
    rawFishType === 'boss' || rawFishType === 'medium' || rawFishType === 'small'
      ? rawFishType
      : 'small';
  const skinBonus = typeof rawSkinBonus === 'number' && rawSkinBonus > 0 ? Math.min(rawSkinBonus, 3) : 1;
  const targetRtp = 90;

  const userWalletRef = db.collection('users').doc(userId).collection('wallet').doc('balances');
  const sessionRef =
    typeof sessionId === 'string' && sessionId.startsWith('sess_')
      ? db.collection('users').doc(userId).collection('sessions').doc(sessionId)
      : null;

  return await db.runTransaction(async (transaction) => {
    let fairNonce = 0;
    if (sessionRef) {
      const sess = await transaction.get(sessionRef);
      if (sess.exists) {
        const s = sess.data()!;
        if (s.status === 'active') {
          fairNonce = Number(s.nonce) || 0;
          transaction.update(sessionRef, { nonce: fairNonce + 1 });
        }
      }
    }

    const nonceDoc = await transaction.get(nonceRef);
    if (nonceDoc.exists) {
      throw new HttpsError('already-exists', 'Replay detected.');
    }

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

    let payoutAmount = 0;
    let hitResult: ReturnType<typeof evaluateServerHit> | null = null;
    let killResult: ReturnType<typeof evaluateServerKill> | null = null;
    let killed = false;

    const isCollision =
      Boolean(clientHitConfirmed) && typeof targetId === 'string' && targetId !== 'pending_collision';

    if (isCollision) {
      hitResult = evaluateServerHit(betAmount, fishType, skinBonus, targetRtp);
      payoutAmount += hitResult.hitPayout;

      // Treat as kill if instant gamble or target was already low-HP (client reports kill)
      if (hitResult.isInstantKill || data.clientKillConfirmed === true) {
        killed = true;
        killResult = evaluateServerKill(baseMultiplierFor(fishType), fishType, targetRtp);
        payoutAmount += betAmount * killResult.finalMultiplier * 0.7;
      }
    }

    const finalBalance = currentBalance - betAmount + payoutAmount;

    transaction.set(nonceRef, { ts: timestamp, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.update(userWalletRef, {
      [balanceKey]: finalBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

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
      fairNonce
    };
  });
});
