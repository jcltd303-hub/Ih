import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  DEFAULT_PACKAGES,
  getDefaultPackage,
  scBonusForPackage,
  type PackageTier
} from './economyConfig';
import { createCryptoProvider } from './payments/CryptoProvider';
import { StripeProvider } from './payments/StripeProvider';
import { CapitalProvider } from './payments/CapitalProvider';
import type { PaymentProvider } from './payments/PaymentProvider';

async function resolvePackage(
  db: FirebaseFirestore.Firestore,
  packageId: string
): Promise<PackageTier> {
  const snap = await db.collection('config').doc('packages').get();
  if (snap.exists) {
    const list = (snap.data()?.tiers || []) as PackageTier[];
    const found = list.find((p) => p.id === packageId && p.active !== false);
    if (found) return found;
  }
  const def = getDefaultPackage(packageId);
  if (!def) throw new HttpsError('not-found', `Unknown package: ${packageId}`);
  return def;
}

function providerFor(
  name: string,
  cryptoAsset?: string
): PaymentProvider {
  const n = (name || 'crypto').toLowerCase();
  if (n === 'stripe') return new StripeProvider();
  if (n === 'capital') return new CapitalProvider();
  return createCryptoProvider(cryptoAsset || 'USDT');
}

/**
 * Start a package purchase. Client sends packageId + provider only — amounts from server config.
 */
export const requestDeposit = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = request.auth.uid;
  const packageId = String(request.data?.packageId || '');
  const providerName = String(request.data?.provider || 'crypto');
  const cryptoAsset = request.data?.cryptoAsset
    ? String(request.data.cryptoAsset)
    : 'USDT';

  if (!packageId) {
    throw new HttpsError('invalid-argument', 'packageId required.');
  }

  const db = getFirestore();
  const pkg = await resolvePackage(db, packageId);
  const bonusSc = scBonusForPackage(pkg);
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
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
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
export const listPackages = onCall(async () => {
  const db = getFirestore();
  const snap = await db.collection('config').doc('packages').get();
  if (snap.exists && Array.isArray(snap.data()?.tiers) && snap.data()!.tiers.length) {
    return { tiers: snap.data()!.tiers.filter((t: PackageTier) => t.active !== false) };
  }
  return {
    tiers: DEFAULT_PACKAGES.filter((p) => p.active).map((p) => ({
      ...p,
      bonusScAmount: scBonusForPackage(p)
    }))
  };
});

/**
 * Demo/stub: confirm a pending deposit and credit wallet (Admin SDK).
 * Replace with real webhook verification before production money.
 */
export const confirmDepositStub = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = request.auth.uid;
  const depositId = String(request.data?.depositId || '');
  if (!depositId) {
    throw new HttpsError('invalid-argument', 'depositId required.');
  }

  const db = getFirestore();
  const depRef = db.collection('deposits').doc(depositId);

  return await db.runTransaction(async (tx) => {
    const dep = await tx.get(depRef);
    if (!dep.exists) throw new HttpsError('not-found', 'Deposit not found.');
    const d = dep.data()!;
    if (d.uid !== uid) throw new HttpsError('permission-denied', 'Not your deposit.');
    if (d.status === 'completed') {
      return { status: 'completed', already: true };
    }
    if (d.status !== 'pending') {
      throw new HttpsError('failed-precondition', `Cannot confirm status=${d.status}`);
    }

    const walletRef = db.collection('users').doc(uid).collection('wallet').doc('balances');
    const w = await tx.get(walletRef);
    const gc = Number(w.data()?.goldCoins) || 0;
    const sc = Number(w.data()?.sweepstakesCoins) || 0;
    const addGc = Number(d.gcAmount) || 0;
    const addSc = Number(d.bonusScAmount) || 0;

    tx.set(
      walletRef,
      {
        goldCoins: gc + addGc,
        sweepstakesCoins: sc + addSc,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    tx.update(depRef, {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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
