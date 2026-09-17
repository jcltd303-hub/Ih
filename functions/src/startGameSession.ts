import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { DEFAULT_PAYOUT_TABLE, validatePayoutTable } from './payoutTable';
import { generateServerSeed, hashServerSeed, generateClientSeed } from './provablyFair';
import { createServerSessionState, serverSessionStateRef } from './sessionState';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

export const startGameSession = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clientSeed =
    typeof request.data?.clientSeed === 'string' && request.data.clientSeed.length > 0
      ? String(request.data.clientSeed).slice(0, 128)
      : generateClientSeed();

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const sessionId = `sess_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const privateRef = serverSessionStateRef(db, userId, sessionId);

  const activeTableSnap = await db.collection('config').doc('payoutActive').get();
  let payoutTable = DEFAULT_PAYOUT_TABLE;
  if (activeTableSnap.exists) {
    const activeData = activeTableSnap.data() || {};
    if (activeData.table && typeof activeData.table === 'object') {
      payoutTable = validatePayoutTable(activeData.table);
    }
  }

  const privateState = createServerSessionState(userId, sessionId, {
    serverSeed,
    clientSeed,
    nonce: 0,
    payoutTable,
    payoutTableVersion: payoutTable.version,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    closedAt: null
  });

  await db.runTransaction(async (transaction) => {
    transaction.create(privateRef, { ...privateState, targetSequence: 0, bossKills: 0 });
    transaction.create(sessionRef, {
      serverSeedHash,
      clientSeed,
      status: 'active',
      bossProgress: 0,
      bossActiveUntil: 0,
      bossCooldownUntil: 0,
      targetRtp: payoutTable.targetRtp,
      payoutTableVersion: payoutTable.version,
      payoutTable,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      closedAt: null,
      revealedAt: null
    });
  });

  return {
    sessionId,
    serverSeedHash,
    clientSeed,
    targetRtp: payoutTable.targetRtp,
    payoutTableVersion: payoutTable.version,
    message: 'Server seed committed. Close the session before reveal.'
  };
});

export const closeGameSession = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Sign in required.');

  const sessionId = request.data?.sessionId;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('sess_')) {
    throw new HttpsError('invalid-argument', 'sessionId required.');
  }

  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const privateRef = serverSessionStateRef(db, userId, sessionId);

  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    const privateSnap = await transaction.get(privateRef);
    if (!sessionSnap.exists || !privateSnap.exists) throw new HttpsError('not-found', 'Session not found.');

    const status = sessionSnap.data()?.status;
    if (status === 'active') {
      const now = admin.firestore.FieldValue.serverTimestamp();
      transaction.update(sessionRef, { status: 'closed', closedAt: now });
      transaction.update(privateRef, { closedAt: now });
      return { sessionId, status: 'closed' as const };
    }
    if (status === 'closed' || status === 'revealed') {
      return { sessionId, status: status as 'closed' | 'revealed' };
    }
    throw new HttpsError('failed-precondition', 'Session cannot be closed from its current state.');
  });
});

export const revealSessionSeed = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Sign in required.');

  const sessionId = request.data?.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'sessionId required.');
  }

  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const privateRef = serverSessionStateRef(db, userId, sessionId);

  const result = await db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    const privateSnap = await transaction.get(privateRef);
    if (!sessionSnap.exists || !privateSnap.exists) {
      throw new HttpsError('not-found', 'Session not found.');
    }

    const session = sessionSnap.data()!;
    const privateState = privateSnap.data() as {
      serverSeed: string;
      clientSeed: string;
      nonce?: number;
    };

    if (session.status === 'closed') {
      transaction.update(sessionRef, {
        status: 'revealed',
        revealedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (session.status !== 'revealed') {
      throw new HttpsError('failed-precondition', 'Session must be closed before its seed can be revealed.');
    }

    return {
      sessionId,
      serverSeed: privateState.serverSeed,
      serverSeedHash: session.serverSeedHash,
      clientSeed: privateState.clientSeed,
      nonce: Number(privateState.nonce) || 0,
      status: 'revealed' as const
    };
  });

  return result;
});
