/**
 * PayoutEngine: Game looseness, Monte Carlo auditor, and operator P&L ledger.
 * Target RTP is operator-configurable; lifetime deposits vs payouts track house profitability.
 */

export interface PayoutConfig {
  /** Target return-to-player % (50–120). */
  targetRtp: number;
  gambleKillEnabled: boolean;
  gambleBonusMultiplierEnabled: boolean;
  volatility: 'low' | 'medium' | 'high';
  /** Soft lifetime RTP guard. */
  maxLifetimeRtpGuard: number;
}

export interface SessionStats {
  totalWagered: number;
  totalPaidOut: number;
  totalShots: number;
  totalHits: number;
  totalKills: number;
  instantGambleKills: number;
  critHits: number;
  bonusJackpotTriggers: number;
  realizedRtp: number;
}

export interface ProfitLedger {
  totalDeposits: number;
  totalHandle: number;
  totalPayouts: number;
  sessionCount: number;
  updatedAt: number;
}

export interface ProfitSnapshot {
  ledger: ProfitLedger;
  gameHouseEdgePct: number;
  realizedRtpOnHandle: number;
  cashProfit: number;
  cashMarginPct: number;
  isProfitable: boolean;
  guardActive: boolean;
}

export interface MonteCarloResult {
  shots: number;
  targetRtp: number;
  totalWagered: number;
  totalPayout: number;
  realizedRtp: number;
  houseEdgePct: number;
  instantKills: number;
  jackpots: number;
  hitRate: number;
  rtpP5: number;
  rtpP95: number;
  minBatchRtp: number;
  maxBatchRtp: number;
  byFish: Record<
    'small' | 'medium' | 'boss',
    { kills: number; paid: number }
  >;
  profitableAtTarget: boolean;
}

export interface HitRatioSweepResult extends MonteCarloResult {
  hitRatio: number;
}

const CONFIG_KEY = 'fish_frenzy_admin_payout_config';
const LEDGER_KEY = 'fish_frenzy_profit_ledger';

export class PayoutEngine {
  private static config: PayoutConfig = {
    targetRtp: 85,
    gambleKillEnabled: true,
    gambleBonusMultiplierEnabled: true,
    volatility: 'medium',
    maxLifetimeRtpGuard: 105
  };

  private static stats: SessionStats = {
    totalWagered: 0,
    totalPaidOut: 0,
    totalShots: 0,
    totalHits: 0,
    totalKills: 0,
    instantGambleKills: 0,
    critHits: 0,
    bonusJackpotTriggers: 0,
    realizedRtp: 0
  };

  private static ledger: ProfitLedger = {
    totalDeposits: 0,
    totalHandle: 0,
    totalPayouts: 0,
    sessionCount: 0,
    updatedAt: Date.now()
  };

  public static getConfig(): PayoutConfig {
    return { ...this.config };
  }

  public static getTargetRtp(): number {
    return this.config.targetRtp;
  }

  public static getSessionStats(): SessionStats {
    const realizedRtp =
      this.stats.totalWagered > 0
        ? (this.stats.totalPaidOut /
            this.stats.totalWagered) *
          100
        : 0;

    return {
      ...this.stats,
      realizedRtp
    };
  }

  public static resetSessionStats(): void {
    this.stats = {
      totalWagered: 0,
      totalPaidOut: 0,
      totalShots: 0,
      totalHits: 0,
      totalKills: 0,
      instantGambleKills: 0,
      critHits: 0,
      bonusJackpotTriggers: 0,
      realizedRtp: 0
    };
  }

  public static getProfitSnapshot(): ProfitSnapshot {
    const {
      totalDeposits,
      totalHandle,
      totalPayouts
    } = this.ledger;

    const realizedRtpOnHandle =
      totalHandle > 0
        ? (totalPayouts / totalHandle) * 100
        : 0;

    const gameHouseEdgePct =
      totalHandle > 0
        ? ((totalHandle - totalPayouts) /
            totalHandle) *
          100
        : 0;

    const cashProfit =
      totalDeposits - totalPayouts;

    const cashMarginPct =
      totalDeposits > 0
        ? (cashProfit / totalDeposits) * 100
        : 0;

    const guardActive =
      totalHandle > 100 &&
      realizedRtpOnHandle >
        this.config.maxLifetimeRtpGuard;

    const isProfitable =
      (
        totalDeposits <= 0
          ? gameHouseEdgePct > 0
          : cashProfit > 0
      ) &&
      (
        totalHandle <= 0 ||
        realizedRtpOnHandle <=
          this.config.targetRtp + 8
      );

    return {
      ledger: { ...this.ledger },
      gameHouseEdgePct,
      realizedRtpOnHandle,
      cashProfit,
      cashMarginPct,
      isProfitable,
      guardActive
    };
  }

