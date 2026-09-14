import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

type Currency = 'GC' | 'SC';

const MAX_WITHDRAWAL = 1000000;

export const requestWithdrawal = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const amount = Number(request.data?.amount);
  const currency = String(request.data?.currency || 'SC').toUpperCase() as Currency;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Withdrawal amount must be positive.');
  }

  if (amount > MAX_WITHDRAWAL) {
    throw new HttpsError('invalid-argument', 'Withdrawal amount is too large.');
  }

  if (currency !== 'GC' && currency !== 'SC') {
    throw new HttpsError('invalid-argument', 'Currency must be GC or SC.');
  }

  const db = getFirestore();
  const walletRef = db.doc(`users/${request.auth.uid}/wallet/balances`);
  const requestRef = db.collection('walletRequests').doc();

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);

    if (!walletSnap.exists) {
      throw new HttpsError('failed-precondition', 'Wallet does not exist.');
    }

    const wallet = walletSnap.data() || {};
    const field = currency === 'GC' ? 'goldCoins' : 'sweepstakesCoins';
    const available = Number(wallet[field] || 0);

    if (!Number.isFinite(available) || available < amount) {
      throw new HttpsError('failed-precondition', 'Insufficient balance.');
    }

    // Reserve the funds immediately. They are not available for gameplay
    // while the withdrawal is pending.
    tx.update(walletRef, {
      [field]: available - amount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(requestRef, {
      uid: request.auth!.uid,
      type: 'withdrawal',
      currency,
      amount,
      reservedAmount: amount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    requestId: requestRef.id,
    type: 'withdrawal',
    currency,
    amount,
    status: 'pending',
  };
});
