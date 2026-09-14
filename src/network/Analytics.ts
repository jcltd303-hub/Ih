import { FeatureFlags } from '../config/FeatureFlags';

type Props = Record<string, string | number | boolean | undefined>;

/**
 * Lightweight analytics — console + optional window dataLayer push.
 * Swap sink for GA4/Amplitude later without touching call sites.
 */
export class Analytics {
  private static queue: { event: string; props: Props; t: number }[] = [];

  public static track(event: string, props: Props = {}): void {
    if (!FeatureFlags.analytics) return;
    const entry = { event, props, t: Date.now() };
    this.queue.push(entry);
    if (this.queue.length > 200) this.queue.shift();

    console.info('[analytics]', event, props);

    const w = window as Window & { dataLayer?: unknown[] };
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...props });
    }
  }

  public static getQueue() {
    return [...this.queue];
  }
}
