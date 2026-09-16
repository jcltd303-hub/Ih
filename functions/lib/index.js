"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calibratePayoutTable = exports.getEconomyStats = exports.seedDefaultPackages = exports.updatePackages = exports.requestWithdrawal = exports.confirmDepositStub = exports.listPackages = exports.requestDeposit = exports.revealSessionSeed = exports.startGameSession = exports.ensureUserWallet = exports.validatePlayerRegion = exports.processPlayerShot = void 0;
const admin = require("firebase-admin");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const processPlayerShot_1 = require("./processPlayerShot");
Object.defineProperty(exports, "processPlayerShot", { enumerable: true, get: function () { return processPlayerShot_1.processPlayerShot; } });
const validateRegion_1 = require("./validateRegion");
Object.defineProperty(exports, "validatePlayerRegion", { enumerable: true, get: function () { return validateRegion_1.validatePlayerRegion; } });
const ensureUserWallet_1 = require("./ensureUserWallet");
Object.defineProperty(exports, "ensureUserWallet", { enumerable: true, get: function () { return ensureUserWallet_1.ensureUserWallet; } });
const startGameSession_1 = require("./startGameSession");
Object.defineProperty(exports, "startGameSession", { enumerable: true, get: function () { return startGameSession_1.startGameSession; } });
Object.defineProperty(exports, "revealSessionSeed", { enumerable: true, get: function () { return startGameSession_1.revealSessionSeed; } });
const requestDeposit_1 = require("./requestDeposit");
Object.defineProperty(exports, "requestDeposit", { enumerable: true, get: function () { return requestDeposit_1.requestDeposit; } });
Object.defineProperty(exports, "listPackages", { enumerable: true, get: function () { return requestDeposit_1.listPackages; } });
Object.defineProperty(exports, "confirmDepositStub", { enumerable: true, get: function () { return requestDeposit_1.confirmDepositStub; } });
const requestWithdrawal_1 = require("./requestWithdrawal");
Object.defineProperty(exports, "requestWithdrawal", { enumerable: true, get: function () { return requestWithdrawal_1.requestWithdrawal; } });
const updatePackages_1 = require("./updatePackages");
Object.defineProperty(exports, "updatePackages", { enumerable: true, get: function () { return updatePackages_1.updatePackages; } });
Object.defineProperty(exports, "seedDefaultPackages", { enumerable: true, get: function () { return updatePackages_1.seedDefaultPackages; } });
const getEconomyStats_1 = require("./getEconomyStats");
Object.defineProperty(exports, "getEconomyStats", { enumerable: true, get: function () { return getEconomyStats_1.getEconomyStats; } });
const payoutController_1 = require("./payoutController");
const payoutTable_1 = require("./payoutTable");
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.calibratePayoutTable = (0, scheduler_1.onSchedule)({
    schedule: 'every 60 minutes',
    timeZone: 'America/Denver',
    region: 'us-central1'
}, async () => {
    const db = admin.firestore();
    const activeSnap = await db
        .collection('config')
        .doc('payoutActive')
        .get();
    const activeData = activeSnap.data() || {};
    const activeTable = activeData.table
        ? (0, payoutTable_1.validatePayoutTable)(activeData.table)
        : payoutTable_1.DEFAULT_PAYOUT_TABLE;
    const telemetry = await (0, payoutController_1.loadAggregateTelemetry)(db, activeTable.version);
    const nextTable = await (0, payoutController_1.calibrateNextPayoutTable)(db, activeTable, telemetry);
    if (nextTable) {
        console.log(`Activated payout table ${nextTable.version} at ${nextTable.targetRtp}% target RTP.`);
    }
    else {
        console.log(`Payout calibration skipped: ${telemetry.wagered} wagered against table ${activeTable.version}.`);
    }
});
//# sourceMappingURL=index.js.map