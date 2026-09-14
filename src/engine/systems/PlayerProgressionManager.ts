import { TurretSkinId } from '../../audio/SoundManager';
import { SoundManager } from '../../audio/SoundManager';

export interface LevelMilestone {
  level: number;
  xpRequired: number;
  title: string;
  turretSkin: TurretSkinId;
  turretName: string;
  perks: string;
}

export const LEVEL_MILESTONES: LevelMilestone[] = [
  {
    level: 1,
    xpRequired: 0,
    title: 'Novice Gunner',
    turretSkin: 'default',
    turretName: 'Standard Kinetic Cannon',
    perks: 'Balanced single-target trajectory',
  },
  {
    level: 2,
    xpRequired: 200,
    title: 'Trench Gunner',
    turretSkin: 'default',
    turretName: 'Reinforced Kinetic Cannon',
    perks: '+10% Projectile velocity',
  },
  {
    level: 3,
    xpRequired: 600,
    title: 'Plasma Specialist',
    turretSkin: 'plasma_neon',
    turretName: 'Dual Neon-Ion Plasma Blaster',
    perks: 'Rapid-fire energy streams · Low recoil',
  },
  {
    level: 4,
    xpRequired: 1400,
    title: 'Abyssal Hunter',
    turretSkin: 'plasma_neon',
    turretName: 'Supercharged Ion Repeater',
    perks: '+15% Plasma bolt speed · High critical rate',
  },
  {
    level: 5,
    xpRequired: 2800,
    title: 'Dreadnought Commander',
    turretSkin: 'abyssal_dread',
    turretName: 'Abyssal Dreadnought Artillery',
    perks: 'Heavy armor-piercing artillery · High damage',
  },
  {
    level: 6,
    xpRequired: 5000,
    title: 'Trench Apex',
    turretSkin: 'abyssal_dread',
    turretName: 'Overclocked Abyssal Dreadnought',
    perks: 'Extended blast radius · +20% Boss damage',
  },
  {
    level: 7,
    xpRequired: 8000,
    title: 'Sovereign Legend',
    turretSkin: 'cyber_gold',
    turretName: 'Cyber Gold Sovereign Supreme',
    perks: 'Max-tier gold luxury chassis · 1.5x Multiplier blast',
  },
];

export interface PlayerProgressionState {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
  title: string;
  baseTurretSkin: TurretSkinId;
  effectiveTurretSkin: TurretSkinId;
  turretName: string;
  isOvercharged: boolean;
  overchargeRemainingSec: number;
  isBossUpgradeActive: boolean;
}

type ProgressionListener = (state: PlayerProgressionState) => void;
type LevelUpListener = (newLevel: number, milestone: LevelMilestone) => void;
type OverchargeListener = (active: boolean, remainingSec: number) => void;

export class PlayerProgressionManager {
  private static instance: PlayerProgressionManager | null = null;
  private static readonly STORAGE_KEY = 'fish_frenzy_player_xp';

  private xp: number = 0;
  private overchargeEndTime: number = 0;
  private overchargeTimerId: number | null = null;
  private bossRaidActive: boolean = false;

  private listeners: ProgressionListener[] = [];
  private levelUpListeners: LevelUpListener[] = [];
  private overchargeListeners: OverchargeListener[] = [];

  private constructor() {
    this.loadXp();
  }

  public static getInstance(): PlayerProgressionManager {
    if (!PlayerProgressionManager.instance) {
      PlayerProgressionManager.instance = new PlayerProgressionManager();
    }
    return PlayerProgressionManager.instance;
  }

