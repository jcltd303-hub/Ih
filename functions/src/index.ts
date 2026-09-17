import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { processPlayerShot } from './processPlayerShot';
import { issueGameplayTarget } from './issueGameplayTarget';
import { validatePlayerRegion } from './validateRegion';
import { ensureUserWallet } from './ensureUserWallet';
import { startGameSession, closeGameSession, revealSessionSeed } from './startGameSession';
import { requestDeposit, listPackages, confirmDepositStub } from './requestDeposit';
import { requestWithdrawal } from './requestWithdrawal';
import { updatePackages, seedDefaultPackages } from './updatePackages';
import { getEconomyStats } from './getEconomyStats';

import {
  loadAggregateTelemetry,
  calibrateNextPayoutTable
} from './payoutController';

import {
  DEFAULT_PAYOUT_TABLE,
  validatePayoutTable
} from './payoutTable';

if (!admin.apps.length) {
  admin.initializeApp();
}

export {
  processPlayerShot,
  issueGameplayTarget,
  validatePlayerRegion,
  ensureUserWallet,
  startGameSession,
  closeGameSession,
  revealSessionSeed,
  requestDeposit,
  listPackages,
  confirmDepositStub,
  requestWithdrawal,
  updatePackages,
  seedDefaultPackages,
  getEconomyStats
};

export const calibratePayoutTable = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'America/Denver',
    region: 'us-central1'
  },
  async () => {
    const db = admin.firestore();

    const activeSnap = await db
      .collection('config')
      .doc('payoutActive')
      .get();

    const activeData = activeSnap.data() || {};

    const activeTable = activeData.table
      ? validatePayoutTable(activeData.table)
      : DEFAULT_PAYOUT_TABLE;

    const telemetry = await loadAggregateTelemetry(
      db,
      activeTable.version
    );

    const nextTable = await calibrateNextPayoutTable(
      db,
      activeTable,
      telemetry
    );

    if (nextTable) {
      console.log(
        `Activated payout table ${nextTable.version} at ${nextTable.targetRtp}% target RTP.`
      );
    } else {
      console.log(
        `Payout calibration skipped: ${telemetry.wagered} wagered against table ${activeTable.version}.`
      );
    }
  }
);
