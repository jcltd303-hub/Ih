/**
 * PayoutEngine: Central Game Looseness & Gamble Math Engine
 * Controls RTP %, instant gamble-kill probabilities, hit payouts, and bonus multipliers.
 * Directly configurable via the Admin Portal payout % slider.
 */

export interface PayoutConfig {
  targetRtp: number;                 // 50% to 120% (Default: 92%)
  gambleKillEnabled: boolean;        // Whether bullets have RNG instant-kill chance
  gambleBonusMultiplierEnabled: boolean; // Random 1.5x - 10x jackpot multipliers on kill
  volatility: 'low' | 'medium' | 'high';
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

const STORAGE_KEY = 'fish_frenzy_admin_payout_config';

export class PayoutEngine {
  private static config: PayoutConfig = PayoutEngine.loadConfig();

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

  private static listeners: Array<(config: PayoutConfig) => void> = [];

  private static loadConfig(): PayoutConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          targetRtp: typeof parsed.targetRtp === 'number' ? parsed.targetRtp : 92,
          gambleKillEnabled: parsed.gambleKillEnabled !== false,
          gambleBonusMultiplierEnabled: parsed.gambleBonusMultiplierEnabled !== false,
          volatility: parsed.volatility || 'medium'
        };
      }
    } catch {
      // Fallback to default
    }
    return {
      targetRtp: 92, // 92% standard casino looseness
      gambleKillEnabled: true,
      gambleBonusMultiplierEnabled: true,
      volatility: 'medium'
    };
  }

  public static saveConfig(newConfig: Partial<PayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Clamp RTP to 50% - 120%
    this.config.targetRtp = Math.max(50, Math.min(120, this.config.targetRtp));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save PayoutConfig to localStorage', e);
    }
    this.listeners.forEach(fn => fn(this.config));
  }

  public static onConfigChange(callback: (config: PayoutConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public static getConfig(): PayoutConfig {
    return { ...this.config };
  }

  public static getTargetRtp(): number {
    return this.config.targetRtp;
  }

  public static setTargetRtp(rtp: number): void {
    this.saveConfig({ targetRtp: rtp });
  }

  public static getSessionStats(): SessionStats {
    const rtp = this.stats.totalWagered > 0
      ? (this.stats.totalPaidOut / this.stats.totalWagered) * 100
      : 0;
    return {
      ...this.stats,
      realizedRtp: rtp
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

  public static recordWager(betAmount: number): void {
    this.stats.totalShots++;
    this.stats.totalWagered += betAmount;
  }

  public static recordPayout(payoutAmount: number): void {
    this.stats.totalPaidOut += payoutAmount;
  }

  /**
   * Evaluates a bullet impact on a target fish.
   * Calculates dynamic pay-per-hit, damage variance, critical hits,
   * and provably-fair instant gamble-kill rolls based on current game Looseness.
   */
  public static evaluateHit(
    betAmount: number,
    fishType: 'small' | 'medium' | 'boss',
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
    const loosenessFactor = this.config.targetRtp / 92; // 1.0 at standard 92%

    // 1. Pay-per-hit reward (scales dynamically with looseness)
    // Base ~24% return per hit, plus chance of a lucky coin burst (refund)
    const baseHitRate = 0.24 * loosenessFactor;
    const isLuckyHit = Math.random() < (0.06 * loosenessFactor); // 6% chance for lucky hit refund
    const hitPayout = isLuckyHit ? betAmount * 1.0 : betAmount * baseHitRate;

    // 2. Critical hit damage roll (gamble variance)
    const critRoll = Math.random();
    const isSuperCrit = critRoll < (0.04 * loosenessFactor);
    const isCrit = !isSuperCrit && critRoll < (0.16 * loosenessFactor);

    if (isCrit || isSuperCrit) {
      this.stats.critHits++;
    }

    const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
    // Slight random damage variation (+/- 20%) to prevent deterministic grinding
    const randomJitter = 0.9 + Math.random() * 0.3;
    const damage = 1.0 * skinBonus * critMultiplier * randomJitter;

    // 3. Instant Gamble Kill / Instant Capture Roll
    // Allows any shot to randomly trigger an exhilarating kill on the spot!
    let isInstantKill = false;
    if (this.config.gambleKillEnabled) {
      // Base probability of instant kill per landed hit
      // Small: ~22%, Medium: ~10%, Boss: ~3.2%
      const baseInstantProb = fishType === 'small' ? 0.22 : fishType === 'medium' ? 0.10 : 0.032;
      const finalInstantProb = baseInstantProb * loosenessFactor;

      if (Math.random() < finalInstantProb) {
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

  /**
   * Evaluates kill bounty and bonus jackpot multiplier.
   * On kill, fish can award surprise multipliers (1.5x up to 10x!).
   */
  public static evaluateKillMultiplier(
    baseMultiplier: number,
    fishType: 'small' | 'medium' | 'boss'
  ): {
    finalMultiplier: number;
    bonusLabel: string;
    isJackpot: boolean;
  } {
    this.stats.totalKills++;
    const loosenessFactor = this.config.targetRtp / 92;

    if (!this.config.gambleBonusMultiplierEnabled) {
      return {
        finalMultiplier: baseMultiplier,
        bonusLabel: 'STANDARD WIN',
        isJackpot: false
      };
    }

    const roll = Math.random();
    // 2% chance for 10x Mega Surge
    if (roll < 0.02 * loosenessFactor) {
      this.stats.bonusJackpotTriggers++;
      return {
        finalMultiplier: baseMultiplier * 10,
        bonusLabel: '🔥 10X JACKPOT SURGE!',
        isJackpot: true
      };
    }
    // 7% chance for 3x - 5x Big Win
    if (roll < 0.09 * loosenessFactor) {
      this.stats.bonusJackpotTriggers++;
      const bonus = fishType === 'boss' ? 3 : 5;
      return {
        finalMultiplier: baseMultiplier * bonus,
        bonusLabel: `⚡ ${bonus}X MEGA BOUNTY!`,
        isJackpot: true
      };
    }
    // 20% chance for 1.5x - 2x Super Win
    if (roll < 0.28 * loosenessFactor) {
      return {
        finalMultiplier: baseMultiplier * 2,
        bonusLabel: '✨ 2X SUPER WIN!',
        isJackpot: false
      };
    }

    return {
      finalMultiplier: baseMultiplier,
      bonusLabel: 'FISH CAPTURED',
      isJackpot: false
    };
  }

  /**
   * Quick Monte Carlo benchmark for the current looseness setting
   * Simulates N shots and returns estimated RTP and stats.
   */
  public static runQuickSimulation(simShots: number = 10000, targetRtp: number = PayoutEngine.config.targetRtp): {
    shots: number;
    totalWagered: number;
    totalPayout: number;
    realizedRtp: number;
    instantKills: number;
    jackpots: number;
  } {
    const loosenessFactor = targetRtp / 92;
    let totalBet = 0;
    let totalWin = 0;
    let instantKills = 0;
    let jackpots = 0;

    for (let i = 0; i < simShots; i++) {
      const bet = 1.0;
      totalBet += bet;

      // Assume 70% average aim accuracy
      if (Math.random() < 0.70) {
        // Hit
        const isLucky = Math.random() < 0.06 * loosenessFactor;
        const hitWin = isLucky ? bet * 1.0 : bet * (0.24 * loosenessFactor);
        totalWin += hitWin;

        // Pick random fish type
        const fr = Math.random();
        const fType = fr < 0.5 ? 'small' : fr < 0.88 ? 'medium' : 'boss';
        const baseInstantProb = fType === 'small' ? 0.22 : fType === 'medium' ? 0.10 : 0.032;

        if (Math.random() < baseInstantProb * loosenessFactor) {
          instantKills++;
          const baseMult = fType === 'small' ? 1.2 : fType === 'medium' ? 4.0 : 25.0;
          const br = Math.random();
          let mult = baseMult;
          if (br < 0.02 * loosenessFactor) {
            mult *= 10;
            jackpots++;
          } else if (br < 0.09 * loosenessFactor) {
            mult *= 3;
            jackpots++;
          } else if (br < 0.28 * loosenessFactor) {
            mult *= 2;
          }
          totalWin += bet * mult * 0.75;
        }
      }
    }

    return {
      shots: simShots,
      totalWagered: totalBet,
      totalPayout: totalWin,
      realizedRtp: (totalWin / totalBet) * 100,
      instantKills,
      jackpots
    };
  }
}
