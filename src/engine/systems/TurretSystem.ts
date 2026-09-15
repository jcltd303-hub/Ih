import { GameEventBus } from '../core/GameEvents';
import { SoundManager } from '../../audio/SoundManager';
import { GameConfig } from '../../config/GameConfig';

export type TurretBonusState = 'NORMAL' | 'BONUS' | 'COOLDOWN';

export class TurretSystem {
  private static instance: TurretSystem | null = null;
  private config = GameConfig.turretPacing;
  private state: TurretBonusState = 'NORMAL';
  private killsSinceLastBonus = 0;
  private remainingDurationMs = 0;
  private totalDurationMs = 3000;
  private remainingCooldownMs = 0;
  private hudEmitAccumulatorMs = 0;

  public static getInstance(): TurretSystem {
    if (!TurretSystem.instance) TurretSystem.instance = new TurretSystem();
    return TurretSystem.instance;
  }

  public onFishKilled(): boolean {
    this.killsSinceLastBonus++;
    if (this.state !== 'NORMAL') return false;
    if (this.killsSinceLastBonus < this.config.minKillsBetweenTriggers) return false;
    if (Math.random() < this.config.baseChance) {
      this.activateBonus();
      return true;
    }
    return false;
  }

  public forceTrigger(): void { this.activateBonus(); }

  public activateBonus(durationOverrideMs?: number): void {
    this.state = 'BONUS';
    this.totalDurationMs = Math.min(this.config.maxDurationMs, durationOverrideMs || this.config.durationMs);
    this.remainingDurationMs = this.totalDurationMs;
    this.remainingCooldownMs = 0;
    this.killsSinceLastBonus = 0;
    this.hudEmitAccumulatorMs = 0;
    SoundManager.playUiSound('powerup');
    GameEventBus.getInstance().emit('TURRET_TRIGGER', {
      active: true, multiplier: this.config.multiplier,
      remainingMs: this.remainingDurationMs, totalDurationMs: this.totalDurationMs, state: 'BONUS'
    });
  }

  public update(deltaMs: number): void {
    const dt = Math.max(0, Math.min(250, Number.isFinite(deltaMs) ? deltaMs : 0));
    this.hudEmitAccumulatorMs += dt;

    if (this.state === 'BONUS') {
      this.remainingDurationMs = Math.max(0, this.remainingDurationMs - dt);
      if (this.remainingDurationMs <= 0) {
        this.state = 'COOLDOWN';
        this.remainingCooldownMs = this.config.cooldownMs;
        this.hudEmitAccumulatorMs = 0;
        GameEventBus.getInstance().emit('TURRET_EXPIRE', {
          active: false, multiplier: 1, remainingMs: 0, totalDurationMs: this.totalDurationMs, state: 'BONUS'
        });
      } else if (this.hudEmitAccumulatorMs >= 100) {
        this.hudEmitAccumulatorMs = 0;
        GameEventBus.getInstance().emit('TURRET_UPDATE', {
          active: true, multiplier: this.config.multiplier,
          remainingMs: this.remainingDurationMs, totalDurationMs: this.totalDurationMs, state: 'BONUS'
        });
      }
    } else if (this.state === 'COOLDOWN') {
      this.remainingCooldownMs = Math.max(0, this.remainingCooldownMs - dt);
      if (this.remainingCooldownMs <= 0) {
        this.state = 'NORMAL';
        this.hudEmitAccumulatorMs = 0;
        GameEventBus.getInstance().emit('TURRET_READY');
      } else if (this.hudEmitAccumulatorMs >= 150) {
        this.hudEmitAccumulatorMs = 0;
        GameEventBus.getInstance().emit('TURRET_UPDATE', {
          active: false, multiplier: 1, remainingMs: this.remainingCooldownMs,
          totalDurationMs: this.config.cooldownMs, state: 'COOLDOWN'
        });
      }
    }
  }

  public isBonusActive(): boolean { return this.state === 'BONUS'; }
  public getMultiplier(): number { return this.state === 'BONUS' ? this.config.multiplier : 1; }
  public getState(): TurretBonusState { return this.state; }
  public getKillsSinceLastBonus(): number { return this.killsSinceLastBonus; }
  public isEligible(): boolean { return this.state === 'NORMAL' && this.killsSinceLastBonus >= this.config.minKillsBetweenTriggers; }
  public getRemainingCooldownSec(): number { return Math.max(0, Math.ceil(this.remainingCooldownMs / 1000)); }
  public getRemainingDurationRatio(): number {
    if (this.state !== 'BONUS' || this.totalDurationMs <= 0) return 0;
    return Math.max(0, Math.min(1, this.remainingDurationMs / this.totalDurationMs));
  }
  public reset(): void {
    this.state = 'NORMAL'; this.killsSinceLastBonus = 0;
    this.remainingDurationMs = 0; this.remainingCooldownMs = 0; this.hudEmitAccumulatorMs = 0;
    GameEventBus.getInstance().emit('TURRET_EXPIRE', {
      active: false, multiplier: 1, remainingMs: 0, totalDurationMs: this.totalDurationMs, state: 'BONUS'
    });
  }
}