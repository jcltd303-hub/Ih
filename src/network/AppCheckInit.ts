import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app, isFirebaseConfigured } from './FirebaseClient';

/** Optional App Check — set VITE_FIREBASE_APPCHECK_SITE_KEY to enable. */
export function initAppCheck(): void {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (!isFirebaseConfigured || !siteKey) return;
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(String(siteKey)),
      isTokenAutoRefreshEnabled: true
    });
    console.info('[AppCheck] initialized');
  } catch (e) {
    console.warn('[AppCheck] init failed', e);
  }
}
