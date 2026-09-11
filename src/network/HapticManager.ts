import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export class HapticManager {
  private static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Capacitor' in window;
  }

  public static async triggerShotImpact(betAmount: number): Promise<void> {
    if (!this.isSupported()) return;

    try {
      if (betAmount >= 50) {
        // Heavy high-roller ordnance feedback
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (betAmount >= 10) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else {
        // Crisp standard snap
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch (e) {
      console.warn('[Haptics] Device haptics unavailable.');
    }
  }

  public static async triggerBossWarning(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {
      // Fallback
    }
  }
}
