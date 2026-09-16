/**
 * Mobile compatibility gate.
 *
 * The previous mobile shim replaced the real animated fish with a crude
 * Graphics ellipse/triangle. That was the source of the garbage fish on
 * Android. Keep the compatibility hook, but use the real sprite pipeline.
 */
export function enableMobilePixiCompatibility(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || !!coarse;

  if (mobile) {
    console.info('[Fish Frenzy] mobile detected: using full animated fish artwork; no fallback fish shim');
  }

  // Deliberately return false so main.ts runs AssetLoader/SpriteSheetManager.
  // Do not install the old Graphics fish override.
  return false;
}
