export interface PlayerLoadout {
  activeCannonSkin: string;
  unlockedSkins: string[];
}

export class LoadoutManager {
  private static STORAGE_KEY = 'fish_frenzy_loadout';

  public static getLoadout(): PlayerLoadout {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return { activeCannonSkin: 'plasma_neon', unlockedSkins: ['default', 'plasma_neon', 'abyssal_dread', 'cyber_gold'] };
      }
      return JSON.parse(raw);
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

  public static getActiveSkin(type: string = 'tracer_fx'): string {
    const loadout = this.getLoadout();
    return `${loadout.activeCannonSkin}_${type}`;
  }
}
