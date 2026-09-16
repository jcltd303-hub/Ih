"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserWallet = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Server-authoritative wallet bootstrap.
 * Clients cannot write balances (Firestore rules); this function creates the doc once.
 */
exports.ensureUserWallet = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const walletRef = db.collection('users').doc(userId).collection('wallet').doc('balances');
    const userRef = db.collection('users').doc(userId);
    return db.runTransaction(async (tx) => {
        const walletSnap = await tx.get(walletRef);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            tx.set(userRef, {
                displayName: request.auth?.token?.name || 'NeonStriker',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSeen: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        else {
            tx.update(userRef, { lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        }
        if (!walletSnap.exists) {
            const seed = {
                goldCoins: 10000,
                sweepstakesCoins: 50,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            tx.set(walletRef, seed);
            return { created: true, ...seed, goldCoins: 10000, sweepstakesCoins: 50 };
        }
        const data = walletSnap.data();
        return {
            created: false,
            goldCoins: data.goldCoins ?? 0,
            sweepstakesCoins: data.sweepstakesCoins ?? 0
        };
    });
});
//# sourceMappingURL=ensureUserWallet.js.map