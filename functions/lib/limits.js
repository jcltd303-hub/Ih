"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CLAIMED_WIN_GC_PER_MINUTE = exports.MAX_CLAIMED_WIN_SC_PER_MINUTE = exports.MAX_DAILY_SC_LOSS = exports.MAX_SHOTS_PER_MINUTE = exports.MAX_BET_GC = exports.MAX_BET_SC = void 0;
exports.assertRateLimit = assertRateLimit;
exports.assertDailyScLoss = assertDailyScLoss;
exports.assertBetAmount = assertBetAmount;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
/** Production economy limits (server-enforced). */
exports.MAX_BET_SC = 10;
exports.MAX_BET_GC = 10;
exports.MAX_SHOTS_PER_MINUTE = 120;
exports.MAX_DAILY_SC_LOSS = 500;
/**
 * Claimed-win burst limiter: a rolling-window backstop on total payout
 * claimed per minute, independent of the shot-count rate limit. Shot
 * count alone doesn't catch a burst of large wins landing right at a
 * rate-limit window boundary. These are tunable circuit-breaker values,
 * not a precise economic model — set generously above realistic
 * legitimate variance so normal hot streaks aren't blocked, low enough to
 * flag abuse quickly. Revisit alongside real payout telemetry.
 */
exports.MAX_CLAIMED_WIN_SC_PER_MINUTE = 300; // 30x MAX_BET_SC
exports.MAX_CLAIMED_WIN_GC_PER_MINUTE = 300; // 30x MAX_BET_GC
async function assertRateLimit(uid, action, maxPerMinute) {
    const db = admin.firestore();
    const ref = db.collection('users').doc(uid).collection('rateLimits').doc(action);
    const now = Date.now();
    const windowMs = 60_000;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : { windowStart: now, count: 0 };
        let windowStart = Number(data.windowStart) || now;
        let count = Number(data.count) || 0;
        if (now - windowStart > windowMs) {
            windowStart = now;
            count = 0;
        }
        count += 1;
        if (count > maxPerMinute) {
            throw new https_1.HttpsError('resource-exhausted', `Rate limit exceeded for ${action}.`);
        }
        tx.set(ref, { windowStart, count, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
}
async function assertDailyScLoss(uid, additionalLoss) {
    if (additionalLoss <= 0)
        return;
    const db = admin.firestore();
    const day = new Date().toISOString().slice(0, 10);
    const ref = db.collection('users').doc(uid).collection('dailyStats').doc(day);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const netLoss = (snap.exists ? Number(snap.data().scNetLoss) || 0 : 0) + additionalLoss;
        if (netLoss > exports.MAX_DAILY_SC_LOSS) {
            throw new https_1.HttpsError('failed-precondition', `Daily SC loss cap (${exports.MAX_DAILY_SC_LOSS}) reached.`);
        }
        tx.set(ref, {
            scNetLoss: netLoss,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
}
function assertBetAmount(betAmount, currencyType) {
    if (typeof betAmount !== 'number' || !Number.isFinite(betAmount) || betAmount <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid bet amount.');
    }
    const max = currencyType === 'SC' ? exports.MAX_BET_SC : exports.MAX_BET_GC;
    if (betAmount > max) {
        throw new https_1.HttpsError('invalid-argument', `Bet exceeds max ${max} ${currencyType}.`);
    }
}
//# sourceMappingURL=limits.js.map