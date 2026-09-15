export const MIN_RTP = 85;
export const MAX_RTP = 90;

export type PayoutTable = {
  version: string;
  targetRtp: number;

  hit: {
    baseHitRate: number;
    luckyHitChance: number;
    superCritChance: number;
    critChance: number;
    instantKillChance: {
      small: number;
      medium: number;
      boss: number;
    };
  };

  kill: {
    jackpotChance: number;
    tripleChance: number;
    bonusChance: number;
    jackpotMultiplier: number;
    tripleMultiplier: number;
    bonusMultiplier: number;
    bossTypeBoost: number;
  };

  createdAt?: unknown;
  activatedAt?: unknown;
};

export const DEFAULT_PAYOUT_TABLE: PayoutTable = {
  version: 'payout-v1-85',
  targetRtp: 85,

  hit: {
    baseHitRate: 0.24,
    luckyHitChance: 0.06,
    superCritChance: 0.04,
    critChance: 0.16,
    instantKillChance: {
      small: 0.22,
      medium: 0.10,
      boss: 0.032
    }
  },

  kill: {
    jackpotChance: 0.02,
    tripleChance: 0.08,
    bonusChance: 0.20,
    jackpotMultiplier: 10,
    tripleMultiplier: 3,
    bonusMultiplier: 1.5,
    bossTypeBoost: 1.2
  }
};

export function clampRtp(value: number): number {
  if (!Number.isFinite(value)) return MIN_RTP;
  return Math.min(MAX_RTP, Math.max(MIN_RTP, value));
}

export function validatePayoutTable(table: PayoutTable): PayoutTable {
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

export function makePayoutTableVersion(targetRtp: number): string {
  const normalized = clampRtp(targetRtp);
  return `payout-${Date.now()}-${normalized.toFixed(2)}`;
}

/**
 * Produces a prospective table from the baseline.
 *
 * The adjustment is deliberately bounded and aggregate:
 * it changes the next table only and never individual player outcomes.
 */
export function buildProspectiveTable(
  targetRtp: number,
  version = makePayoutTableVersion(targetRtp)
): PayoutTable {
  const rtp = clampRtp(targetRtp);
  const looseness = rtp / MIN_RTP;

  return validatePayoutTable({
    ...DEFAULT_PAYOUT_TABLE,
    version,
    targetRtp: rtp,

    hit: {
      ...DEFAULT_PAYOUT_TABLE.hit,
      baseHitRate: DEFAULT_PAYOUT_TABLE.hit.baseHitRate * looseness,
      luckyHitChance: DEFAULT_PAYOUT_TABLE.hit.luckyHitChance * looseness,
      superCritChance: DEFAULT_PAYOUT_TABLE.hit.superCritChance * looseness,
      critChance: DEFAULT_PAYOUT_TABLE.hit.critChance * looseness,
      instantKillChance: {
        small: DEFAULT_PAYOUT_TABLE.hit.instantKillChance.small * looseness,
        medium: DEFAULT_PAYOUT_TABLE.hit.instantKillChance.medium * looseness,
        boss: DEFAULT_PAYOUT_TABLE.hit.instantKillChance.boss * looseness
      }
    },

    kill: {
      ...DEFAULT_PAYOUT_TABLE.kill,
      jackpotChance: DEFAULT_PAYOUT_TABLE.kill.jackpotChance * looseness,
      tripleChance: DEFAULT_PAYOUT_TABLE.kill.tripleChance * looseness,
      bonusChance: DEFAULT_PAYOUT_TABLE.kill.bonusChance * looseness
    }
  });
}

export type MonteCarloResult = {
  hitRatio: number;
  shots: number;
  wagered: number;
  paidOut: number;
  realizedRtp: number;
};

function seededRandom(seed: number): () => number {
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
export function runPayoutMonteCarlo(
  table: PayoutTable,
  shotsPerRatio = 100_000
): MonteCarloResult[] {
  const results: MonteCarloResult[] = [];
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

      const isInstantKill =
        rng() < table.hit.instantKillChance[fishType];

      if (!isInstantKill) {
        continue;
      }

      const baseMultiplier =
        fishType === 'medium' ? 4 : 1.2;

      const bonusRoll = rng();
      let multiplier = baseMultiplier;

      if (bonusRoll < table.kill.jackpotChance) {
        multiplier *= table.kill.jackpotMultiplier;
      } else if (bonusRoll < table.kill.tripleChance) {
        multiplier *= table.kill.tripleMultiplier;
      } else if (bonusRoll < table.kill.bonusChance) {
        multiplier *= table.kill.bonusMultiplier;
      }

      paidOut += bet * multiplier * 0.7;
    }

    results.push({
      hitRatio,
      shots,
      wagered,
      paidOut,
      realizedRtp:
        wagered > 0
          ? (paidOut / wagered) * 100
          : 0
    });
  }

  return results;
}

export function summarizeMonteCarlo(results: MonteCarloResult[]): number {
  if (results.length === 0) return 0;

  const wagered = results.reduce(
    (sum, result) => sum + result.wagered,
    0
  );

  const paidOut = results.reduce(
    (sum, result) => sum + result.paidOut,
    0
  );

  return wagered > 0 ? (paidOut / wagered) * 100 : 0;
}

/**
 * Pick a bounded prospective target from realized aggregate RTP.
 *
 * This changes only the next payout table. Existing sessions remain locked.
 */
export function recommendNextRtp(
  realizedRtp: number,
  currentTargetRtp: number
): number {
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
