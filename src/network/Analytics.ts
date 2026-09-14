import { FeatureFlags } from '../config/FeatureFlags';
import { analytics } from './FirebaseClient';
import { logEvent } from 'firebase/analytics';

type Props = Record<string, string | number | boolean | undefined>;

/**
 * Lightweight analytics — console + Firebase Analytics (GA4) + optional window dataLayer push.
 */
export class Analytics {
  private static queue: { event: string; props: Props; t: number }[] = [];

  public static track(event: string, props: Props = {}): void {
    if (!FeatureFlags.analytics) return;
    const entry = { event, props, t: Date.now() };
    this.queue.push(entry);
    if (this.queue.length > 200) this.queue.shift();

    console.info('[analytics]', event, props);

    if (analytics) {
      try {
        logEvent(analytics, event, props);
      } catch (e) {
        // Safe fallback if logEvent fails
      }
    }

    const w = window as Window & { dataLayer?: unknown[] };
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...props });
    }
  }

  public static getQueue() {
    return [...this.queue];
  }
}

