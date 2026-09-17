import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash, createHmac } from 'node:crypto';
import { assertRateLimit, assertBetAmount, MAX_SHOTS_PER_MINUTE, MAX_DAILY_SC_LOSS, MAX_CLAIMED_WIN_SC_PER_MINUTE, MAX_CLAIMED_WIN_GC_PER_MINUTE } from './limits';
import { DEFAULT_PAYOUT_TABLE, validatePayoutTable, type PayoutTable } from './payoutTable';
import { deriveRoll } from './provablyFair';
import { serverSessionStateRef } from './sessionState';
import { getEntitledSkinBonus } from './authoritativeTargets';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
type FishType = 'small' | 'medium' | 'boss';

type TargetState = { targetId: string; fishType: FishType; maxHealth: number; remainingHealth: number; killed: boolean };

function makeSessionRng(serverSeed: string, clientSeed: string, startNonce: number) {
  let n = startNonce;
  return { next: () => deriveRoll(serverSeed, clientSeed, n++), consumed: () => n - startNonce };
}

function requestFingerprint(sessionId: string, currencyType: string, betAmount: number, targetId: string): string {
  return createHash('sha256').update(JSON.stringify({ sessionId, currencyType, betAmount, targetId })).digest('hex');
}

function targetDefaults(serverSeed: string, targetId: string): Omit<TargetState, 'remainingHealth' | 'killed'> {
  const digest = createHmac('sha256', serverSeed).update(targetId).digest();
  const roll = digest.readUInt32BE(0) / 0x100000000;
  const fishType: FishType = roll < 0.70 ? 'small' : roll < 0.98 ? 'medium' : 'boss';
  return { targetId, fishType, maxHealth: fishType === 'boss' ? 28 : fishType === 'medium' ? 6 : 2 };
}

function evaluateServerHit(betAmount: number, fishType: FishType, skinBonus: number, payoutTable: PayoutTable, rng: () => number) {
  const { hit } = payoutTable;
  const isLuckyHit = rng() < hit.luckyHitChance;
  const hitPayout = hit.baseHitRate > 0 ? (isLuckyHit ? betAmount : betAmount * hit.baseHitRate) : 0;
  const critRoll = rng();
  const isSuperCrit = critRoll < hit.superCritChance;
  const isCrit = !isSuperCrit && critRoll < hit.critChance;
  const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2 : 1;
  const damage = skinBonus * critMultiplier * (0.9 + rng() * 0.3);
  const isInstantKill = rng() < hit.instantKillChance[fishType];
  return { hitPayout, isLuckyHit, damage, isCrit, isSuperCrit, isInstantKill };
}

function evaluateServerKill(baseMultiplier: number, fishType: FishType, payoutTable: PayoutTable, rng: () => number) {
  if (fishType === 'boss') return { finalMultiplier: baseMultiplier, bonusLabel: 'BOSS BOUNTY CLAIMED', isJackpot: false };
  const roll = rng();
  if (roll < payoutTable.kill.jackpotChance) return { finalMultiplier: baseMultiplier * payoutTable.kill.jackpotMultiplier, bonusLabel: '10X JACKPOT', isJackpot: true };
  if (roll < payoutTable.kill.tripleChance) return { finalMultiplier: baseMultiplier * payoutTable.kill.tripleMultiplier, bonusLabel: 'TRIPLE BOUNTY', isJackpot: false };
  if (roll < payoutTable.kill.bonusChance) return { finalMultiplier: baseMultiplier * payoutTable.kill.bonusMultiplier, bonusLabel: 'BONUS', isJackpot: false };
  return { finalMultiplier: baseMultiplier, bonusLabel: 'STANDARD WIN', isJackpot: false };
}

function baseMultiplierFor(fishType: FishType): number {
  return fishType === 'boss' ? 15 : fishType === 'medium' ? 4 : 1.2;
}

