/**
 * PayoutEngine: Game looseness, Monte Carlo auditor, and operator P&L ledger.
 * Target RTP is operator-configurable; lifetime deposits vs payouts track house profitability.
 */

export interface PayoutConfig {
  /** Target return-to-player % (50–120). Default 92 → ~8% house edge. */
  targetRtp: number;
  gambleKillEnabled: boolean;
  gambleBonusMultiplierEnabled: boolean;
  volatility: 'low' | 'medium' | 'high';
  /**
   * Soft guard: when lifetime realized RTP exceeds this, client scales hit payouts down
   * (demo safety; production should enforce server-side only).
   */
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

/** Persistent operator ledger (survives reloads). */
export interface ProfitLedger {
  /** Player deposits / bankrolls credited (SC-equivalent). */
  totalDeposits: number;
  /** All wagers taken (handle). */
  totalHandle: number;
  /** All player returns paid. */
  totalPayouts: number;
  /** Net house profit = deposits + handle retained conceptually tracked as deposits - payouts for cash cycle,
   *  and handle - payouts for game margin. */
  sessionCount: number;
  updatedAt: number;
}

export interface ProfitSnapshot {
  ledger: ProfitLedger;
  /** Game margin: (handle - payouts) / handle * 100 when handle > 0 */
  gameHouseEdgePct: number;
  /** Realized RTP on handle */
  realizedRtpOnHandle: number;
  /** Cash-cycle: deposits - payouts (positive = house holds more than paid out) */
  cashProfit: number;
  /** cashProfit / deposits * 100 when deposits > 0 */
  cashMarginPct: number;
  /** True when cashProfit > 0 and realized RTP is under target + 5pp */
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
  /** 5th–95th percentile RTP from batch splits */
  rtpP5: number;
  rtpP95: number;
  minBatchRtp: number;
  maxBatchRtp: number;
  byFish: Record<'small' | 'medium' | 'boss', { kills: number; paid: number }>;
  profitableAtTarget: boolean;
}

const CONFIG_KEY = 'fish_frenzy_admin_payout_config';
const LEDGER_KEY = 'fish_frenzy_profit_ledger';

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

  private static ledger: ProfitLedger = PayoutEngine.loadLedger();
  private static listeners: Array<(config: PayoutConfig) => void> = [];

