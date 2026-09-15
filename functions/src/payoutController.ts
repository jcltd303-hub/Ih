import * as admin from 'firebase-admin';
import {
  buildProspectiveTable,
  clampRtp,
  recommendNextRtp,
  runPayoutMonteCarlo,
  summarizeMonteCarlo,
  type PayoutTable
} from './payoutTable';

const MIN_SAMPLE_WAGER = 10_000;
const MIN_TABLE_CHANGE_MS = 60 * 60 * 1000;
const TELEMETRY_SHARDS = 32;

export type PayoutTelemetry = {
  wagered: number;
  paidOut: number;
  shots: number;
  kills: number;
};

export function realizedRtp(telemetry: PayoutTelemetry): number {
  if (telemetry.wagered <= 0) return 0;
  return (telemetry.paidOut / telemetry.wagered) * 100;
}

export async function loadAggregateTelemetry(
  db: admin.firestore.Firestore,
  tableVersion: string
): Promise<PayoutTelemetry> {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const startBucket = start.toISOString().slice(0, 13).replace('T', '');
  const endBucket = now.toISOString().slice(0, 13).replace('T', '');

  const snapshot = await db
    .collection('economyTelemetry')
    .where('tableVersion', '==', tableVersion)
    .where('bucket', '>=', startBucket)
    .where('bucket', '<=', endBucket)
    .get();

  const totals: PayoutTelemetry = {
    wagered: 0,
    paidOut: 0,
    shots: 0,
    kills: 0
  };

  snapshot.docs.forEach((doc) => {
    const data = doc.data();

    totals.wagered += Number(data.wagered) || 0;
    totals.paidOut += Number(data.paidOut) || 0;
    totals.shots += Number(data.shots) || 0;
    totals.kills += Number(data.kills) || 0;
  });

  return totals;
}

export async function calibrateNextPayoutTable(
  db: admin.firestore.Firestore,
  activeTable: PayoutTable,
  telemetry: PayoutTelemetry
): Promise<PayoutTable | null> {
  if (telemetry.wagered < MIN_SAMPLE_WAGER) {
    return null;
  }

  const actualRtp = realizedRtp(telemetry);

  const recommendedRtp = recommendNextRtp(
    actualRtp,
    activeTable.targetRtp
  );

  const candidate = buildProspectiveTable(recommendedRtp);

  const monteCarlo = runPayoutMonteCarlo(candidate, 100_000);
  const calibratedRtp = summarizeMonteCarlo(monteCarlo);

  const finalTarget = clampRtp(
    recommendNextRtp(calibratedRtp, recommendedRtp)
  );

  const configRef = db.collection('config').doc('payoutActive');
  const snap = await configRef.get();

  if (snap.exists) {
    const data = snap.data() || {};
    const activatedAt = Number(data.activatedAtMs) || 0;

    if (Date.now() - activatedAt < MIN_TABLE_CHANGE_MS) {
      return null;
    }
  }

  const nextTable = buildProspectiveTable(finalTarget);

  await configRef.set({
    table: nextTable,
    version: nextTable.version,
    targetRtp: nextTable.targetRtp,
    realizedRtp: actualRtp,
    monteCarloRtp: calibratedRtp,
    sampleWager: telemetry.wagered,
    sampleShots: telemetry.shots,
    sampleKills: telemetry.kills,
    activatedAtMs: Date.now(),
    activatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return nextTable;
}

export const TELEMETRY_SHARD_COUNT = TELEMETRY_SHARDS;
