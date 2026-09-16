"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAYOUT_TABLE = exports.MAX_RTP = exports.MIN_RTP = void 0;
exports.clampRtp = clampRtp;
exports.validatePayoutTable = validatePayoutTable;
exports.makePayoutTableVersion = makePayoutTableVersion;
exports.buildProspectiveTable = buildProspectiveTable;
exports.runPayoutMonteCarlo = runPayoutMonteCarlo;
exports.summarizeMonteCarlo = summarizeMonteCarlo;
exports.recommendNextRtp = recommendNextRtp;
exports.MIN_RTP = 85;
exports.MAX_RTP = 90;
exports.DEFAULT_PAYOUT_TABLE = {
    version: 'payout-v1-85',
    targetRtp: 88.5,
    hit: {
        baseHitRate: 0.35,
        luckyHitChance: 0.15,
        superCritChance: 0.04,
        critChance: 0.16,
        instantKillChance: {
            small: 0.29,
            medium: 0.15,
            boss: 0.05
        }
    },
    kill: {
        jackpotChance: 0.03,
        tripleChance: 0.10,
        bonusChance: 0.25,
        jackpotMultiplier: 15,
        tripleMultiplier: 5,
        bonusMultiplier: 2.5,
        bossTypeBoost: 1.5
    }
};
function clampRtp(value) {
    if (!Number.isFinite(value))
        return exports.MIN_RTP;
    return Math.min(exports.MAX_RTP, Math.max(exports.MIN_RTP, value));
}
function validatePayoutTable(table) {
    const targetRtp = clampRtp(Number(table.targetRtp));
    if (!table.version || typeof table.version !== 'string') {
        throw new Error('Invalid payout table version.');
    }
    const hit = table.hit;
    const kill = table.kill;
    const probabilities = [
        hit.baseHitRate,
        hit.luckyHitChance,
        hit.superCritChance,
        hit.critChance,
        hit.instantKillChance.small,
        hit.instantKillChance.medium,
        hit.instantKillChance.boss,
        kill.jackpotChance,
        kill.tripleChance,
        kill.bonusChance
    ];
    if (probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
        throw new Error('Invalid payout table probability.');
    }
    const multipliers = [
        kill.jackpotMultiplier,
        kill.tripleMultiplier,
        kill.bonusMultiplier,
        kill.bossTypeBoost
    ];
    if (multipliers.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new Error('Invalid payout table multiplier.');
    }
    return {
        ...table,
        targetRtp
    };
}
function makePayoutTableVersion(targetRtp) {
    const normalized = clampRtp(targetRtp);
    return `payout-${Date.now()}-${normalized.toFixed(2)}`;
}
/**
 * Produces a prospective table from the baseline.
 *
 * The adjustment is deliberately bounded and aggregate:
 * it changes the next table only and never individual player outcomes.
 */
function buildProspectiveTable(targetRtp, version = makePayoutTableVersion(targetRtp)) {
    const rtp = clampRtp(targetRtp);
    const looseness = rtp / exports.MIN_RTP;
    return validatePayoutTable({
        ...exports.DEFAULT_PAYOUT_TABLE,
        version,
        targetRtp: rtp,
        hit: {
            ...exports.DEFAULT_PAYOUT_TABLE.hit,
            baseHitRate: exports.DEFAULT_PAYOUT_TABLE.hit.baseHitRate * looseness,
            luckyHitChance: exports.DEFAULT_PAYOUT_TABLE.hit.luckyHitChance * looseness,
            superCritChance: exports.DEFAULT_PAYOUT_TABLE.hit.superCritChance * looseness,
            critChance: exports.DEFAULT_PAYOUT_TABLE.hit.critChance * looseness,
            instantKillChance: {
                small: exports.DEFAULT_PAYOUT_TABLE.hit.instantKillChance.small * looseness,
                medium: exports.DEFAULT_PAYOUT_TABLE.hit.instantKillChance.medium * looseness,
                boss: exports.DEFAULT_PAYOUT_TABLE.hit.instantKillChance.boss * looseness
            }
        },
        kill: {
            ...exports.DEFAULT_PAYOUT_TABLE.kill,
            jackpotChance: exports.DEFAULT_PAYOUT_TABLE.kill.jackpotChance * looseness,
            tripleChance: exports.DEFAULT_PAYOUT_TABLE.kill.tripleChance * looseness,
            bonusChance: exports.DEFAULT_PAYOUT_TABLE.kill.bonusChance * looseness
        }
    });
}
function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * Calibrates the payout table against the same probability structure used
 * by authoritative settlement.
 *
 * hitRatio represents the externally observed collision/hit rate. The
 * simulation itself never changes an individual player's outcome.
 */
