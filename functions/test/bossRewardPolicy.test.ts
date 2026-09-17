import { describe, expect, it } from 'vitest';
import { getClientAwardableBossBounty } from '../src/bossRewardPolicy';

describe('boss reward authority', () => {
  it('never credits a client-computed boss bounty', () => {
    expect(getClientAwardableBossBounty({ defeated: true, bountyPayout: 999999 })).toBe(0);
  });

  it('never turns a client boss result into wallet currency', () => {
    expect(getClientAwardableBossBounty({ defeated: true, bountyPayout: 1.5, currency: 'SC' })).toBe(0);
  });
});