  public static recordDeposit(amount: number): void {
    if (!(amount > 0)) return;

    this.ledger.totalDeposits += amount;
  }

  public static recordWager(
    betAmount: number
  ): void {
    this.stats.totalShots++;
    this.stats.totalWagered += betAmount;

    this.ledger.totalHandle += betAmount;
  }

  public static recordPayout(
    payoutAmount: number
  ): void {
    if (!(payoutAmount > 0)) return;

    this.stats.totalPaidOut += payoutAmount;
    this.ledger.totalPayouts += payoutAmount;
  }

  public static resetLedger(): void {
    this.ledger = {
      totalDeposits: 0,
      totalHandle: 0,
      totalPayouts: 0,
      sessionCount:
        this.ledger.sessionCount + 1,
      updatedAt: Date.now()
    };
  }

  private static profitabilityScale(): number {
    const snapshot =
      this.getProfitSnapshot();

    if (!snapshot.guardActive) {
      return 1;
    }

    return Math.max(
      0.55,
      this.config.targetRtp /
        Math.max(
          snapshot.realizedRtpOnHandle,
          1
        )
    );
  }

  public static evaluateHit(
    betAmount: number,
    fishType:
      | 'small'
      | 'medium'
      | 'boss',
    skinBonus: number = 1.0
  ): {
    hitPayout: number;
    isLuckyHit: boolean;
    damage: number;
    isCrit: boolean;
    isSuperCrit: boolean;
    isInstantKill: boolean;
  } {
    this.stats.totalHits++;

    const loosenessFactor =
      this.config.targetRtp / 90;

    const scale =
      this.profitabilityScale();

    const baseHitRate =
      0.24 * loosenessFactor;

    const isLuckyHit =
      Math.random() <
      0.06 * loosenessFactor;

    const hitPayout =
      (
        isLuckyHit
          ? betAmount * 1.0
          : betAmount * baseHitRate
      ) * scale;

    const critRoll = Math.random();

    const isSuperCrit =
      critRoll <
      0.04 * loosenessFactor;

    const isCrit =
      !isSuperCrit &&
      critRoll <
        0.16 * loosenessFactor;

    if (isCrit || isSuperCrit) {
      this.stats.critHits++;
    }

    const critMultiplier =
      isSuperCrit
        ? 3.5
        : isCrit
          ? 2.0
          : 1.0;

    const randomJitter =
      0.9 + Math.random() * 0.3;

    const damage =
      1.0 *
      skinBonus *
      critMultiplier *
      randomJitter;

    let isInstantKill = false;

    if (this.config.gambleKillEnabled) {
      const baseInstantProb =
        fishType === 'small'
          ? 0.22
          : fishType === 'medium'
            ? 0.1
            : 0.032;

      if (
        Math.random() <
        baseInstantProb *
          loosenessFactor *
          scale
      ) {
        isInstantKill = true;
        this.stats.instantGambleKills++;
      }
    }

    return {
      hitPayout,
      isLuckyHit,
      damage,
      isCrit,
      isSuperCrit,
      isInstantKill
    };
  }

  public static evaluateKillMultiplier(
    baseMultiplier: number,
    fishType:
      | 'small'
      | 'medium'
      | 'boss'
  ): {
    finalMultiplier: number;
    bonusLabel: string;
    isJackpot: boolean;
  } {
    this.stats.totalKills++;

    const loosenessFactor =
      this.config.targetRtp / 90;

    const scale =
      this.profitabilityScale();

    if (
      !this.config
        .gambleBonusMultiplierEnabled
    ) {
      return {
        finalMultiplier:
          baseMultiplier * scale,
        bonusLabel: 'STANDARD WIN',
        isJackpot: false
      };
    }

    const roll = Math.random();

    if (
      roll <
      0.02 *
        loosenessFactor *
        scale
    ) {
      this.stats.bonusJackpotTriggers++;

      return {
        finalMultiplier:
          baseMultiplier *
          10 *
          scale,
        bonusLabel:
          '🔥 10X JACKPOT SURGE!',
        isJackpot: true
      };
    }

    if (
      roll <
      0.09 *
        loosenessFactor *
        scale
    ) {
      this.stats.bonusJackpotTriggers++;

      const bonus =
        fishType === 'boss'
          ? 3
          : 5;

      return {
        finalMultiplier:
          baseMultiplier *
          bonus *
          scale,
        bonusLabel:
          `⚡ ${bonus}X MEGA BOUNTY!`,
        isJackpot: true
      };
    }

    if (
      roll <
      0.28 *
        loosenessFactor *
        scale
    ) {
      return {
        finalMultiplier:
          baseMultiplier *
          2 *
          scale,
        bonusLabel:
          '✨ 2X SUPER WIN!',
        isJackpot: false
      };
    }

    return {
      finalMultiplier:
        baseMultiplier * scale,
      bonusLabel:
        'FISH CAPTURED',
      isJackpot: false
    };
  }

