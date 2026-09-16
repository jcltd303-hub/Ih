import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import {
  assertRateLimit,
  assertBetAmount,
  MAX_SHOTS_PER_MINUTE,
  MAX_DAILY_SC_LOSS,
  MAX_CLAIMED_WIN_SC_PER_MINUTE,
  MAX_CLAIMED_WIN_GC_PER_MINUTE
} from './limits';
import {
  DEFAULT_PAYOUT_TABLE,
  validatePayoutTable,
  type PayoutTable
} from './payoutTable';

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

function rtpTelemetryShard(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 32;
}

function evaluateServerHit(
  betAmount: number,
  fishType: FishType,
  skinBonus: number,
  payoutTable: PayoutTable,
  rng: () => number
) {
  const { hit } = payoutTable;

  const baseHitRate = hit.baseHitRate;
  const isLuckyHit = rng() < hit.luckyHitChance;
  const hitPayout = isLuckyHit ? betAmount * 1.0 : betAmount * baseHitRate;

  const critRoll = rng();
  const isSuperCrit = critRoll < hit.superCritChance;
  const isCrit = !isSuperCrit && critRoll < hit.critChance;
  const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;

  const randomJitter = 0.9 + rng() * 0.3;
  const damage = 1.0 * skinBonus * critMultiplier * randomJitter;

  const baseInstant = hit.instantKillChance[fishType];
  const isInstantKill = rng() < baseInstant;

  return { hitPayout, isLuckyHit, damage, isCrit, isSuperCrit, isInstantKill };
}

