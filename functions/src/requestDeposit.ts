import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

type Currency = 'GC' | 'SC';

const MAX_DEPOSIT = 1000000;

export const requestDeposit = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const amount = Number(request.data?.amount);
  const currency = String(request.data?.currency || 'SC').toUpperCase() as Currency;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Deposit amount must be positive.');
  }

  if (amount > MAX_DEPOSIT) {
    throw new HttpsError('invalid-argument', 'Deposit amount is too large.');
  }

  if (currency !== 'GC' && currency !== 'SC') {
    throw new HttpsError('invalid-argument', 'Currency must be GC or SC.');
  }

  const db = getFirestore();
  const ref = db.collection('walletRequests').doc();

  await ref.set({
    uid: request.auth.uid,
    type: 'deposit',
    currency,
    amount,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    requestId: ref.id,
    type: 'deposit',
    currency,
    amount,
    status: 'pending',
  };
});
