import { describe, it, expect, beforeEach } from 'vitest';
import { PayoutEngine } from '../src/engine/systems/PayoutEngine';

describe('PayoutEngine', () => {
  beforeEach(() => {
    PayoutEngine.resetSessionStats();
    PayoutEngine.saveConfig({
      targetRtp: 92,
      gambleKillEnabled: true,
      gambleBonusMultiplierEnabled: true,
      volatility: 'medium'
    });
  });

  it('records wagers and payouts into session stats', () => {
    PayoutEngine.recordWager(1);
    PayoutEngine.recordWager(2);
    PayoutEngine.recordPayout(1.5);
    const stats = PayoutEngine.getSessionStats();
    expect(stats.totalShots).toBe(2);
    expect(stats.totalWagered).toBe(3);
    expect(stats.totalPaidOut).toBe(1.5);
    expect(stats.realizedRtp).toBeCloseTo(50, 5);
  });

  it('evaluateHit returns finite damage and non-negative hitPayout', () => {
    for (let i = 0; i < 50; i++) {
      const hit = PayoutEngine.evaluateHit(1, 'small', 1.0);
      expect(hit.damage).toBeGreaterThan(0);
      expect(Number.isFinite(hit.damage)).toBe(true);
      expect(hit.hitPayout).toBeGreaterThanOrEqual(0);
      expect(typeof hit.isCrit).toBe('boolean');
      expect(typeof hit.isInstantKill).toBe('boolean');
    }
  });

  it('skin bonus increases average damage', () => {
    let base = 0;
    let boosted = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      base += PayoutEngine.evaluateHit(1, 'medium', 1.0).damage;
      boosted += PayoutEngine.evaluateHit(1, 'medium', 1.7).damage;
    }
    expect(boosted / n).toBeGreaterThan(base / n);
  });

  it('evaluateKillMultiplier returns positive final multiplier', () => {
    for (let i = 0; i < 30; i++) {
      const result = PayoutEngine.evaluateKillMultiplier(4, 'medium');
      expect(result.finalMultiplier).toBeGreaterThan(0);
      expect(typeof result.isJackpot).toBe('boolean');
      expect(typeof result.bonusLabel).toBe('string');
    }
  });

  it('clamps target RTP on save', () => {
    PayoutEngine.saveConfig({ targetRtp: 200 });
    expect(PayoutEngine.getTargetRtp()).toBeLessThanOrEqual(120);
    PayoutEngine.saveConfig({ targetRtp: 10 });
    expect(PayoutEngine.getTargetRtp()).toBeGreaterThanOrEqual(50);
  });
});