export const processPlayerShot = onCall(async (request) => {
  const data = request.data || {};
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'User must be authenticated to fire shots.');

  const { sessionId, currencyType, betAmount, targetId, timestamp, requestId } = data;
  if (currencyType !== 'SC' && currencyType !== 'GC') throw new HttpsError('invalid-argument', 'Invalid currency.');
  assertBetAmount(betAmount, currencyType);
  await assertRateLimit(userId, 'shot', MAX_SHOTS_PER_MINUTE);
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('sess_')) throw new HttpsError('invalid-argument', 'A committed fairness session is required.');
  if (!requestId || typeof requestId !== 'string' || !targetId || typeof targetId !== 'string' || typeof timestamp !== 'number') throw new HttpsError('invalid-argument', 'Missing request fields.');
  if (Math.abs(Date.now() - timestamp) > 60000) throw new HttpsError('invalid-argument', 'Request timestamp expired.');

  const requestRef = db.collection('users').doc(userId).collection('processedRequests').doc(requestId);
  const walletRef = db.collection('users').doc(userId).collection('wallet').doc('balances');
  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const privateRef = serverSessionStateRef(db, userId, sessionId);
  const settlementRef = db.collection('users').doc(userId).collection('settlements').doc(requestId);
  const targetRef = privateRef.collection('targets').doc(targetId);
  const dailyStatsRef = db.collection('users').doc(userId).collection('dailyStats').doc(new Date().toISOString().slice(0, 10));
  const winRateRef = db.collection('users').doc(userId).collection('rateLimits').doc(`winAmount_${currencyType}`);
  const telemetryHour = new Date(timestamp).toISOString().slice(0, 13).replace('T', '');
  let shard = 0;
  for (let i = 0; i < userId.length; i++) shard = ((shard << 5) - shard + userId.charCodeAt(i)) | 0;
  const telemetryRef = db.collection('economyTelemetry').doc(`${telemetryHour}_${currencyType}_${Math.abs(shard) % 32}`);
  const entitlementRef = db.collection('serverEntitlements').doc(userId).collection('entitlements').doc('current');
  const fp = requestFingerprint(sessionId, currencyType, betAmount, targetId);

  return db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (requestDoc.exists) {
      if (requestDoc.data()?.fingerprint !== fp) throw new HttpsError('already-exists', 'requestId has already been used for different financial inputs.');
      const prior = requestDoc.data()?.result;
      if (prior && typeof prior === 'object') return prior;
      throw new HttpsError('already-exists', 'Duplicate request.');
    }

    const sessionSnap = await transaction.get(sessionRef);
    const privateSnap = await transaction.get(privateRef);
    const walletSnap = await transaction.get(walletRef);
    const dailySnap = await transaction.get(dailyStatsRef);
    const winRateSnap = await transaction.get(winRateRef);
    const telemetrySnap = await transaction.get(telemetryRef);
    const entitlementSnap = await transaction.get(entitlementRef);
    const targetSnap = await transaction.get(targetRef);

    if (!sessionSnap.exists || sessionSnap.data()?.status !== 'active') throw new HttpsError('failed-precondition', 'No active fairness session.');
    if (!privateSnap.exists) throw new HttpsError('failed-precondition', 'Private fairness state is missing.');

    const privateState = privateSnap.data()!;
    const serverSeed = String(privateState.serverSeed || '');
    const clientSeed = String(privateState.clientSeed || '');
    if (!serverSeed || !clientSeed) throw new HttpsError('failed-precondition', 'Fairness state is invalid.');

    let payoutTable: PayoutTable = DEFAULT_PAYOUT_TABLE;
    try { payoutTable = validatePayoutTable((privateState.payoutTable || DEFAULT_PAYOUT_TABLE) as PayoutTable); }
    catch { throw new HttpsError('failed-precondition', 'Invalid payout table attached to session.'); }

    if (!walletSnap.exists) throw new HttpsError('not-found', 'User wallet not found.');
    const walletData = walletSnap.data()!;
    const balanceKey = currencyType === 'SC' ? 'sweepstakesCoins' : 'goldCoins';
    const currentBalance = Number(walletData[balanceKey]) || 0;
    if (currentBalance < betAmount) throw new HttpsError('failed-precondition', 'Insufficient funds for bet.');

    const existingNetLoss = dailySnap.exists ? Number(dailySnap.data()!.scNetLoss) || 0 : 0;
    if (currencyType === 'SC' && existingNetLoss >= MAX_DAILY_SC_LOSS) throw new HttpsError('failed-precondition', `Daily SC loss cap (${MAX_DAILY_SC_LOSS}) reached.`);

    const startNonce = Number(privateState.nonce) || 0;
    const rng = makeSessionRng(serverSeed, clientSeed, startNonce);
    const skinBonus = getEntitledSkinBonus(entitlementSnap.exists ? entitlementSnap.data() : undefined);

    const defaults = targetDefaults(serverSeed, targetId);
    const target: TargetState = targetSnap.exists
      ? { targetId, fishType: targetSnap.data()?.fishType as FishType, maxHealth: Number(targetSnap.data()?.maxHealth) || defaults.maxHealth, remainingHealth: Number(targetSnap.data()?.remainingHealth) || defaults.maxHealth, killed: Boolean(targetSnap.data()?.killed) }
      : { ...defaults, remainingHealth: defaults.maxHealth, killed: false };
    if (!['small', 'medium', 'boss'].includes(target.fishType)) throw new HttpsError('failed-precondition', 'Invalid authoritative target.');

    const hit = evaluateServerHit(betAmount, target.fishType, skinBonus, payoutTable, rng.next);
    const nextHealth = Math.max(0, target.remainingHealth - hit.damage);
    const killClaimed = target.fishType === 'boss' ? nextHealth <= 0 : hit.isInstantKill || nextHealth <= 0;
    let payoutAmount = hit.hitPayout;
    let killed = false;
    let kill: ReturnType<typeof evaluateServerKill> | null = null;
    if (killClaimed && !target.killed) {
      killed = true;
      kill = evaluateServerKill(baseMultiplierFor(target.fishType), target.fishType, payoutTable, rng.next);
      payoutAmount += betAmount * kill.finalMultiplier;
    }

    const netLoss = betAmount - payoutAmount;
    if (currencyType === 'SC' && netLoss > 0 && existingNetLoss + netLoss > MAX_DAILY_SC_LOSS) throw new HttpsError('failed-precondition', `Daily SC loss cap (${MAX_DAILY_SC_LOSS}) reached.`);

    const winData = winRateSnap.exists ? winRateSnap.data()! : {};
    let winWindowStart = Number(winData.windowStart) || Date.now();
    let claimedInWindow = Number(winData.claimed) || 0;
    if (Date.now() - winWindowStart > 60000) { winWindowStart = Date.now(); claimedInWindow = 0; }
    if (payoutAmount > 0) {
      claimedInWindow += payoutAmount;
      const cap = currencyType === 'SC' ? MAX_CLAIMED_WIN_SC_PER_MINUTE : MAX_CLAIMED_WIN_GC_PER_MINUTE;
      if (claimedInWindow > cap) throw new HttpsError('resource-exhausted', `Claimed win burst limit reached for ${currencyType}.`);
    }

    const finalBalance = currentBalance - betAmount + payoutAmount;
    const fairNonceEnd = startNonce + rng.consumed();
    const result = { success: true, currencyType, betAmount, payoutAmount, finalBalance, goldCoins: balanceKey === 'goldCoins' ? finalBalance : Number(walletData.goldCoins) || 0, sweepstakesCoins: balanceKey === 'sweepstakesCoins' ? finalBalance : Number(walletData.sweepstakesCoins) || 0, hit, kill, killed, serverAuthoritative: true, fairNonceStart: startNonce, fairNonceEnd, payoutTableVersion: payoutTable.version };
    const settlement = { userId, sessionId, requestId, targetId, currencyType, fishType: target.fishType, betAmount, payoutAmount, finalBalance, killed, killPayout: killed && kill ? betAmount * kill.finalMultiplier : 0, hitPayout: hit.hitPayout, multiplier: kill?.finalMultiplier || 0, bonusLabel: kill?.bonusLabel || null, isJackpot: kill?.isJackpot || false, fairNonceStart: startNonce, fairNonceEnd, payoutTableVersion: payoutTable.version, settledAt: timestamp };

    transaction.set(walletRef, { [balanceKey]: finalBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(settlementRef, { ...settlement, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.create(requestRef, { fingerprint: fp, ts: timestamp, result, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(targetRef, { targetId, fishType: target.fishType, maxHealth: target.maxHealth, remainingHealth: nextHealth, killed: target.killed || killed, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.update(privateRef, { nonce: fairNonceEnd });
    if (currencyType === 'SC' && netLoss > 0) transaction.set(dailyStatsRef, { scNetLoss: existingNetLoss + netLoss, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (payoutAmount > 0) transaction.set(winRateRef, { windowStart: winWindowStart, claimed: claimedInWindow, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    const telemetry = telemetrySnap.exists ? telemetrySnap.data()! : {};
    transaction.set(telemetryRef, { bucket: telemetryHour, currencyType, tableVersion: payoutTable.version, wagered: (Number(telemetry.wagered) || 0) + betAmount, paidOut: (Number(telemetry.paidOut) || 0) + payoutAmount, shots: (Number(telemetry.shots) || 0) + 1, kills: (Number(telemetry.kills) || 0) + (killed ? 1 : 0), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return result;
  });
});
