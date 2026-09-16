"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmDepositStub = exports.listPackages = exports.requestDeposit = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const economyConfig_1 = require("./economyConfig");
const CryptoProvider_1 = require("./payments/CryptoProvider");
const StripeProvider_1 = require("./payments/StripeProvider");
const CapitalProvider_1 = require("./payments/CapitalProvider");
async function resolvePackage(db, packageId) {
    const snap = await db.collection('config').doc('packages').get();
    if (snap.exists) {
        const list = (snap.data()?.tiers || []);
        const found = list.find((p) => p.id === packageId && p.active !== false);
        if (found)
            return found;
    }
    const def = (0, economyConfig_1.getDefaultPackage)(packageId);
    if (!def)
        throw new https_1.HttpsError('not-found', `Unknown package: ${packageId}`);
    return def;
}
function providerFor(name, cryptoAsset) {
    const n = (name || 'crypto').toLowerCase();
    if (n === 'stripe')
        return new StripeProvider_1.StripeProvider();
    if (n === 'capital')
        return new CapitalProvider_1.CapitalProvider();
    return (0, CryptoProvider_1.createCryptoProvider)(cryptoAsset || 'USDT');
}
/**
 * Blocks confirmDepositStub for everyone except admins, unless the
 * operator has explicitly opted into stub payments for internal QA.
 *
 * SECURITY: confirmDepositStub credits a wallet with zero real payment
 * verification — it exists only so the purchase flow can be tested before
 * real provider webhooks are wired up. ALLOW_STUB_PAYMENTS must NEVER be
 * set to '1' in an environment reachable by real users; doing so lets any
 * signed-in account mint unlimited free GC/SC by calling requestDeposit
 * followed by confirmDepositStub.
 */
function assertStubPaymentsAllowed(request) {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    }
    const isAdmin = request.auth.token?.admin === true;
    const allowStub = process.env.ALLOW_STUB_PAYMENTS === '1';
    if (!isAdmin && !allowStub) {
        throw new https_1.HttpsError('permission-denied', 'Stub payment confirmation is disabled. Real payment verification is not wired up yet — ' +
            'this only works for admin accounts or when ALLOW_STUB_PAYMENTS=1 is explicitly set for ' +
            'internal QA. Never set that in an environment real users can reach.');
    }
}
/**
 * Start a package purchase. Client sends packageId + provider only — amounts from server config.
 */
exports.requestDeposit = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const uid = request.auth.uid;
    const packageId = String(request.data?.packageId || '');
    const providerName = String(request.data?.provider || 'crypto');
    const cryptoAsset = request.data?.cryptoAsset
        ? String(request.data.cryptoAsset)
        : 'USDT';
    if (!packageId) {
        throw new https_1.HttpsError('invalid-argument', 'packageId required.');
    }
    const db = (0, firestore_1.getFirestore)();
    const pkg = await resolvePackage(db, packageId);
    const bonusSc = (0, economyConfig_1.scBonusForPackage)(pkg);
    const provider = providerFor(providerName, cryptoAsset);
    const { checkoutUrl, transactionId } = await provider.createCheckout(uid, packageId);
    const ref = db.collection('deposits').doc();
    await ref.set({
        uid,
        packageId: pkg.id,
        provider: providerName.toLowerCase(),
        cryptoAsset: providerName.toLowerCase() === 'crypto' ? cryptoAsset.toUpperCase() : null,
        priceUsd: pkg.priceUsd,
        gcAmount: pkg.gcAmount,
        bonusScAmount: bonusSc,
        transactionId,
        checkoutUrl,
        status: 'pending',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp()
    });
    return {
        depositId: ref.id,
        transactionId,
        checkoutUrl,
        packageId: pkg.id,
        priceUsd: pkg.priceUsd,
        gcAmount: pkg.gcAmount,
        bonusScAmount: bonusSc,
        status: 'pending',
        stub: true
    };
});
/** List active packages (defaults + Firestore overrides). */
exports.listPackages = (0, https_1.onCall)(async () => {
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.collection('config').doc('packages').get();
    if (snap.exists && Array.isArray(snap.data()?.tiers) && snap.data().tiers.length) {
        return { tiers: snap.data().tiers.filter((t) => t.active !== false) };
    }
    return {
        tiers: economyConfig_1.DEFAULT_PACKAGES.filter((p) => p.active).map((p) => ({
            ...p,
            bonusScAmount: (0, economyConfig_1.scBonusForPackage)(p)
        }))
    };
});
/**
 * Demo/stub: confirm a pending deposit and credit wallet (Admin SDK).
 * Gated to admins / explicit staging opt-in — see assertStubPaymentsAllowed.
 * Replace with real webhook verification before production money.
 */
exports.confirmDepositStub = (0, https_1.onCall)(async (request) => {
    assertStubPaymentsAllowed(request);
    const uid = request.auth.uid;
    const depositId = String(request.data?.depositId || '');
    if (!depositId) {
        throw new https_1.HttpsError('invalid-argument', 'depositId required.');
    }
    const db = (0, firestore_1.getFirestore)();
    const depRef = db.collection('deposits').doc(depositId);
    return await db.runTransaction(async (tx) => {
        const dep = await tx.get(depRef);
        if (!dep.exists)
            throw new https_1.HttpsError('not-found', 'Deposit not found.');
        const d = dep.data();
        if (d.uid !== uid)
            throw new https_1.HttpsError('permission-denied', 'Not your deposit.');
        if (d.status === 'completed') {
            return { status: 'completed', already: true };
        }
        if (d.status !== 'pending') {
            throw new https_1.HttpsError('failed-precondition', `Cannot confirm status=${d.status}`);
        }
        const walletRef = db.collection('users').doc(uid).collection('wallet').doc('balances');
        const w = await tx.get(walletRef);
        const gc = Number(w.data()?.goldCoins) || 0;
        const sc = Number(w.data()?.sweepstakesCoins) || 0;
        const addGc = Number(d.gcAmount) || 0;
        const addSc = Number(d.bonusScAmount) || 0;
        tx.set(walletRef, {
            goldCoins: gc + addGc,
            sweepstakesCoins: sc + addSc,
            updatedAt: firestore_1.FieldValue.serverTimestamp()
        }, { merge: true });
        tx.update(depRef, {
            status: 'completed',
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp()
        });
        return {
            status: 'completed',
            gcGranted: addGc,
            scBonus: addSc,
            goldCoins: gc + addGc,
            sweepstakesCoins: sc + addSc
        };
    });
});
//# sourceMappingURL=requestDeposit.js.map