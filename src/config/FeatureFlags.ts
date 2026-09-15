function flag(name: string, defaultOn = false): boolean {
  const v = import.meta.env[name];
  if (v === undefined || v === '') return defaultOn;
  return v === 'true' || v === '1' || v === 'yes';
}

export const FeatureFlags = {
  multiplayer: flag('VITE_FF_MULTIPLAYER', true),
  googleAuth: flag('VITE_FF_GOOGLE_AUTH', true),
  analytics: flag('VITE_FF_ANALYTICS', true),
  onboarding: flag('VITE_FF_ONBOARDING', true),
  economySinks: flag('VITE_FF_ECONOMY', true),
  /** SC requires configured Firebase — no offline SC spend. */
  realSc: flag('VITE_FF_REAL_SC', false),
  ageGate: flag('VITE_FF_AGE_GATE', true),
  reducedMotion: flag('VITE_FF_REDUCED_MOTION', false),
  /**
   * Shows the "Simulate pay (stub)" button in the Store. confirmDepositStub
   * still enforces its own admin/ALLOW_STUB_PAYMENTS gate server-side even
   * if this is left on — this flag only controls whether the dead-end
   * button is shown to real players. Default OFF.
   */
  stubPayments: flag('VITE_FF_STUB_PAYMENTS', false)
} as const;

export function prefersReducedMotion(): boolean {
  if (FeatureFlags.reducedMotion) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
