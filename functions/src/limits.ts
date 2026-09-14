import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

/** Production economy limits (server-enforced). */
export const MAX_BET_SC = 10;
export const MAX_BET_GC = 10;
export const MAX_SHOTS_PER_MINUTE = 120;
export const MAX_DAILY_SC_LOSS = 500;

export async function assertRateLimit(uid: string, action: string, maxPerMinute: number): Promise<void> {
  const db = admin.firestore();
  const ref = db.collection('users').doc(uid).collection('rateLimits').doc(action);
  const now = Date.now();
  const windowMs = 60_000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : { windowStart: now, count: 0 };
    let windowStart = Number(data.windowStart) || now;
    let count = Number(data.count) || 0;
    if (now - windowStart > windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    if (count > maxPerMinute) {
      throw new HttpsError('resource-exhausted', `Rate limit exceeded for ${action}.`);
    }
    tx.set(ref, { windowStart, count, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

export async function assertDailyScLoss(uid: string, additionalLoss: number): Promise<void> {
  if (additionalLoss <= 0) return;
  const db = admin.firestore();
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection('users').doc(uid).collection('dailyStats').doc(day);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const netLoss = (snap.exists ? Number(snap.data()!.scNetLoss) || 0 : 0) + additionalLoss;
    if (netLoss > MAX_DAILY_SC_LOSS) {
      throw new HttpsError(
        'failed-precondition',
        `Daily SC loss cap (${MAX_DAILY_SC_LOSS}) reached.`
      );
    }
    tx.set(
      ref,
      {
        scNetLoss: netLoss,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });
}

export function assertBetAmount(betAmount: number, currencyType: string): void {
  if (typeof betAmount !== 'number' || !Number.isFinite(betAmount) || betAmount <= 0) {
    throw new HttpsError('invalid-argument', 'Invalid bet amount.');
  }
  const max = currencyType === 'SC' ? MAX_BET_SC : MAX_BET_GC;
  if (betAmount > max) {
    throw new HttpsError('invalid-argument', `Bet exceeds max ${max} ${currencyType}.`);
  }
}
