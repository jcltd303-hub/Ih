import { describe, it, expect, beforeEach } from 'vitest';
import { PayoutEngine } from '../src/engine/systems/PayoutEngine';
import { ProvablyFairAuditor } from '../src/utils/ProvablyFairAuditor';

describe('Enhanced Monte Carlo RTP & profitability', () => {
  beforeEach(() => {
    PayoutEngine.resetSessionStats();
    PayoutEngine.resetLedger();
    PayoutEngine.setPayoutPolicy(90, 105);
  });

  it('50k-shot Monte Carlo at 92% target stays near target with positive house edge', () => {
    const result = PayoutEngine.runMonteCarlo(50_000, 90, { batches: 25, seed: 7 });
    expect(result.shots).toBe(50_000);
    expect(result.houseEdgePct).toBeGreaterThan(0);
    expect(result.realizedRtp).toBeGreaterThan(60);
    expect(result.realizedRtp).toBeLessThan(110);
    expect(result.rtpP5).toBeLessThanOrEqual(result.rtpP95);
    expect(result.minBatchRtp).toBeLessThanOrEqual(result.maxBatchRtp);
    expect(result.hitRate).toBeGreaterThan(0.5);
    expect(result.hitRate).toBeLessThan(0.9);
  });

  it('tighter RTP policy reduces simulated returns', () => {
    const tight = PayoutEngine.runMonteCarlo(30_000, 70, { batches: 15, seed: 3 });
    const loose = PayoutEngine.runMonteCarlo(30_000, 110, { batches: 15, seed: 3 });
    expect(tight.realizedRtp).toBeLessThan(loose.realizedRtp);
    expect(tight.houseEdgePct).toBeGreaterThan(loose.houseEdgePct);
  });

  it('legacy auditor still converges in a broad band', () => {
    const iterations = 50_000;
    let totalBet = 0;
    let totalPayout = 0;
    const serverSeed = 'audit_master_seed_2026';
    const clientSeed = 'player_client_seed_777';

    for (let i = 0; i < iterations; i++) {
      const bet = 1.0;
      totalBet += bet;
      const outcome = ProvablyFairAuditor.verifyOutcome(serverSeed, clientSeed, i);
      let hitPayout = 0;
      if (outcome < 40.0) hitPayout = bet * 0.38;
      totalPayout += hitPayout;
      let killMultiplier = 0;
      if (outcome > 99.7) killMultiplier = 12.0;
      else if (outcome > 88.0) killMultiplier = 2.2;
      else if (outcome > 50.0) killMultiplier = 0.6;
      totalPayout += bet * killMultiplier;
    }

    const rtp = (totalPayout / totalBet) * 100;
    expect(rtp).toBeGreaterThan(40);
    expect(rtp).toBeLessThan(120);
  });
});

describe('Deposit vs payout profitability ledger', () => {
  beforeEach(() => {
    PayoutEngine.resetSessionStats();
    PayoutEngine.resetLedger();
    PayoutEngine.setPayoutPolicy(90, 105);
  });

  it('tracks deposits, handle, payouts and cash profit', () => {
    PayoutEngine.recordDeposit(100);
    PayoutEngine.recordWager(10);
    PayoutEngine.recordWager(10);
    PayoutEngine.recordPayout(12);

    const snap = PayoutEngine.getProfitSnapshot();
    expect(snap.ledger.totalDeposits).toBe(100);
    expect(snap.ledger.totalHandle).toBe(20);
    expect(snap.ledger.totalPayouts).toBe(12);
    expect(snap.cashProfit).toBe(88);
    expect(snap.gameHouseEdgePct).toBeCloseTo(40, 5);
    expect(snap.realizedRtpOnHandle).toBeCloseTo(60, 5);
    expect(snap.isProfitable).toBe(true);
  });

  it('setPayoutPolicy clamps and stores target RTP + guard', () => {
    PayoutEngine.setPayoutPolicy(200, 200);
    const cfg = PayoutEngine.getConfig();
    expect(cfg.targetRtp).toBeLessThanOrEqual(120);
    expect(cfg.maxLifetimeRtpGuard).toBeLessThanOrEqual(150);
    PayoutEngine.setPayoutPolicy(90, 105);
    expect(PayoutEngine.getTargetRtp()).toBe(90);
  });

  it('flags unprofitable when payouts exceed deposits heavily', () => {
    PayoutEngine.recordDeposit(10);
    PayoutEngine.recordWager(50);
    PayoutEngine.recordPayout(80);
    const snap = PayoutEngine.getProfitSnapshot();
    expect(snap.cashProfit).toBeLessThan(0);
    expect(snap.isProfitable).toBe(false);
  });
});
