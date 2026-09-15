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

  const monteCarlo = runPayoutMonteCarlo(
    buildProspectiveTable(recommendedRtp),
    100_000
  );

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
