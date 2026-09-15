import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { DEFAULT_PAYOUT_TABLE, validatePayoutTable } from './payoutTable';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Commit–reveal: server generates seed, stores it, returns only SHA-256 hash.
 * Seed is revealed later via revealSessionSeed.
 */
export const startGameSession = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const clientSeed =
    typeof request.data?.clientSeed === 'string' && request.data.clientSeed.length > 0
      ? String(request.data.clientSeed).slice(0, 128)
      : crypto.randomBytes(16).toString('hex');

  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  const sessionId = `sess_${userId.slice(0, 8)}_${Date.now()}`;

  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);

  const activeTableSnap = await db.collection('config').doc('payoutActive').get();

  let payoutTable = DEFAULT_PAYOUT_TABLE;

  if (activeTableSnap.exists) {
    const activeData = activeTableSnap.data() || {};
    if (activeData.table && typeof activeData.table === 'object') {
      payoutTable = validatePayoutTable(activeData.table);
    }
  }

  await sessionRef.set({
    serverSeed, // server-only until reveal
    serverSeedHash,
    clientSeed,
    nonce: 0,
    status: 'active',
    targetRtp: payoutTable.targetRtp,
    payoutTableVersion: payoutTable.version,
    payoutTable,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    revealedAt: null
  });

  return {
    sessionId,
    serverSeedHash,
    clientSeed,
    targetRtp: payoutTable.targetRtp,
    payoutTableVersion: payoutTable.version,
    message: 'Server seed committed. Verify hash after reveal.'
  };
});

export const revealSessionSeed = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const sessionId = request.data?.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'sessionId required.');
  }

  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Session not found.');
  }
  const data = snap.data()!;
  await sessionRef.update({
    status: 'revealed',
    revealedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    sessionId,
    serverSeed: data.serverSeed,
    serverSeedHash: data.serverSeedHash,
    clientSeed: data.clientSeed,
    nonce: data.nonce || 0,
    status: 'revealed'
  };
});