  private loadXp(): void {
    try {
      const saved = localStorage.getItem(PlayerProgressionManager.STORAGE_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 0) {
          this.xp = val;
        }
      }
    } catch {
      this.xp = 0;
    }
  }

  private saveXp(): void {
    try {
      localStorage.setItem(PlayerProgressionManager.STORAGE_KEY, this.xp.toString());
    } catch {
      /* ignore */
    }
  }

  public getMilestoneForLevel(level: number): LevelMilestone {
    for (let i = LEVEL_MILESTONES.length - 1; i >= 0; i--) {
      if (level >= LEVEL_MILESTONES[i].level) {
        return LEVEL_MILESTONES[i];
      }
    }
    return LEVEL_MILESTONES[0];
  }

  public getMilestoneForXp(xp: number): { current: LevelMilestone; next: LevelMilestone | null } {
    let current = LEVEL_MILESTONES[0];
    let next: LevelMilestone | null = LEVEL_MILESTONES[1] ?? null;

    for (let i = 0; i < LEVEL_MILESTONES.length; i++) {
      if (xp >= LEVEL_MILESTONES[i].xpRequired) {
        current = LEVEL_MILESTONES[i];
        next = LEVEL_MILESTONES[i + 1] ?? null;
      } else {
        break;
      }
    }
    return { current, next };
  }

  public getState(): PlayerProgressionState {
    const { current, next } = this.getMilestoneForXp(this.xp);
    const now = Date.now();
    const isOvercharged = this.overchargeEndTime > now;
    const overchargeRemainingSec = isOvercharged
      ? Math.max(0, Math.ceil((this.overchargeEndTime - now) / 1000))
      : 0;

    let effectiveTurretSkin: TurretSkinId = current.turretSkin;
    let turretName = current.turretName;

    // Temporary upgrades take priority:
    if (isOvercharged) {
      effectiveTurretSkin = 'cyber_gold';
      turretName = '⚡ HYPER OVERCHARGE CANNON';
    } else if (this.bossRaidActive) {
      // During boss raid: automatic temp boost to at least abyssal dread or cyber gold
      if (current.level >= 5) {
        effectiveTurretSkin = 'cyber_gold';
        turretName = '🔥 LEVIATHAN APEX SLAYER';
      } else {
        effectiveTurretSkin = 'abyssal_dread';
        turretName = '⚡ ABYSSAL RAID ARTILLERY';
      }
    }

    const currentBaseXp = current.xpRequired;
    const nextBaseXp = next ? next.xpRequired : current.xpRequired + 3000;
    const progressPct = next
      ? Math.min(100, Math.max(0, Math.round(((this.xp - currentBaseXp) / (nextBaseXp - currentBaseXp)) * 100)))
      : 100;

    return {
      level: current.level,
      xp: this.xp,
      currentLevelXp: this.xp - currentBaseXp,
      nextLevelXp: nextBaseXp - currentBaseXp,
      progressPct,
      title: current.title,
      baseTurretSkin: current.turretSkin,
      effectiveTurretSkin,
      turretName,
      isOvercharged,
      overchargeRemainingSec,
      isBossUpgradeActive: this.bossRaidActive,
    };
  }

  public addXp(amount: number): void {
    if (amount <= 0) return;
    const prevLevel = this.getMilestoneForXp(this.xp).current.level;
    this.xp += amount;
    this.saveXp();

    const currentMilestone = this.getMilestoneForXp(this.xp).current;
    if (currentMilestone.level > prevLevel) {
      SoundManager.playUiSound('jackpot_fanfare');
      this.levelUpListeners.forEach((l) => l(currentMilestone.level, currentMilestone));
    }

    this.emit();
  }

  /**
   * Lucky shot / kill triggers a temporary supercharged turret upgrade for several seconds.
   */
  public triggerLuckyOvercharge(durationSec: number = 7): void {
    const now = Date.now();
    this.overchargeEndTime = Math.max(this.overchargeEndTime, now + durationSec * 1000);
    SoundManager.playUiSound('powerup');

    if (this.overchargeTimerId !== null) {
      clearInterval(this.overchargeTimerId);
    }

    this.overchargeTimerId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((this.overchargeEndTime - Date.now()) / 1000));
      this.overchargeListeners.forEach((l) => l(remaining > 0, remaining));
      this.emit();
      if (remaining <= 0) {
        if (this.overchargeTimerId !== null) {
          clearInterval(this.overchargeTimerId);
          this.overchargeTimerId = null;
        }
      }
    }, 500);

    this.emit();
  }

  public setBossRaidActive(active: boolean): void {
    if (this.bossRaidActive !== active) {
      this.bossRaidActive = active;
      this.emit();
    }
  }

  public subscribe(listener: ProgressionListener): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public onLevelUp(listener: LevelUpListener): () => void {
    this.levelUpListeners.push(listener);
    return () => {
      this.levelUpListeners = this.levelUpListeners.filter((l) => l !== listener);
    };
  }

  public onOvercharge(listener: OverchargeListener): () => void {
    this.overchargeListeners.push(listener);
    return () => {
      this.overchargeListeners = this.overchargeListeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