  private static loadConfig(): PayoutConfig {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        let rtp = typeof parsed.targetRtp === 'number' ? parsed.targetRtp : 90;
        // One-time migrate classic 92% default → 90% house policy
        try {
          if (!localStorage.getItem('fish_frenzy_rtp90_migrated') && rtp === 92) {
            rtp = 90;
            localStorage.setItem('fish_frenzy_rtp90_migrated', '1');
          }
        } catch { /* ignore */ }
        return {
          targetRtp: rtp,
          gambleKillEnabled: parsed.gambleKillEnabled !== false,
          gambleBonusMultiplierEnabled: parsed.gambleBonusMultiplierEnabled !== false,
          volatility: parsed.volatility || 'medium',
          maxLifetimeRtpGuard:
            typeof parsed.maxLifetimeRtpGuard === 'number' ? parsed.maxLifetimeRtpGuard : 105
        };
      }
    } catch {
      /* default */
    }
    return {
      targetRtp: 90,
      gambleKillEnabled: true,
      gambleBonusMultiplierEnabled: true,
      volatility: 'medium',
      maxLifetimeRtpGuard: 105
    };
  }

  private static loadLedger(): ProfitLedger {
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          totalDeposits: Number(p.totalDeposits) || 0,
          totalHandle: Number(p.totalHandle) || 0,
          totalPayouts: Number(p.totalPayouts) || 0,
          sessionCount: Number(p.sessionCount) || 0,
          updatedAt: Number(p.updatedAt) || Date.now()
        };
      }
    } catch {
      /* default */
    }
    return {
      totalDeposits: 0,
      totalHandle: 0,
      totalPayouts: 0,
      sessionCount: 0,
      updatedAt: Date.now()
    };
  }

  private static persistLedger(): void {
    this.ledger.updatedAt = Date.now();
    try {
      localStorage.setItem(LEDGER_KEY, JSON.stringify(this.ledger));
    } catch (e) {
      console.warn('[PayoutEngine] ledger persist failed', e);
    }
  }

  public static saveConfig(newConfig: Partial<PayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.config.targetRtp = Math.max(50, Math.min(120, this.config.targetRtp));
    this.config.maxLifetimeRtpGuard = Math.max(
      80,
      Math.min(150, this.config.maxLifetimeRtpGuard ?? 105)
    );
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save PayoutConfig', e);
    }
    this.listeners.forEach((fn) => fn(this.config));
  }

  public static onConfigChange(callback: (config: PayoutConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
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

  /** Explicit operator control: set target RTP and optional lifetime guard. */
  public static setPayoutPolicy(targetRtp: number, maxLifetimeRtpGuard?: number): void {
    this.saveConfig({
      targetRtp,
      ...(maxLifetimeRtpGuard !== undefined ? { maxLifetimeRtpGuard } : {})
    });
  }

  public static getSessionStats(): SessionStats {
    const rtp =
      this.stats.totalWagered > 0
        ? (this.stats.totalPaidOut / this.stats.totalWagered) * 100
        : 0;
    return { ...this.stats, realizedRtp: rtp };
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
    const { totalDeposits, totalHandle, totalPayouts } = this.ledger;
    const realizedRtpOnHandle = totalHandle > 0 ? (totalPayouts / totalHandle) * 100 : 0;
    const gameHouseEdgePct = totalHandle > 0 ? ((totalHandle - totalPayouts) / totalHandle) * 100 : 0;
    const cashProfit = totalDeposits - totalPayouts;
    const cashMarginPct = totalDeposits > 0 ? (cashProfit / totalDeposits) * 100 : 0;
    const guardActive =
      totalHandle > 100 && realizedRtpOnHandle > this.config.maxLifetimeRtpGuard;
    const isProfitable =
      (totalDeposits <= 0 ? gameHouseEdgePct > 0 : cashProfit > 0) &&
      (totalHandle <= 0 || realizedRtpOnHandle <= this.config.targetRtp + 8);

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

  /** Record a player deposit / bankroll credit (SC). */
  public static recordDeposit(amount: number): void {
    if (!(amount > 0)) return;
    this.ledger.totalDeposits += amount;
    this.persistLedger();
  }

  public static recordWager(betAmount: number): void {
    this.stats.totalShots++;
    this.stats.totalWagered += betAmount;
    this.ledger.totalHandle += betAmount;
    this.persistLedger();
  }

  public static recordPayout(payoutAmount: number): void {
    if (!(payoutAmount > 0)) return;
    this.stats.totalPaidOut += payoutAmount;
    this.ledger.totalPayouts += payoutAmount;
    this.persistLedger();
  }

  public static resetLedger(): void {
    this.ledger = {
      totalDeposits: 0,
      totalHandle: 0,
      totalPayouts: 0,
      sessionCount: this.ledger.sessionCount + 1,
      updatedAt: Date.now()
    };
    this.persistLedger();
  }

  /** Scale factor applied when lifetime RTP blows past the operator guard. */
  private static profitabilityScale(): number {
    const snap = this.getProfitSnapshot();
    if (!snap.guardActive) return 1;
    // Soft dampen returns toward target
    return Math.max(0.55, this.config.targetRtp / Math.max(snap.realizedRtpOnHandle, 1));
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
    const loosenessFactor = this.config.targetRtp / 90;
    const scale = this.profitabilityScale();

    const baseHitRate = 0.24 * loosenessFactor;
    const isLuckyHit = Math.random() < 0.06 * loosenessFactor;
    let hitPayout = (isLuckyHit ? betAmount * 1.0 : betAmount * baseHitRate) * scale;

    const critRoll = Math.random();
    const isSuperCrit = critRoll < 0.04 * loosenessFactor;
    const isCrit = !isSuperCrit && critRoll < 0.16 * loosenessFactor;
    if (isCrit || isSuperCrit) this.stats.critHits++;

    const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
    const randomJitter = 0.9 + Math.random() * 0.3;
    const damage = 1.0 * skinBonus * critMultiplier * randomJitter;

    let isInstantKill = false;
    if (this.config.gambleKillEnabled) {
      const baseInstantProb = fishType === 'small' ? 0.22 : fishType === 'medium' ? 0.1 : 0.032;
      if (Math.random() < baseInstantProb * loosenessFactor * scale) {
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
    fishType: 'small' | 'medium' | 'boss'
  ): {
    finalMultiplier: number;
    bonusLabel: string;
    isJackpot: boolean;
  } {
    this.stats.totalKills++;
    const loosenessFactor = this.config.targetRtp / 90;
    const scale = this.profitabilityScale();

    if (!this.config.gambleBonusMultiplierEnabled) {
      return {
        finalMultiplier: baseMultiplier * scale,
        bonusLabel: 'STANDARD WIN',
        isJackpot: false
      };
    }

    const roll = Math.random();
    if (roll < 0.02 * loosenessFactor * scale) {
      this.stats.bonusJackpotTriggers++;
      return {
        finalMultiplier: baseMultiplier * 10 * scale,
        bonusLabel: '🔥 10X JACKPOT SURGE!',
        isJackpot: true
      };
    }
    if (roll < 0.09 * loosenessFactor * scale) {
      this.stats.bonusJackpotTriggers++;
      const bonus = fishType === 'boss' ? 3 : 5;
      return {
        finalMultiplier: baseMultiplier * bonus * scale,
        bonusLabel: `⚡ ${bonus}X MEGA BOUNTY!`,
        isJackpot: true
      };
    }
    if (roll < 0.28 * loosenessFactor * scale) {
      return {
        finalMultiplier: baseMultiplier * 2 * scale,
        bonusLabel: '✨ 2X SUPER WIN!',
        isJackpot: false
      };
    }

    return {
      finalMultiplier: baseMultiplier * scale,
      bonusLabel: 'FISH CAPTURED',
      isJackpot: false
    };
  }

  /**
   * Enhanced Monte Carlo: batch RTP bands, per-fish breakdown, house edge, profitability vs target.
   */
  public static runMonteCarlo(
    simShots: number = 50_000,
    targetRtp: number = PayoutEngine.config.targetRtp,
    options?: { aimAccuracy?: number; batches?: number; seed?: number }
  ): MonteCarloResult {
    const aimAccuracy = options?.aimAccuracy ?? 0.7;
    const batches = Math.max(5, options?.batches ?? 20);
    const shotsPerBatch = Math.max(1, Math.floor(simShots / batches));
    const loosenessFactor = targetRtp / 90;

    let seed = options?.seed ?? 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    let totalBet = 0;
    let totalWin = 0;
    let instantKills = 0;
    let jackpots = 0;
    let hits = 0;
    const byFish: MonteCarloResult['byFish'] = {
      small: { kills: 0, paid: 0 },
      medium: { kills: 0, paid: 0 },
      boss: { kills: 0, paid: 0 }
    };
    const batchRtps: number[] = [];

    for (let b = 0; b < batches; b++) {
      let bBet = 0;
      let bWin = 0;
      const n = b === batches - 1 ? simShots - shotsPerBatch * (batches - 1) : shotsPerBatch;
      for (let i = 0; i < n; i++) {
        const bet = 1.0;
        bBet += bet;
        totalBet += bet;

        if (rng() >= aimAccuracy) continue;
        hits++;

        const isLucky = rng() < 0.06 * loosenessFactor;
        const hitWin = isLucky ? bet * 1.0 : bet * (0.24 * loosenessFactor);
        bWin += hitWin;
        totalWin += hitWin;

        const fr = rng();
        const fType: 'small' | 'medium' | 'boss' =
          fr < 0.55 ? 'small' : fr < 0.9 ? 'medium' : 'boss';
        const baseInstant = fType === 'small' ? 0.22 : fType === 'medium' ? 0.1 : 0.032;

        if (rng() < baseInstant * loosenessFactor) {
          instantKills++;
          byFish[fType].kills++;
          const baseMult = fType === 'small' ? 1.2 : fType === 'medium' ? 4.0 : 25.0;
          const br = rng();
          let mult = baseMult;
          if (br < 0.02 * loosenessFactor) {
            mult *= 10;
            jackpots++;
          } else if (br < 0.09 * loosenessFactor) {
            mult *= fType === 'boss' ? 3 : 5;
            jackpots++;
          } else if (br < 0.28 * loosenessFactor) {
            mult *= 2;
          }
          const killPay = bet * mult * 0.7;
          bWin += killPay;
          totalWin += killPay;
          byFish[fType].paid += killPay;
        }
      }
      batchRtps.push(bBet > 0 ? (bWin / bBet) * 100 : 0);
    }

    batchRtps.sort((a, b) => a - b);
    const pct = (p: number) => {
      const idx = Math.min(batchRtps.length - 1, Math.max(0, Math.floor((p / 100) * batchRtps.length)));
      return batchRtps[idx];
    };

    const realizedRtp = totalBet > 0 ? (totalWin / totalBet) * 100 : 0;
    const houseEdgePct = 100 - realizedRtp;

    return {
      shots: simShots,
      targetRtp,
      totalWagered: totalBet,
      totalPayout: totalWin,
      realizedRtp,
      houseEdgePct,
      instantKills,
      jackpots,
      hitRate: simShots > 0 ? hits / simShots : 0,
      rtpP5: pct(5),
      rtpP95: pct(95),
      minBatchRtp: batchRtps[0] ?? 0,
      maxBatchRtp: batchRtps[batchRtps.length - 1] ?? 0,
      byFish,
      profitableAtTarget: realizedRtp <= targetRtp + 3 && houseEdgePct > 0
    };
  }

  /** Back-compat alias used by admin portal. */
  public static runQuickSimulation(
    simShots: number = 10000,
    targetRtp: number = PayoutEngine.config.targetRtp
  ): MonteCarloResult {
    return this.runMonteCarlo(simShots, targetRtp, { batches: 10 });
  }
}
