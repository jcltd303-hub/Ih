import { createHash, createHmac } from 'node:crypto';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DEFAULT_PAYOUT_TABLE, PayoutTable, validatePayoutTable } from './payoutTable';
import { deriveRoll } from './provablyFair';
import { getAuthoritativeTarget, getEntitledSkinBonus } from './authoritativeTargets';

const MAX_DAILY_SC_LOSS = 10000;
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export const processPlayerShot = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required.');

  const userId = request.auth.uid;
  const data = request.data || {};
  const currencyType = data.currencyType === 'SC' ? 'SC' : 'GC';
  const betAmount = Number(data.betAmount);
  const sessionId = String(data.sessionId || '');
  const requestId = String(data.requestId || '');
  const targetId = String(data.targetId || '');
  const clientTimestamp = Number(data.clientTimestamp || 0);

  if (!sessionId || !requestId || !targetId) throw new HttpsError('invalid-argument', 'Missing settlement identifiers.');
  if (!Number.isFinite(betAmount) || betAmount <= 0 || betAmount > 1000) throw new HttpsError('invalid-argument', 'Invalid bet amount.');
  if (!Number.isFinite(clientTimestamp) || Math.abs(Date.now() - clientTimestamp) > REQUEST_TTL_MS) throw new HttpsError('invalid-argument', 'Stale shot request.');

  const db = admin.firestore();
  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const privateRef = db.collection('serverSessionState').doc(userId).collection('sessions').doc(sessionId);
  const walletRef = db.collection('wallets').doc(userId);
  const requestRef = db.collection('users').doc(userId).collection('settlementRequests').doc(requestId);
  const targetRef = privateRef.collection('targets').doc(targetId);
  const dailyStatsRef = db.collection('users').doc(userId).collection('stats').doc('daily');
  const winRateRef = db.collection('users').doc(userId).collection('stats').doc('winRate');
  const telemetryRef = db.collection('users').doc(userId).collection('telemetry').doc(sessionId);
  const loadoutRef = db.collection('users').doc(userId).collection('loadout').doc('active');

  const fingerprint = createHash('sha256').update(JSON.stringify({ sessionId, currencyType, betAmount, targetId })).digest('hex');

  return db.runTransaction(async (transaction) => {
    const priorRequest = await transaction.get(requestRef);
    if (priorRequest.exists) {
      const prior = priorRequest.data() || {};
      if (prior.fingerprint !== fingerprint) throw new HttpsError('already-exists', 'Request ID was already used for a different shot.');
      if (prior.result && typeof prior.result === 'object') return prior.result;
      throw new HttpsError('already-exists', 'Duplicate request.');
    }

    const sessionSnap = await transaction.get(sessionRef);
    const privateSnap = await transaction.get(privateRef);
    const walletSnap = await transaction.get(walletRef);
    const dailySnap = await transaction.get(dailyStatsRef);
    const winRateSnap = await transaction.get(winRateRef);
    const telemetrySnap = await transaction.get(telemetryRef);
    const loadoutSnap = await transaction.get(loadoutRef);
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
    const roll = deriveRoll(serverSeed, clientSeed, startNonce);
    const loadout = loadoutSnap.exists ? loadoutSnap.data() : undefined;
    const skinBonus = getEntitledSkinBonus(loadout);

    const authoritative = targetSnap.exists
      ? getAuthoritativeTarget(serverSeed, targetId)
      : getAuthoritativeTarget(serverSeed, targetId);
    const targetState = targetSnap.exists ? targetSnap.data()! : { targetId, fishType: authoritative.fishType, health: authoritative.maxHealth };
    const nextHealth = Math.max(0, Number(targetState.health) - 1);
    const killed = nextHealth === 0;
    const fishType = authoritative.fishType;

    const tableEntry = payoutTable[fishType];
    const hitChance = Number(tableEntry?.hitChance ?? 0.5);
    const multiplier = Number(tableEntry?.multiplier ?? 1);
    const hit = roll < Math.min(1, Math.max(0, hitChance));
    const payout = hit ? Math.floor(betAmount * multiplier * skinBonus) : 0;
    const nextBalance = currentBalance - betAmount + payout;

    const settlement = {
      requestId,
      sessionId,
      targetId,
      currencyType,
      betAmount,
      payout,
      hit,
      killed: hit && killed,
      fishType,
      nonce: startNonce,
      serverSeedHash: String(sessionSnap.data()?.serverSeedHash || ''),
      payoutTableVersion: payoutTable.version,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(walletRef, { [balanceKey]: nextBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(privateRef, { nonce: startNonce + 1 }, { merge: true });
    transaction.set(targetRef, { targetId, fishType, health: nextHealth, maxHealth: authoritative.maxHealth, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(requestRef, { fingerprint, result: settlement, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(dailyStatsRef, { scNetLoss: currencyType === 'SC' ? existingNetLoss + Math.max(0, betAmount - payout) : existingNetLoss }, { merge: true });
    transaction.set(winRateRef, { lastResult: hit ? 'win' : 'loss', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(telemetryRef, { wagered: admin.firestore.FieldValue.increment(betAmount), payout: admin.firestore.FieldValue.increment(payout), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    return settlement;
  });
});
