import { describe, expect, it } from 'vitest';
import { getAuthoritativeTarget, getEntitledSkinBonus } from '../src/authoritativeTargets';

describe('authoritative settlement inputs', () => {
  it('does not let fish type be supplied by the caller', () => {
    const a = getAuthoritativeTarget('server-secret-a', 'fish_1');
    const b = getAuthoritativeTarget('server-secret-a', 'fish_1');
    expect(a).toEqual(b);
    expect(a.targetId).toBe('fish_1');
    expect(['small', 'medium', 'boss']).toContain(a.fishType);
  });

  it('binds target identity to the private server seed', () => {
    const a = getAuthoritativeTarget('a', 'fish_0');
    const b = getAuthoritativeTarget('b', 'fish_0');
    expect(a.fishType).not.toBe(b.fishType);
  });

  it('ignores forged skin bonus and uses bounded entitled loadout value', () => {
    expect(getEntitledSkinBonus(undefined)).toBe(1);
    expect(getEntitledSkinBonus({ skinBonus: 2 })).toBe(2);
    expect(getEntitledSkinBonus({ skinBonus: 999 })).toBe(3);
    expect(getEntitledSkinBonus({ skinBonus: -10 })).toBe(1);
  });
});
