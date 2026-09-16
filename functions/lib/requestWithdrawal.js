"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestWithdrawal = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const MAX_WITHDRAWAL = 1000000;
exports.requestWithdrawal = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const amount = Number(request.data?.amount);
    const currency = String(request.data?.currency || 'SC').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'Withdrawal amount must be positive.');
    }
    if (amount > MAX_WITHDRAWAL) {
        throw new https_1.HttpsError('invalid-argument', 'Withdrawal amount is too large.');
    }
    if (currency !== 'GC' && currency !== 'SC') {
        throw new https_1.HttpsError('invalid-argument', 'Currency must be GC or SC.');
    }
    const db = (0, firestore_1.getFirestore)();
    const walletRef = db.doc(`users/${request.auth.uid}/wallet/balances`);
    const requestRef = db.collection('walletRequests').doc();
    await db.runTransaction(async (tx) => {
        const walletSnap = await tx.get(walletRef);
        if (!walletSnap.exists) {
            throw new https_1.HttpsError('failed-precondition', 'Wallet does not exist.');
        }
        const wallet = walletSnap.data() || {};
        const field = currency === 'GC' ? 'goldCoins' : 'sweepstakesCoins';
        const available = Number(wallet[field] || 0);
        if (!Number.isFinite(available) || available < amount) {
            throw new https_1.HttpsError('failed-precondition', 'Insufficient balance.');
        }
        // Reserve the funds immediately. They are not available for gameplay
        // while the withdrawal is pending.
        tx.update(walletRef, {
            [field]: available - amount,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.set(requestRef, {
            uid: request.auth.uid,
            type: 'withdrawal',
            currency,
            amount,
            reservedAmount: amount,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
//# sourceMappingURL=requestWithdrawal.js.map