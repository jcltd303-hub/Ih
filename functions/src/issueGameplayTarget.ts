import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertRateLimit } from './limits';
import { getAuthoritativeTarget } from './authoritativeTargets';
import { serverSessionStateRef } from './sessionState';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const MAX_TARGETS_PER_SESSION = 1000;

export const issueGameplayTarget = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Sign in required.');

  const sessionId = request.data?.sessionId;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('sess_')) {
    throw new HttpsError('invalid-argument', 'A committed fairness session is required.');
  }

  await assertRateLimit(userId, 'target', 120);

  const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
  const privateRef = serverSessionStateRef(db, userId, sessionId);

  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    const privateSnap = await transaction.get(privateRef);
    if (!sessionSnap.exists || !privateSnap.exists) {
      throw new HttpsError('not-found', 'Session not found.');
    }
    if (sessionSnap.data()?.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Session is not active.');
    }

    const privateState = privateSnap.data() || {};
    const serverSeed = String(privateState.serverSeed || '');
    if (!serverSeed) throw new HttpsError('failed-precondition', 'Private fairness state is invalid.');

    const nextSequence = Number(privateState.targetSequence) || 0;
    if (nextSequence >= MAX_TARGETS_PER_SESSION) {
      throw new HttpsError('resource-exhausted', 'Session target limit reached.');
    }

    const targetId = `target_${nextSequence.toString(36)}_${admin.firestore.Timestamp.now().nanoseconds.toString(36)}`;
    const target = getAuthoritativeTarget(serverSeed, targetId);
    const targetRef = privateRef.collection('targets').doc(targetId);

    transaction.create(targetRef, {
      targetId,
      fishType: target.fishType,
      maxHealth: target.maxHealth,
      remainingHealth: target.maxHealth,
      killed: false,
      issuedSequence: nextSequence,
      issuedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    transaction.update(privateRef, {
      targetSequence: nextSequence + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { targetId };
  });
});
