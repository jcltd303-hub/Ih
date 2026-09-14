export interface PlayerLoadout {
  activeCannonSkin: string;
  unlockedSkins: string[];
}

/** SC cost to unlock chassis (default + plasma free). */
export const SKIN_PRICES: Record<string, number> = {
  default: 0,
  plasma_neon: 0,
  cyber_gold: 25,
  abyssal_dread: 40
};

export class LoadoutManager {
  private static STORAGE_KEY = 'fish_frenzy_loadout';

  public static getLoadout(): PlayerLoadout {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return { activeCannonSkin: 'plasma_neon', unlockedSkins: ['default', 'plasma_neon'] };
      }
      const parsed = JSON.parse(raw) as PlayerLoadout;
      if (!parsed.unlockedSkins?.includes('default')) parsed.unlockedSkins.push('default');
      if (!parsed.unlockedSkins?.includes('plasma_neon')) parsed.unlockedSkins.push('plasma_neon');
      return parsed;
    } catch {
      return { activeCannonSkin: 'plasma_neon', unlockedSkins: ['default', 'plasma_neon'] };
    }
  }

  public static saveLoadout(loadout: PlayerLoadout): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(loadout));
    } catch (e) {
      console.error('[LoadoutManager] Failed to save loadout:', e);
    }
  }

  public static isUnlocked(skinId: string): boolean {
    return this.getLoadout().unlockedSkins.includes(skinId);
  }

  /**
   * Unlock a skin by spending SC from the provided balance.
   * Returns new balance or null if insufficient / already owned.
   */
  public static unlockSkin(skinId: string, scBalance: number): { ok: boolean; newSc: number; reason?: string } {
    const price = SKIN_PRICES[skinId] ?? 0;
    const loadout = this.getLoadout();
    if (loadout.unlockedSkins.includes(skinId)) {
      return { ok: true, newSc: scBalance, reason: 'already_unlocked' };
    }
    if (scBalance < price) {
      return { ok: false, newSc: scBalance, reason: 'insufficient_funds' };
    }
    loadout.unlockedSkins.push(skinId);
    this.saveLoadout(loadout);
    return { ok: true, newSc: scBalance - price };
  }

  public static getActiveSkin(type: string = 'tracer_fx'): string {
    const loadout = this.getLoadout();
    return `${loadout.activeCannonSkin}_${type}`;
  }
}
