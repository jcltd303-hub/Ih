export interface PayoutConfig {
  targetRtp: number;
  gambleKillEnabled: boolean;
  gambleBonusMultiplierEnabled: boolean;
  volatility: 'low' | 'medium' | 'high';
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

export interface MonteCarloResult { shots: number; targetRtp: number; totalWagered: number; totalPayout: number; houseEdge: number; realizedRtp: number; }
export interface ProfitSnapshot {
  ledger: ProfitLedger;
  gameHouseEdgePct: number;
  realizedRtpOnHandle: number;
  cashProfit: number;
  cashMarginPct: number;
  isProfitable: boolean;
  guardActive: boolean;
}

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

  public static getSessionStats(): SessionStats {
    this.stats.realizedRtp =
      this.stats.totalWagered > 0
        ? (this.stats.totalPaidOut / this.stats.totalWagered) * 100
        : 0;
    return { ...this.stats };
  }

  public static getProfitSnapshot(): ProfitSnapshot {
    const margin = this.ledger.totalHandle - this.ledger.totalPayouts;
    const rtp = this.ledger.totalHandle > 0 ? (this.ledger.totalPayouts / this.ledger.totalHandle) * 100 : 0;
    const cashMarginPct = this.ledger.totalDeposits > 0 ? (margin / this.ledger.totalDeposits) * 100 : 0;
    const isProfitable = margin > 0;
    const guardActive = rtp > this.config.maxLifetimeRtpGuard;

    return {
      ledger: { ...this.ledger },
      gameHouseEdgePct: 100 - rtp,
      realizedRtpOnHandle: rtp,
      cashProfit: margin,
      cashMarginPct,
      isProfitable,
      guardActive
    };
  }

  public static recordDeposit(amount: number): void {
    if (!(amount > 0)) return;
    this.ledger.totalDeposits += amount;
  }

  public static resetSessionStats(): void {
    this.stats = { totalWagered: 0, totalPaidOut: 0, totalShots: 0, totalHits: 0, totalKills: 0, instantGambleKills: 0, critHits: 0, bonusJackpotTriggers: 0, realizedRtp: 0 };
  }
  public static resetLedger(): void {
    this.ledger = { totalDeposits: 0, totalHandle: 0, totalPayouts: 0, sessionCount: 0, updatedAt: Date.now() };
  }
  public static getConfig(): PayoutConfig { return { ...this.config }; }
  public static saveConfig(cfg: Partial<PayoutConfig>): void { this.config = { ...this.config, ...cfg }; }
  public static setPayoutPolicy(policy: any): void { if (policy.targetRtp) this.config.targetRtp = policy.targetRtp; }
  public static getTargetRtp(): number { return this.config.targetRtp; }
  public static runMonteCarlo(shots: number, bet: number): MonteCarloResult { return { shots, targetRtp: this.config.targetRtp, totalWagered: 0, totalPayout: 0, houseEdge: 0, realizedRtp: 0 }; }
  
  public static recordWager(betAmount: number): void {
    this.stats.totalShots++;
    this.stats.totalWagered += betAmount;
    this.ledger.totalHandle += betAmount;
  }

  public static recordPayout(payoutAmount: number): void {
    if (!(payoutAmount > 0)) return;
    this.stats.totalPaidOut += payoutAmount;
    this.ledger.totalPayouts += payoutAmount;
  }

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

    // 1. HIT PAYOUT: Balanced 44.75% average RTP return directly on hits (0.15 * 1.0 + 0.85 * 0.35 = 0.4475)
    const isLuckyHit = Math.random() < 0.15;
    const hitPayout = isLuckyHit ? betAmount : betAmount * 0.35;

    // 2. BOSS DAMAGE: Mean damage = betAmount (enabling 1:1 wager tracking for boss bounty)
    const critRoll = Math.random();
    const isSuperCrit = critRoll < 0.04;
    const isCrit = !isSuperCrit && critRoll < 0.16;
    
    if (isCrit || isSuperCrit) this.stats.critHits++;

    const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
    const randomJitter = 0.9 + Math.random() * 0.3; // Mean 1.05
    const damage = betAmount * skinBonus * critMultiplier * randomJitter;

    // 3. TRASH FISH INSTANT KILL
    let isInstantKill = false;
    if (fishType !== 'boss') {
       const pKill = fishType === 'small' ? 0.29 : 0.15;
       if (Math.random() < pKill) {
           isInstantKill = true;
           this.stats.instantGambleKills++;
       }
    }

    return { hitPayout, isLuckyHit, damage, isCrit, isSuperCrit, isInstantKill };
  }

  public static evaluateKillMultiplier(
    baseMultiplier: number,
    fishType: 'small' | 'medium' | 'boss'
  ): {
    finalMultiplier: number;
    bonusLabel: string;
    isJackpot: boolean;
  } {
    this.stats.totalKills++;

    let finalMultiplier = fishType === 'small' ? 1.2 : 4.0;
    let bonusLabel = 'STANDARD WIN';
    let isJackpot = false;

    const roll = Math.random();
    
    if (fishType === 'small' || fishType === 'medium') {
       if (roll < 0.03) { finalMultiplier *= 15; bonusLabel = '🔥 15X JACKPOT!'; isJackpot = true; this.stats.bonusJackpotTriggers++; }
       else if (roll < 0.10) { finalMultiplier *= 5; bonusLabel = '🔥 5X MULTIPLIER!'; }
       else if (roll < 0.25) { finalMultiplier *= 2.5; bonusLabel = 'BONUS WIN!'; }
    } else {
       finalMultiplier = 25; // Boss uses Bounty system, not raw multiplier
    }

    return { finalMultiplier, bonusLabel, isJackpot };
  }
}
