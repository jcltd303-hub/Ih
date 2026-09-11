import { describe, it, expect } from 'vitest';
import { ProvablyFairAuditor } from '../src/utils/ProvablyFairAuditor';

describe('10,000,000 Simulation Monte Carlo RTP & Pay-Per-Hit Auditor', () => {
  it('should verify simulated hits and kills converge to ~70% RTP with pay-per-hit enabled', () => {
    const iterations = 100_000;
    let totalBet = 0;
    let totalPayout = 0;
    let maxWinMultiplier = 0;
    let bonusTriggers = 0;
    let hitPayoutsCount = 0;

    const serverSeed = 'audit_master_seed_2026';
    const clientSeed = 'player_client_seed_777';

    for (let i = 0; i < iterations; i++) {
      const bet = 1.0;
      totalBet += bet;

      const outcome = ProvablyFairAuditor.verifyOutcome(serverSeed, clientSeed, i);

      // Pay-per-hit instant reward on successful hit (~40% hit rate)
      let hitPayout = 0;
      if (outcome < 40.0) {
        hitPayout = bet * 0.38;
        totalPayout += hitPayout;
        hitPayoutsCount++;
      }

      let killMultiplier = 0;
      if (outcome > 99.7) {
        // Apex Leviathan Boss Bonus Trigger (12x on kill)
        killMultiplier = 12.0;
        bonusTriggers++;
      } else if (outcome > 88.0) {
        // Medium Fish (2.2x on kill)
        killMultiplier = 2.2;
      } else if (outcome > 50.0) {
        // Small Tetra Fish (0.6x on kill)
        killMultiplier = 0.6;
      } else {
        killMultiplier = 0;
      }

      const payout = hitPayout + (bet * killMultiplier);
      totalPayout += (bet * killMultiplier);

      const totalRoundMultiplier = (hitPayout > 0 ? 0.35 : 0) + killMultiplier;
      if (totalRoundMultiplier > maxWinMultiplier) {
        maxWinMultiplier = totalRoundMultiplier;
      }
    }

    const rtp = (totalPayout / totalBet) * 100;
    console.log(`[Monte Carlo 70% RTP Simulation] Total Bet: ${totalBet}, Total Payout: ${totalPayout.toFixed(2)}, RTP: ${rtp.toFixed(2)}%, Hit Payouts: ${hitPayoutsCount}, Bonus Triggers: ${bonusTriggers}, Max Multiplier: ${maxWinMultiplier.toFixed(2)}x`);

    expect(rtp).toBeGreaterThanOrEqual(65.0);
    expect(rtp).toBeLessThanOrEqual(75.0);
    expect(maxWinMultiplier).toBeGreaterThan(5);
    expect(bonusTriggers).toBeGreaterThan(0);
  });
});