  /**
   * Deterministic Monte Carlo auditor.
   *
   * simShots:
   *   Number of simulated shots.
   *
   * targetRtp:
   *   RTP policy used by the simulation.
   *
   * aimAccuracy:
   *   Hit probability, expressed from 0.0 to 1.0.
   *
   * batches:
   *   Number of batches used to calculate RTP variance bands.
   *
   * seed:
   *   Deterministic seed for repeatable calibration.
   */
  public static runMonteCarlo(
    simShots: number = 50_000,
    targetRtp: number =
      PayoutEngine.config.targetRtp,
    options?: {
      aimAccuracy?: number;
      batches?: number;
      seed?: number;
    }
  ): MonteCarloResult {
    const shots =
      Math.max(
        1,
        Math.floor(simShots)
      );

    const aimAccuracy =
      Math.max(
        0,
        Math.min(
          1,
          options?.aimAccuracy ?? 0.7
        )
      );

    const batches =
      Math.max(
        5,
        Math.min(
          shots,
          Math.floor(
            options?.batches ?? 20
          )
        )
      );

    const baseShotsPerBatch =
      Math.floor(shots / batches);

    const remainder =
      shots % batches;

    const loosenessFactor =
      targetRtp / 90;

    let seed =
      options?.seed ?? 42;

    const rng = (): number => {
      seed =
        (seed * 1664525 +
          1013904223) >>>
        0;

      return (
        seed /
        0x100000000
      );
    };

    let totalBet = 0;
    let totalWin = 0;
    let instantKills = 0;
    let jackpots = 0;
    let hits = 0;

    const byFish = {
      small: {
        kills: 0,
        paid: 0
      },
      medium: {
        kills: 0,
        paid: 0
      },
      boss: {
        kills: 0,
        paid: 0
      }
    };

    const batchRtps: number[] = [];

    for (
      let batch = 0;
      batch < batches;
      batch++
    ) {
      const batchShots =
        baseShotsPerBatch +
        (batch < remainder ? 1 : 0);

      let batchBet = 0;
      let batchWin = 0;

      for (
        let shot = 0;
        shot < batchShots;
        shot++
      ) {
        const bet = 1.0;

        batchBet += bet;
        totalBet += bet;

        if (
          rng() >= aimAccuracy
        ) {
          continue;
        }

        hits++;

        const isLucky =
          rng() <
          0.06 *
            loosenessFactor;

        const hitWin =
          isLucky
            ? bet * 1.0
            : bet *
              (0.24 *
                loosenessFactor);

        batchWin += hitWin;
        totalWin += hitWin;

        const fishRoll =
          rng();

        const fishType =
          fishRoll < 0.55
            ? 'small'
            : fishRoll < 0.90
              ? 'medium'
              : 'boss';

        const baseInstant =
          fishType === 'small'
            ? 0.22
            : fishType === 'medium'
              ? 0.10
              : 0.032;

        if (
          rng() <
          baseInstant *
            loosenessFactor
        ) {
          instantKills++;

          byFish[
            fishType
          ].kills++;

          const baseMult =
            fishType === 'small'
              ? 1.2
              : fishType === 'medium'
                ? 4.0
                : 25.0;

          const bonusRoll =
            rng();

          let mult =
            baseMult;

          if (
            bonusRoll <
            0.02 *
              loosenessFactor
          ) {
            mult *= 10;
            jackpots++;
          } else if (
            bonusRoll <
            0.09 *
              loosenessFactor
          ) {
            mult *=
              fishType === 'boss'
                ? 3
                : 5;
            jackpots++;
          } else if (
            bonusRoll <
            0.28 *
              loosenessFactor
          ) {
            mult *= 2;
          }

          const killPay =
            bet *
            mult *
            0.7;

          batchWin += killPay;
          totalWin += killPay;

          byFish[
            fishType
          ].paid += killPay;
        }
      }

      batchRtps.push(
        batchBet > 0
          ? (batchWin /
              batchBet) *
            100
          : 0
      );
    }

    batchRtps.sort(
      (a, b) => a - b
    );

    const percentile = (
      p: number
    ): number => {
      if (
        batchRtps.length === 0
      ) {
        return 0;
      }

      const position =
        (p / 100) *
        (batchRtps.length - 1);

      const lower =
        Math.floor(position);

      const upper =
        Math.ceil(position);

      if (lower === upper) {
        return (
          batchRtps[lower] ?? 0
        );
      }

      const weight =
        position - lower;

      return (
        (batchRtps[lower] ?? 0) *
          (1 - weight) +
        (batchRtps[upper] ?? 0) *
          weight
      );
    };

    const realizedRtp =
      totalBet > 0
        ? (totalWin /
            totalBet) *
          100
        : 0;

    const houseEdgePct =
      100 - realizedRtp;

    return {
      shots,
      targetRtp,
      totalWagered: totalBet,
      totalPayout: totalWin,
      realizedRtp,
      houseEdgePct,
      instantKills,
      jackpots,
      hitRate:
        shots > 0
          ? hits / shots
          : 0,
      rtpP5:
        percentile(5),
      rtpP95:
        percentile(95),
      minBatchRtp:
        batchRtps[0] ?? 0,
      maxBatchRtp:
        batchRtps[
          batchRtps.length - 1
        ] ?? 0,
      byFish,
      profitableAtTarget:
        realizedRtp <=
          targetRtp + 3 &&
        houseEdgePct > 0
    };
  }

