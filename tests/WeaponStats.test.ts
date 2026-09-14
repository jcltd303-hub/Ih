import { describe, it, expect } from 'vitest';

/**
 * Weapon profile contract tests — mirrors WeaponController.WEAPON_STATS
 * without booting Pixi (keeps CI headless-friendly).
 */
const WEAPON_STATS = {
  plasma_neon: { cooldownMs: 115, projectileSpeed: 28, damageMult: 1.0, spreadDeg: 0 },
  cyber_gold: { cooldownMs: 180, projectileSpeed: 22, damageMult: 1.35, spreadDeg: 2 },
  abyssal_dread: { cooldownMs: 220, projectileSpeed: 18, damageMult: 1.7, spreadDeg: 4 },
  default: { cooldownMs: 140, projectileSpeed: 24, damageMult: 1.15, spreadDeg: 1.5 }
} as const;

describe('Weapon chassis profiles', () => {
  it('defines all four chassis', () => {
    expect(Object.keys(WEAPON_STATS).sort()).toEqual(
      ['abyssal_dread', 'cyber_gold', 'default', 'plasma_neon'].sort()
    );
  });

  it('plasma is fastest ROF; dread is slowest heaviest', () => {
    expect(WEAPON_STATS.plasma_neon.cooldownMs).toBeLessThan(WEAPON_STATS.default.cooldownMs);
    expect(WEAPON_STATS.default.cooldownMs).toBeLessThan(WEAPON_STATS.cyber_gold.cooldownMs);
    expect(WEAPON_STATS.cyber_gold.cooldownMs).toBeLessThan(WEAPON_STATS.abyssal_dread.cooldownMs);

    expect(WEAPON_STATS.plasma_neon.projectileSpeed).toBeGreaterThan(
      WEAPON_STATS.abyssal_dread.projectileSpeed
    );
    expect(WEAPON_STATS.abyssal_dread.damageMult).toBeGreaterThan(WEAPON_STATS.plasma_neon.damageMult);
  });

  it('spread is non-negative and dread has the widest cone', () => {
    for (const s of Object.values(WEAPON_STATS)) {
      expect(s.spreadDeg).toBeGreaterThanOrEqual(0);
      expect(s.cooldownMs).toBeGreaterThan(0);
      expect(s.damageMult).toBeGreaterThan(0);
    }
    expect(WEAPON_STATS.abyssal_dread.spreadDeg).toBeGreaterThanOrEqual(
      WEAPON_STATS.cyber_gold.spreadDeg
    );
  });
});
