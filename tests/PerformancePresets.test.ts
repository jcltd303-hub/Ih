import { describe, it, expect } from 'vitest';
import { resolvePerformanceSettings } from '../src/config/PerformancePresets';

describe('PerformancePresets', () => {
  it('high tier enables post-fx and higher fish cap', () => {
    const s = resolvePerformanceSettings('high');
    expect(s.tier).toBe('high');
    expect(s.postFxEnabled).toBe(true);
    expect(s.particlesEnabled).toBe(true);
    expect(s.maxFish).toBeGreaterThanOrEqual(16);
    expect(s.antialias).toBe(true);
  });

  it('low tier reduces cost for mobile', () => {
    const s = resolvePerformanceSettings('low');
    expect(s.tier).toBe('low');
    expect(s.postFxEnabled).toBe(false);
    expect(s.particlesEnabled).toBe(false);
    expect(s.maxFish).toBeLessThanOrEqual(12);
    expect(s.antialias).toBe(false);
    expect(s.targetFps).toBe(30);
  });

  it('medium is between low and high', () => {
    const low = resolvePerformanceSettings('low');
    const mid = resolvePerformanceSettings('medium');
    const high = resolvePerformanceSettings('high');
    expect(mid.maxFish).toBeGreaterThan(low.maxFish);
    expect(mid.maxFish).toBeLessThanOrEqual(high.maxFish);
  });
});
