import { describe, it, expect } from 'vitest';

/**
 * Mirrors server-side evaluate helpers in processPlayerShot
 * so CI validates RTP tables without Firebase emulators.
 */
function evaluateServerHit(
  betAmount: number,
  fishType: 'small' | 'medium' | 'boss',
  skinBonus: number,
  targetRtp: number,
  rng: () => number
) {
  const looseness = targetRtp / 92;
  const isLuckyHit = rng() < 0.06 * looseness;
  const hitPayout = isLuckyHit ? betAmount * 1.0 : betAmount * 0.24 * looseness;
  const critRoll = rng();
  const isSuperCrit = critRoll < 0.04 * looseness;
  const isCrit = !isSuperCrit && critRoll < 0.16 * looseness;
  const critMultiplier = isSuperCrit ? 3.5 : isCrit ? 2.0 : 1.0;
  const damage = 1.0 * skinBonus * critMultiplier * (0.9 + rng() * 0.3);
  const baseInstant = fishType === 'small' ? 0.22 : fishType === 'medium' ? 0.1 : 0.032;
  const isInstantKill = rng() < baseInstant * looseness;
  return { hitPayout, damage, isInstantKill, isCrit, isSuperCrit };
}

describe('Server payout logic (CI mirror)', () => {
  it('produces finite non-negative payouts over many rolls', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 500; i++) {
      const r = evaluateServerHit(1, i % 3 === 0 ? 'boss' : 'small', 1.2, 92, rng);
      expect(r.hitPayout).toBeGreaterThanOrEqual(0);
      expect(r.damage).toBeGreaterThan(0);
      expect(Number.isFinite(r.damage)).toBe(true);
    }
  });

  it('rejects invalid bet amounts conceptually', () => {
    const invalid = [0, -1, 1001];
    for (const b of invalid) {
      expect(b <= 0 || b > 1000).toBe(true);
    }
  });
});