function runPayoutMonteCarlo(table, shotsPerRatio = 100_000) {
    const results = [];
    const shots = Math.max(1, Math.floor(shotsPerRatio));
    // Production normal-wave fish exposure:
    // 55% of waves produce 2–4 small fish (mean 3).
    // 45% produce one medium fish.
    // Bosses are a separate Boss Raid economy event.
    const smallExposure = 0.55 * 3;
    const mediumExposure = 0.45;
    const smallWeight = smallExposure / (smallExposure + mediumExposure);
    for (let hitRatio = 33; hitRatio <= 100; hitRatio += 1) {
        const rng = seededRandom(42_000 + hitRatio);
        let wagered = 0;
        let paidOut = 0;
        for (let shot = 0; shot < shots; shot += 1) {
            const bet = 1;
            wagered += bet;
            if (rng() >= hitRatio / 100) {
                continue;
            }
            const fishType = rng() < smallWeight ? 'small' : 'medium';
            const isLuckyHit = rng() < table.hit.luckyHitChance;
            paidOut += isLuckyHit
                ? bet
                : bet * table.hit.baseHitRate;
            // Consume the authoritative crit/jitter RNG sequence.
            rng();
            rng();
            const isInstantKill = rng() < table.hit.instantKillChance[fishType];
            if (!isInstantKill) {
                continue;
            }
            const baseMultiplier = fishType === 'medium' ? 4 : 1.2;
            const bonusRoll = rng();
            let multiplier = baseMultiplier;
            if (bonusRoll < table.kill.jackpotChance) {
                multiplier *= table.kill.jackpotMultiplier;
            }
            else if (bonusRoll < table.kill.tripleChance) {
                multiplier *= table.kill.tripleMultiplier;
            }
            else if (bonusRoll < table.kill.bonusChance) {
                multiplier *= table.kill.bonusMultiplier;
            }
            paidOut += bet * multiplier * 0.7;
        }
        results.push({
            hitRatio,
            shots,
            wagered,
            paidOut,
            realizedRtp: wagered > 0
                ? (paidOut / wagered) * 100
                : 0
        });
    }
    return results;
}
function summarizeMonteCarlo(results) {
    if (results.length === 0)
        return 0;
    const wagered = results.reduce((sum, result) => sum + result.wagered, 0);
    const paidOut = results.reduce((sum, result) => sum + result.paidOut, 0);
    return wagered > 0 ? (paidOut / wagered) * 100 : 0;
}
/**
 * Pick a bounded prospective target from realized aggregate RTP.
 *
 * This changes only the next payout table. Existing sessions remain locked.
 */
function recommendNextRtp(realizedRtp, currentTargetRtp) {
    const target = clampRtp(currentTargetRtp);
    if (!Number.isFinite(realizedRtp)) {
        return target;
    }
    // Small aggregate corrections only; no player-specific adjustment.
    if (realizedRtp > 90) {
        return clampRtp(target - 0.5);
    }
    if (realizedRtp < 85) {
        return clampRtp(target + 0.5);
    }
    if (realizedRtp > target + 0.25) {
        return clampRtp(target - 0.25);
    }
    if (realizedRtp < target - 0.25) {
        return clampRtp(target + 0.25);
    }
    return target;
}
//# sourceMappingURL=payoutTable.js.map