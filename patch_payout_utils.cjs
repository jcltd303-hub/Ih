const fs = require('fs');
const path = './src/engine/systems/PayoutEngine.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `public static recordWager(betAmount: number): void {`,
  `public static resetSessionStats(): void {
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
  
  public static recordWager(betAmount: number): void {`
);

fs.writeFileSync(path, code);
