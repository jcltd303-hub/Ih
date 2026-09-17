import { describe, expect, it } from 'vitest';
import { canAcceptShot, canRevealSeed } from '../src/authoritativeTargets';

describe('session lifecycle', () => {
  it('accepts settlement only while a session is active', () => {
    expect(canAcceptShot('active')).toBe(true);
    expect(canAcceptShot('closed')).toBe(false);
    expect(canAcceptShot('revealed')).toBe(false);
  });

  it('requires close before seed reveal and never reopens a revealed session', () => {
    expect(canRevealSeed('active')).toBe(false);
    expect(canRevealSeed('closed')).toBe(true);
    expect(canRevealSeed('revealed')).toBe(true);
  });
});