function evaluateServerKill(
  baseMultiplier: number,
  fishType: FishType,
  payoutTable: PayoutTable,
  rng: () => number
) {
  const { kill } = payoutTable;
  const roll = rng();

  if (roll < kill.jackpotChance) {
    return {
      finalMultiplier: baseMultiplier * kill.jackpotMultiplier,
      bonusLabel: '10X JACKPOT',
      isJackpot: true
    };
  }

  if (roll < kill.tripleChance) {
    return {
      finalMultiplier: baseMultiplier * kill.tripleMultiplier,
      bonusLabel: 'TRIPLE BOUNTY',
      isJackpot: false
    };
  }

  if (roll < kill.bonusChance) {
    return {
      finalMultiplier: baseMultiplier * kill.bonusMultiplier,
      bonusLabel: 'BONUS',
      isJackpot: false
    };
  }

  const typeBoost = fishType === 'boss' ? kill.bossTypeBoost : 1.0;

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
    clientKillConfirmed,
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

  // Fish tier is server-authoritative.
  const fishType: FishType =
      rawFishType === 'boss'
        ? 'boss'
        : rawFishType === 'medium'
        ? 'medium'
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

    // Lock settlement to the payout table captured when the session started.
    // Older sessions without a snapshot retain the original 85% behavior.
    let payoutTable: PayoutTable = DEFAULT_PAYOUT_TABLE;
    if (session.payoutTable && typeof session.payoutTable === 'object') {
      try {
        payoutTable = validatePayoutTable(session.payoutTable as PayoutTable);
      } catch {
        throw new HttpsError(
          'failed-precondition',
          'Invalid payout table attached to session.'
        );
      }
    }

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

    const isCollision =
      Boolean(clientHitConfirmed) && typeof targetId === 'string' && targetId !== 'pending_collision';

    // Dedupe kill claims per session per target. This does NOT verify a hit
    // actually happened — that still relies on the client-reported
    // clientHitConfirmed flag. What this closes is a narrower gap: the
    // same targetId being submitted more than once within a session to
    // collect the kill payout repeatedly. All reads must happen before any
    // writes in this transaction, so this read happens up front regardless
    // of the eventual roll outcome.
    let killedTargetRef: FirebaseFirestore.DocumentReference | null = null;
    let targetAlreadyKilled = false;
    if (isCollision) {
      killedTargetRef = sessionRef.collection('killedTargets').doc(targetId);
      const killedSnap = await transaction.get(killedTargetRef);
      targetAlreadyKilled = killedSnap.exists;
    }

    // Claimed-win burst limiter, tracked per user+currency in a rolling
    // 60s window. This is a coarse circuit breaker against a flood of
    // large claimed wins slipping through between shot-count rate-limit
    // resets — not a precise economic model, just a tunable backstop.
    const winRateRef = db
      .collection('users')
      .doc(userId)
      .collection('rateLimits')
      .doc(`winAmount_${currencyType}`);
    const winRateSnap = await transaction.get(winRateRef);

    // Aggregate, sharded RTP telemetry. This is intentionally independent
    // of player identity for payout decisions: it only records realized
    // economic totals for later calibration/auditing.
    const telemetryHour = new Date(timestamp).toISOString().slice(0, 13).replace('T', '');
    const telemetryShard = rtpTelemetryShard(userId);
    const telemetryRef = db
      .collection('economyTelemetry')
      .doc(`${telemetryHour}_${currencyType}_${telemetryShard}`);

    const telemetrySnap = await transaction.get(telemetryRef);
    const telemetryData = telemetrySnap.exists ? telemetrySnap.data()! : {};
    const previousWager = Number(telemetryData.wagered) || 0;
    const previousPayout = Number(telemetryData.paidOut) || 0;
    const previousShots = Number(telemetryData.shots) || 0;
    const previousKills = Number(telemetryData.kills) || 0;

    const rng = makeSessionRng(serverSeed, clientSeed, startNonce);

    let payoutAmount = 0;
    let hitResult: ReturnType<typeof evaluateServerHit> | null = null;
    let killResult: ReturnType<typeof evaluateServerKill> | null = null;
    let killed = false;

    if (isCollision) {
      hitResult = evaluateServerHit(betAmount, fishType, skinBonus, payoutTable, rng.next);
      payoutAmount += hitResult.hitPayout;

      // Kill payout is server-authoritative. The client may report a visual
      // kill, but that report can never create a payout by itself.
      // For standard fish, instant-kill is the authoritative kill condition.
      // For boss, client-side HP depletion determines the kill.
      const killClaimed = fishType === 'boss' ? (clientKillConfirmed === true) : hitResult.isInstantKill;
      if (killClaimed && !targetAlreadyKilled) {
        killed = true;
        killResult = evaluateServerKill(baseMultiplierFor(fishType), fishType, payoutTable, rng.next);
        payoutAmount += betAmount * killResult.finalMultiplier * 0.7;
      }
    }

    const netLoss = betAmount - payoutAmount;
    if (currencyType === 'SC' && netLoss > 0 && existingNetLoss + netLoss > MAX_DAILY_SC_LOSS) {
      throw new HttpsError('failed-precondition', `Daily SC loss cap (${MAX_DAILY_SC_LOSS}) reached.`);
    }

    const winWindowMs = 60_000;
    const winData = winRateSnap.exists ? winRateSnap.data()! : {};
    let winWindowStart = Number(winData.windowStart) || Date.now();
    let claimedInWindow = Number(winData.claimed) || 0;
    if (Date.now() - winWindowStart > winWindowMs) {
      winWindowStart = Date.now();
      claimedInWindow = 0;
    }
    if (payoutAmount > 0) {
      claimedInWindow += payoutAmount;
      const winCap = currencyType === 'SC' ? MAX_CLAIMED_WIN_SC_PER_MINUTE : MAX_CLAIMED_WIN_GC_PER_MINUTE;
      if (claimedInWindow > winCap) {
        throw new HttpsError(
          'resource-exhausted',
          `Claimed win burst limit reached for ${currencyType}. Please slow down and try again shortly.`
        );
      }
    }

    const finalBalance = currentBalance - betAmount + payoutAmount;

    transaction.set(requestRef, {
      ts: timestamp,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    transaction.set(telemetryRef, {
      bucket: telemetryHour,
      currencyType,
      shard: telemetryShard,
      tableVersion: payoutTable.version,
      wagered: previousWager + betAmount,
      paidOut: previousPayout + payoutAmount,
      shots: previousShots + 1,
      kills: previousKills + (killed ? 1 : 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

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
    if (killed && killedTargetRef) {
      transaction.set(killedTargetRef, {
        fishType,
        killedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    if (payoutAmount > 0) {
      transaction.set(winRateRef, {
        windowStart: winWindowStart,
        claimed: claimedInWindow,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
      duplicateKillClaim: isCollision && targetAlreadyKilled,
      serverAuthoritative: true,
      fairNonceStart: startNonce,
      fairNonceEnd: startNonce + rng.consumed()
    };
  });

  return result;
});
