"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultPackages = exports.updatePackages = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const economyConfig_1 = require("./economyConfig");
/**
 * Admin-editable package tiers. For now any authenticated user can update
 * in staging; gate with custom claim admin:true before production.
 */
function assertAdmin(request) {
    const auth = request.auth;
    if (!auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = auth.uid;
    // Staging: allow if claim admin:true OR env ALLOW_PACKAGE_EDIT_ALL=1
    const isAdmin = auth.token?.admin === true;
    const allowAll = process.env.ALLOW_PACKAGE_EDIT_ALL === '1';
    if (!isAdmin && !allowAll) {
        throw new https_1.HttpsError('permission-denied', 'Admin claim required to edit packages. Set custom claim admin:true or ALLOW_PACKAGE_EDIT_ALL=1 for staging.');
    }
    return uid;
}
exports.updatePackages = (0, https_1.onCall)(async (request) => {
    const userId = assertAdmin(request);
    const tiers = request.data?.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'tiers array required.');
    }
    const cleaned = tiers.map((t) => {
        const priceUsd = Number(t.priceUsd);
        const gcAmount = Math.max(0, Math.floor(Number(t.gcAmount) || 0));
        const scBonusPct = Math.max(0, Math.min(20, Number(t.scBonusPct) || 0));
        if (!t.id || !Number.isFinite(priceUsd) || priceUsd <= 0) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid tier fields.');
        }
        // Enforce $5-ish pack GC-only if price < 6
        const pct = priceUsd < 6 ? 0 : scBonusPct;
        return {
            id: String(t.id),
            priceUsd,
            gcAmount,
            scBonusPct: pct,
            label: String(t.label || t.id),
            active: t.active !== false
        };
    });
    const db = (0, firestore_1.getFirestore)();
    await db.collection('config').doc('packages').set({
        tiers: cleaned,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: userId
    });
    return {
        ok: true,
        tiers: cleaned.map((p) => ({ ...p, bonusScAmount: (0, economyConfig_1.scBonusForPackage)(p) }))
    };
});
exports.seedDefaultPackages = (0, https_1.onCall)(async (request) => {
    const userId = assertAdmin(request);
    const db = (0, firestore_1.getFirestore)();
    await db.collection('config').doc('packages').set({
        tiers: economyConfig_1.DEFAULT_PACKAGES,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: userId
    });
    return {
        ok: true,
        tiers: economyConfig_1.DEFAULT_PACKAGES.map((p) => ({ ...p, bonusScAmount: (0, economyConfig_1.scBonusForPackage)(p) }))
    };
});
//# sourceMappingURL=updatePackages.js.map