import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// processedRequests docs only need to outlive the timestamp-freshness
// window processPlayerShot enforces (60s) — 48h gives generous headroom
// for clock skew / retried requests without letting the collection grow
// forever.
const RETENTION_MS = 48 * 60 * 60 * 1000;
const BATCH_SIZE = 400;

/**
 * Deletes processedRequests idempotency-key docs older than the retention
 * window, across all users. These docs exist purely to reject duplicate
 * shot requests; once they're older than the freshness window a shot
 * could ever be replayed within, they have no further purpose.
 *
 * Requires a collection-group index on processedRequests.createdAt
 * (added in firestore.indexes.json) — deploy indexes before this function.
 */
export const cleanupProcessedRequests = onSchedule('every 24 hours', async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - RETENTION_MS);
  let deletedTotal = 0;

  // Loop in batches rather than one giant query/delete, since a long-running
  // production instance could have far more stale docs than fit in one
  // batch write (Firestore batches cap at 500 ops).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await db
      .collectionGroup('processedRequests')
      .where('createdAt', '<', cutoff)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedTotal += snap.size;

    if (snap.size < BATCH_SIZE) break;
  }

  console.log(`[cleanupProcessedRequests] deleted ${deletedTotal} stale idempotency docs`);
});
