import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { DEFAULT_PACKAGES, scBonusForPackage, type PackageTier } from './economyConfig';

/**
 * Admin-editable package tiers. For now any authenticated user can update
 * in staging; gate with custom claim admin:true before production.
 */
export const updatePackages = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const tiers = request.data?.tiers as PackageTier[] | undefined;
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new HttpsError('invalid-argument', 'tiers array required.');
  }

  const cleaned: PackageTier[] = tiers.map((t) => {
    const priceUsd = Number(t.priceUsd);
    const gcAmount = Math.max(0, Math.floor(Number(t.gcAmount) || 0));
    const scBonusPct = Math.max(0, Math.min(20, Number(t.scBonusPct) || 0));
    if (!t.id || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid tier fields.');
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

  const db = getFirestore();
  await db.collection('config').doc('packages').set({
    tiers: cleaned,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid
  });

  return {
    ok: true,
    tiers: cleaned.map((p) => ({ ...p, bonusScAmount: scBonusForPackage(p) }))
  };
});

export const seedDefaultPackages = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const db = getFirestore();
  await db.collection('config').doc('packages').set({
    tiers: DEFAULT_PACKAGES,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid
  });
  return {
    ok: true,
    tiers: DEFAULT_PACKAGES.map((p) => ({ ...p, bonusScAmount: scBonusForPackage(p) }))
  };
});