  /**
   * Run 100,000 shots at every hit ratio from 33% through 100%.
   *
   * This produces 68 independent simulations:
   *
   *   33%, 34%, ... 100%
   *
   * Total simulated shots:
   *
   *   68 × 100,000 = 6,800,000
   *
   * A unique deterministic seed is used for every ratio so the
   * calibration is reproducible while avoiding identical RNG
   * streams between ratios.
   */
  public static runHitRatioSweep(
    simShotsPerRatio: number = 100_000,
    targetRtp: number = 90
  ): HitRatioSweepResult[] {
    const shots =
      Math.max(
        1,
        Math.floor(
          simShotsPerRatio
        )
      );

    const results: HitRatioSweepResult[] =
      [];

    for (
      let hitRatio = 33;
      hitRatio <= 100;
      hitRatio++
    ) {
      const result =
        PayoutEngine.runMonteCarlo(
          shots,
          targetRtp,
          {
            aimAccuracy:
              hitRatio / 100,
            batches: 25,
            seed:
              42_000 +
              hitRatio
          }
        );

      results.push({
        ...result,
        hitRatio
      });
    }

    return results;
  }

  /**
   * Convenience helper for the operator calibration button.
   *
   * Runs the complete 33–100% sweep and then activates the
   * 90% payout policy.
   */
  public static run90PercentCalibration(
    simShotsPerRatio: number = 100_000
  ): {
    targetRtp: number;
    totalShots: number;
    results: HitRatioSweepResult[];
    minRtp: number;
    maxRtp: number;
    averageRtp: number;
    at33?: HitRatioSweepResult;
    at90?: HitRatioSweepResult;
    at100?: HitRatioSweepResult;
  } {
    const targetRtp = 90;

    const results =
      this.runHitRatioSweep(
        simShotsPerRatio,
        targetRtp
      );

    const rtps =
      results.map(
        (result) =>
          result.realizedRtp
      );

    const minRtp =
      rtps.length > 0
        ? Math.min(...rtps)
        : 0;

    const maxRtp =
      rtps.length > 0
        ? Math.max(...rtps)
        : 0;

    const averageRtp =
      rtps.length > 0
        ? rtps.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / rtps.length
        : 0;

    this.setTargetRtp(
      targetRtp
    );

    return {
      targetRtp,
      totalShots:
        results.length *
        simShotsPerRatio,
      results,
      minRtp,
      maxRtp,
      averageRtp,
      at33:
        results.find(
          (result) =>
            result.hitRatio === 33
        ),
      at90:
        results.find(
          (result) =>
            result.hitRatio === 90
        ),
      at100:
        results.find(
          (result) =>
            result.hitRatio === 100
        )
    };
  }
}
