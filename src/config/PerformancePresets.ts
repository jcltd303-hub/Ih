/**
 * Mobile / desktop rendering presets for PixiJS + Capacitor.
 */

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface PerformanceSettings {
  tier: PerformanceTier;
  resolution: number;
  antialias: boolean;
  maxFish: number;
  particlesEnabled: boolean;
  postFxEnabled: boolean;
  targetFps: number;
}

function isMobileLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const coarse =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || coarse;
}

function hardwareTier(): PerformanceTier {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (isMobileLike()) {
    if (cores <= 4 || (mem !== undefined && mem <= 4)) return 'low';
    return 'medium';
  }
  if (cores <= 4) return 'medium';
  return 'high';
}

export function resolvePerformanceSettings(force?: PerformanceTier): PerformanceSettings {
  const tier = force || hardwareTier();
  const dpr =
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5) : 1;

  switch (tier) {
    case 'low':
      return {
        tier,
        resolution: Math.min(dpr, 1),
        antialias: false,
        maxFish: 10,
        particlesEnabled: false,
        postFxEnabled: false,
        targetFps: 30
      };
    case 'medium':
      return {
        tier,
        resolution: Math.min(dpr, 1.5),
        antialias: true,
        maxFish: 14,
        particlesEnabled: true,
        postFxEnabled: false,
        targetFps: 60
      };
    default:
      return {
        tier: 'high',
        resolution: dpr,
        antialias: true,
        maxFish: 18,
        particlesEnabled: true,
        postFxEnabled: true,
        targetFps: 60
      };
  }
}

/** Persist optional user override */
const STORAGE_KEY = 'fish_frenzy_perf_tier';

export function loadPreferredTier(): PerformanceTier | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'high' || v === 'medium' || v === 'low') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function savePreferredTier(tier: PerformanceTier): void {
  try {
    localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    /* ignore */
  }
}
