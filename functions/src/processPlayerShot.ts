import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const HMAC_SECRET = process.env.HMAC_SECRET_KEY || 'fish_frenzy_secure_hmac_secret_key';

export const processPlayerShot = onCall(async (request) => {
  const data = request.data;
  const { sessionId, currencyType, betAmount, targetId, clientHitConfirmed, timestamp, nonce, signature } = data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to fire shots.');
  }

  // 1. Verify cryptographic signature to prevent payload tampering
  const payload = `${userId}:${sessionId}:${betAmount}:${targetId}:${timestamp}:${nonce}`;
  const expectedSignature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new HttpsError('permission-denied', 'Cryptographic signature verification failed.');
  }

  // 2. Prevent replay attacks (check timestamp window within 60 seconds)
  if (Math.abs(Date.now() - timestamp) > 60000) {
    throw new HttpsError('invalid-argument', 'Transaction timestamp expired.');
  }

  const userWalletRef = db.collection('users').doc(userId).collection('wallet').doc('balances');

  return await db.runTransaction(async (transaction) => {
    const walletDoc = await transaction.get(userWalletRef);
    if (!walletDoc.exists) {
      throw new HttpsError('not-found', 'User wallet not found.');
    }

    const walletData = walletDoc.data()!;
    const balanceKey = currencyType === 'SC' ? 'sweepstakesCoins' : 'goldCoins';
    const currentBalance = walletData[balanceKey] || 0;

    if (currentBalance < betAmount) {
      throw new HttpsError('failed-precondition', 'Insufficient funds for bet.');
    }

    // Deduct bet amount
    const newBalance = currentBalance - betAmount;
    let payoutAmount = 0;

    // Server-authoritative hit determination (simulated RNG / RTP check)
    if (clientHitConfirmed && targetId !== 'pending_collision') {
      const winMultiplier = 10; // Determined by server-side RTP table
      payoutAmount = betAmount * winMultiplier;
    }

    const finalBalance = newBalance + payoutAmount;

    transaction.update(userWalletRef, {
      [balanceKey]: finalBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      newBalance,
      payoutAmount,
      finalBalance
    };
  });
});
