"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revealSessionSeed = exports.startGameSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const payoutTable_1 = require("./payoutTable");
const provablyFair_1 = require("./provablyFair");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Commit–reveal: server generates seed, stores it, returns only SHA-256 hash.
 * Seed is revealed later via revealSessionSeed.
 */
exports.startGameSession = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    }
    const clientSeed = typeof request.data?.clientSeed === 'string' && request.data.clientSeed.length > 0
        ? String(request.data.clientSeed).slice(0, 128)
        : (0, provablyFair_1.generateClientSeed)();
    const serverSeed = (0, provablyFair_1.generateServerSeed)();
    const serverSeedHash = (0, provablyFair_1.hashServerSeed)(serverSeed);
    const sessionId = `sess_${userId.slice(0, 8)}_${Date.now()}`;
    const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
    const activeTableSnap = await db.collection('config').doc('payoutActive').get();
    let payoutTable = payoutTable_1.DEFAULT_PAYOUT_TABLE;
    if (activeTableSnap.exists) {
        const activeData = activeTableSnap.data() || {};
        if (activeData.table && typeof activeData.table === 'object') {
            payoutTable = (0, payoutTable_1.validatePayoutTable)(activeData.table);
        }
    }
    await sessionRef.set({
        serverSeed, // server-only until reveal
        serverSeedHash,
        clientSeed,
        nonce: 0,
        status: 'active',
        // Server-authoritative boss progression. The client may render its
        // own boss event, but cannot grant itself boss economics.
        bossProgress: 0,
        bossActiveUntil: 0,
        bossCooldownUntil: 0,
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
exports.revealSessionSeed = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    }
    const sessionId = request.data?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'sessionId required.');
    }
    const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Session not found.');
    }
    const data = snap.data();
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
//# sourceMappingURL=startGameSession.js.map