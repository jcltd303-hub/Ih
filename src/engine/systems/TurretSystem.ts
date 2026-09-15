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

  public static getInstance(): TurretSystem {
    if (!TurretSystem.instance) {
      TurretSystem.instance = new TurretSystem();
    }
    return TurretSystem.instance;
  }

  /**
   * Called on every fish kill. Evaluates eligibility and probability.
   */
  public onFishKilled(): boolean {
    this.killsSinceLastBonus++;

    // In bonus or cooldown: absolutely ineligible
    if (this.state !== 'NORMAL') {
      return false;
    }

    // Must reach minimum kill threshold
    if (this.killsSinceLastBonus < this.config.minKillsBetweenTriggers) {
      return false;
    }

    // Probabilistic roll
    if (Math.random() < this.config.baseChance) {
      this.activateBonus();
      return true;
    }

    return false;
  }

  /**
   * Force trigger for developer / lucky jackpot events
   */
  public forceTrigger(): void {
    this.activateBonus();
  }

  public activateBonus(durationOverrideMs?: number): void {
    this.state = 'BONUS';
    this.totalDurationMs = Math.min(
      this.config.maxDurationMs,
      durationOverrideMs || this.config.durationMs
    );
    this.remainingDurationMs = this.totalDurationMs;
    this.killsSinceLastBonus = 0;

    SoundManager.playUiSound('powerup');
    GameEventBus.getInstance().emit('TURRET_TRIGGER', {
      active: true,
      multiplier: this.config.multiplier,
      remainingMs: this.remainingDurationMs,
      totalDurationMs: this.totalDurationMs
    });
  }

  public update(deltaMs: number): void {
    if (this.state === 'BONUS') {
      this.remainingDurationMs -= deltaMs;

      if (this.remainingDurationMs <= 0) {
        // Expire bonus, transition to cooldown
        this.remainingDurationMs = 0;
        this.state = 'COOLDOWN';
        this.remainingCooldownMs = this.config.cooldownMs;

        GameEventBus.getInstance().emit('TURRET_EXPIRE', {
          active: false,
          multiplier: 1,
          remainingMs: 0,
          totalDurationMs: this.totalDurationMs
        });
      } else {
        GameEventBus.getInstance().emit('TURRET_UPDATE', {
          active: true,
          multiplier: this.config.multiplier,
          remainingMs: this.remainingDurationMs,
          totalDurationMs: this.totalDurationMs
        });
      }
    } else if (this.state === 'COOLDOWN') {
      this.remainingCooldownMs -= deltaMs;
      
      GameEventBus.getInstance().emit('TURRET_UPDATE', {
        active: false,
        multiplier: 1,
        remainingMs: this.remainingCooldownMs,
        totalDurationMs: this.config.cooldownMs,
        state: 'COOLDOWN'
      });

      if (this.remainingCooldownMs <= 0) {
        this.remainingCooldownMs = 0;
        this.state = 'NORMAL';
        GameEventBus.getInstance().emit('TURRET_READY');
      }
    }
  }

  public isBonusActive(): boolean {
    return this.state === 'BONUS';
  }

  public getMultiplier(): number {
    return this.state === 'BONUS' ? this.config.multiplier : 1;
  }

  public getState(): TurretBonusState {
    return this.state;
  }

  public getKillsSinceLastBonus(): number {
    return this.killsSinceLastBonus;
  }

  public isEligible(): boolean {
    return (
      this.state === 'NORMAL' &&
      this.killsSinceLastBonus >= this.config.minKillsBetweenTriggers
    );
  }

  public getRemainingCooldownSec(): number {
    return Math.max(0, Math.ceil(this.remainingCooldownMs / 1000));
  }

  public getRemainingDurationRatio(): number {
    if (this.state !== 'BONUS' || this.totalDurationMs <= 0) return 0;
    return Math.max(0, Math.min(1, this.remainingDurationMs / this.totalDurationMs));
  }

  public reset(): void {
    this.state = 'NORMAL';
    this.killsSinceLastBonus = 0;
    this.remainingDurationMs = 0;
    this.remainingCooldownMs = 0;
    GameEventBus.getInstance().emit('TURRET_EXPIRE', {
      active: false,
      multiplier: 1,
      remainingMs: 0,
      totalDurationMs: this.totalDurationMs
    });
  }
}
