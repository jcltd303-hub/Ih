/**
 * Fish Frenzy — Central Decoupled Game Event Bus
 * Connects gameplay systems, UI HUD, audio, and visual effects
 * without tight coupling.
 */

export type GameEventType =
  | 'GAME_START'
  | 'GAME_PAUSE'
  | 'GAME_RESUME'
  | 'FISH_SPAWN'
  | 'FISH_HIT'
  | 'FISH_KILLED'
  | 'CRITICAL_HIT'
  | 'COMBO_UPDATE'
  | 'COMBO_BREAK'
  | 'TURRET_TRIGGER'
  | 'TURRET_UPDATE'
  | 'TURRET_EXPIRE'
  | 'BOSS_TRIGGER'
  | 'BOSS_WARNING'
  | 'BOSS_INTRO'
  | 'BOSS_START'
  | 'BOSS_STATE'
  | 'BOSS_HIT'
  | 'BOSS_DEFEATED'
  | 'BOSS_ESCAPED'
  | 'ROUND_END'
  | 'GAME_OVER'
  | 'PAYOUT'
  | 'THEME_CHANGED'
  | 'SCREEN_SHAKE'
  | 'SCREEN_DIM'
  | 'BOSS_PHASE_CHANGE'
  | 'TURRET_READY'
  | 'AIM_UPDATE'
  | 'SPAWN_CUTOUT_FISH';

export interface FishHitEvent {
  fishId: string;
  fishType: 'small' | 'medium' | 'boss';
  damage: number;
  x: number;
  y: number;
  isCrit: boolean;
  isSuperCrit: boolean;
  isInstantKill: boolean;
  payout: number;
  currency: 'GC' | 'SC';
}

export interface FishKilledEvent {
  fishId: string;
  fishType: 'small' | 'medium' | 'boss';
  name: string;
  x: number;
  y: number;
  payout: number;
  currency: 'GC' | 'SC';
  multiplier: number;
  isJackpot?: boolean;
}

export interface ComboEvent {
  combo: number;
  timerRatio: number; // 1.0 -> 0.0
  damageMultiplier: number;
}

export interface TurretMultiplierEvent {
  active: boolean;
  multiplier: number;
  remainingMs: number;
  totalDurationMs: number;
  state?: 'BONUS' | 'COOLDOWN';
}

export interface ScreenShakeEvent {
  intensity: number;
  durationMs: number;
}

export interface BossStateEvent {
  bossId?: string;
  phase: 'idle' | 'warning' | 'intro' | 'approaching' | 'engaged' | 'enraged' | 'defeated' | 'escaped';
  name: string;
  hp: number;
  maxHp: number;
  hpPercent: number;
  timeRemainingSec: number;
  totalDamage: number;
  multiplier: number;
}

export interface BossResultEvent {
  defeated: boolean;
  totalDamage: number;
  bountyPayout: number;
  currency: 'GC' | 'SC';
  multiplier: number;
  timeElapsedSec: number;
}

export interface GameOverEvent {
  score: number;
  kills: number;
  accuracy: number;
  maxCombo: number;
  payout: number;
}

type EventCallback<T = any> = (data: T) => void;

export class GameEventBus {
  private static instance: GameEventBus | null = null;
  private listeners: Map<GameEventType, Set<EventCallback>> = new Map();

  public static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
    }
    return GameEventBus.instance;
  }

  public on<T = any>(event: GameEventType, cb: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb as EventCallback);
    return () => this.off(event, cb);
  }

  public off<T = any>(event: GameEventType, cb: EventCallback<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(cb as EventCallback);
    }
  }

  public emit<T = any>(event: GameEventType, data?: T): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    set.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[GameEventBus] Error in handler for ${event}:`, err);
      }
    });
  }

  public clear(): void {
    this.listeners.clear();
  }
}
