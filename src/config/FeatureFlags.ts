/** Feature flags from Vite env (string "true"/"1"). */
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
  economySinks: flag('VITE_FF_ECONOMY', true)
} as const;
