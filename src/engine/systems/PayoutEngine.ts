export type FishTargetType = 'small' | 'medium' | 'boss';

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

export interface HitEvaluation {
  hitPayout: number;
  isLuckyHit: boolean;
  damage: number;
  isCrit: boolean;
  isSuperCrit: boolean;
  isInstantKill: boolean;
}

export interface KillEvaluation {
  finalMultiplier: number;
  bonusLabel: string;
  isJackpot: boolean;
}

export class PayoutEngine {
  private static readonly TARGET_RTP = 85;
  private static readonly MAX_RTP_GUARD = 105;

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

  public static getSessionStats(): SessionStats {
    const rtp = this.stats.totalWagered > 0
      ? (this.stats.totalPaidOut / this.stats.totalWagered) * 100
      : 0;

    return {
      ...this.stats,
      realizedRtp: Number.isFinite(rtp) ? rtp : 0
    };
  }

  public static getProfitSnapshot(): ProfitSnapshot {
    const handle = this.ledger.totalHandle;
    const payouts = this.ledger.totalPayouts;
    const deposits = this.ledger.totalDeposits;

    const margin = handle - payouts;
    const rtp = handle > 0 ? (payouts / handle) * 100 : 0;
    const validRtp = Number.isFinite(rtp) ? rtp : 0;
    const cashMarginPct = deposits > 0 ? (margin / deposits) * 100 : 0;

    return {
      ledger: { ...this.ledger },
      gameHouseEdgePct: 100 - validRtp,
      realizedRtpOnHandle: validRtp,
      cashProfit: margin,
      cashMarginPct: Number.isFinite(cashMarginPct) ? cashMarginPct : 0,
      isProfitable: margin > 0,
      guardActive: validRtp > this.MAX_RTP_GUARD
    };
  }

  public static recordDeposit(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.ledger.totalDeposits += amount;
    this.ledger.updatedAt = Date.now();
  }

  public static recordWager(betAmount: number): void {
    const wager = Number.isFinite(betAmount) ? Math.max(0, betAmount) : 0;
    this.stats.totalShots++;
    this.stats.totalWagered += wager;
    this.ledger.totalHandle += wager;
    this.ledger.updatedAt = Date.now();
  }

  public static recordPayout(payoutAmount: number): void {
    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) return;
    this.stats.totalPaidOut += payoutAmount;
    this.ledger.totalPayouts += payoutAmount;
    this.ledger.updatedAt = Date.now();
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

  public static resetLedger(): void {
    this.ledger = {
      totalDeposits: 0,
      totalHandle: 0,
      totalPayouts: 0,
      sessionCount: 0,
      updatedAt: Date.now()
    };
  }

  public static getTargetRtp(): number {
    return this.TARGET_RTP;
  }

  public static evaluateHit(
    betAmount: number,
    fishType: FishTargetType,
    skinBonus: number = 1.0
  ): HitEvaluation {
    this.stats.totalHits++;

    const safeBet = Number.isFinite(betAmount) ? Math.max(0.01, betAmount) : 1.0;
    const safeBonus = Number.isFinite(skinBonus) ? Math.max(0.5, skinBonus) : 1.0;

    // Bullet impacts deal damage and trigger combat effects, but do NOT award cash upon collision.
    // Cash payouts are strictly earned by capturing/killing fish or completing the boss raid.
    const isLuckyHit = Math.random() < 0.08;
    const hitPayout = 0;

    const critRoll = Math.random();
    const isSuperCrit = critRoll < 0.04;
    const isCrit = !isSuperCrit && critRoll < 0.16;

    if (isCrit || isSuperCrit) {
      this.stats.critHits++;
    }

    const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
    const randomJitter = 0.9 + Math.random() * 0.3;
    const damage = safeBet * safeBonus * critMultiplier * randomJitter;

    let isInstantKill = false;
    if (fishType !== 'boss') {
      // Mathematically calibrated capture chances targeting 84.5% - 85.5% RTP:
      // Small fish: 47% capture chance per bullet (avg ~2.1 bullets to capture).
      // Medium fish: 11.7% capture chance per bullet (avg ~8.5 bullets to capture).
      const pKill = fishType === 'small' ? 0.47 : 0.117;
      if (Math.random() < pKill) {
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
    fishType: FishTargetType
  ): KillEvaluation {
    this.stats.totalKills++;

    if (fishType === 'boss') {
      return {
        finalMultiplier: 15,
        bonusLabel: 'BOSS BOUNTY CLAIMED',
        isJackpot: false
      };
    }

    if (fishType === 'small') {
      // Small fish: Avg multiplier = 1.80x * 47% capture rate = ~84.6% RTP
      const roll = Math.random();
      if (roll < 0.01) {
        this.stats.bonusJackpotTriggers++;
        return {
          finalMultiplier: 15.0,
          bonusLabel: '🔥 15X JACKPOT!',
          isJackpot: true
        };
      }
      if (roll < 0.07) {
        return {
          finalMultiplier: 5.0,
          bonusLabel: '🔥 5X MULTIPLIER!',
          isJackpot: false
        };
      }
      if (roll < 0.25) {
        return {
          finalMultiplier: 2.5,
          bonusLabel: 'BONUS CATCH!',
          isJackpot: false
        };
      }
      return {
        finalMultiplier: 1.2,
        bonusLabel: 'STANDARD CATCH',
        isJackpot: false
      };
    }

    // Medium fish (Mutant): Avg multiplier = 7.25x * 11.7% capture rate = ~84.8% RTP
    const roll = Math.random();
    if (roll < 0.01) {
      this.stats.bonusJackpotTriggers++;
      return {
        finalMultiplier: 50.0,
        bonusLabel: '🔥 50X MUTANT JACKPOT!',
        isJackpot: true
      };
    }
    if (roll < 0.07) {
      return {
        finalMultiplier: 20.0,
        bonusLabel: '🔥 20X SUPER BOUNTY!',
        isJackpot: false
      };
    }
    if (roll < 0.25) {
      return {
        finalMultiplier: 10.0,
        bonusLabel: '10X HIGH BOUNTY!',
        isJackpot: false
      };
    }
    return {
      finalMultiplier: 5.0,
      bonusLabel: 'STANDARD MUTANT',
      isJackpot: false
    };
  }
}
