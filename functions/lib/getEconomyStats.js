"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEconomyStats = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * Aggregate deposits vs payouts for operator admin UI.
 * Scans recent deposit docs + optional ledger collection.
 */
exports.getEconomyStats = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    }
    const db = (0, firestore_1.getFirestore)();
    const depositsSnap = await db
        .collection('deposits')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()
        .catch(() => null);
    let totalDepositUsd = 0;
    let totalGcGranted = 0;
    let totalScBonus = 0;
    let completed = 0;
    let pending = 0;
    const byDay = {};
    if (depositsSnap) {
        depositsSnap.forEach((doc) => {
            const d = doc.data();
            const status = d.status || 'pending';
            if (status === 'completed') {
                completed += 1;
                totalDepositUsd += Number(d.priceUsd) || 0;
                totalGcGranted += Number(d.gcAmount) || 0;
                totalScBonus += Number(d.bonusScAmount) || 0;
            }
            else if (status === 'pending') {
                pending += 1;
            }
            const ts = d.createdAt?.toDate?.() || d.completedAt?.toDate?.();
            const day = ts ? ts.toISOString().slice(0, 10) : 'unknown';
            if (!byDay[day])
                byDay[day] = { depositsUsd: 0, gc: 0, sc: 0, count: 0 };
            if (status === 'completed') {
                byDay[day].depositsUsd += Number(d.priceUsd) || 0;
                byDay[day].gc += Number(d.gcAmount) || 0;
                byDay[day].sc += Number(d.bonusScAmount) || 0;
                byDay[day].count += 1;
            }
        });
    }
    return {
        totalDepositUsd,
        totalGcGranted,
        totalScBonus,
        completed,
        pending,
        daily: Object.entries(byDay)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .slice(0, 14)
            .map(([day, v]) => ({ day, ...v })),
        note: 'Payout handle is tracked client-side in PayoutEngine session stats until server ledger is expanded.'
    };
});
//# sourceMappingURL=getEconomyStats.js.map