import { describe, it, expect } from 'vitest';
import { ProvablyFairAuditor } from '../src/utils/ProvablyFairAuditor';

describe('ProvablyFairAuditor', () => {
  it('should generate consistent server seed hashes', async () => {
    const seed = 'test_server_seed_123';
    const hash = await ProvablyFairAuditor.generateServerSeedHash(seed);
    expect(hash).toBeTypeOf('string');
    expect(hash.length).toBe(64); // SHA-256 hex length
  });

  it('should calculate reproducible outcome floats', () => {
    const outcome1 = ProvablyFairAuditor.verifyOutcome('seedA', 'clientB', 1);
    const outcome2 = ProvablyFairAuditor.verifyOutcome('seedA', 'clientB', 1);
    expect(outcome1).toBe(outcome2);
    expect(outcome1).toBeGreaterThanOrEqual(0);
    expect(outcome1).toBeLessThanOrEqual(100);
  });
});
