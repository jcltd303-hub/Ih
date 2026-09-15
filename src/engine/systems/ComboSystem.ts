import { GameEventBus } from '../core/GameEvents';

export class ComboSystem {
  private static instance: ComboSystem | null = null;
  private count = 0;
  private maxCombo = 0;
  private remainingMs = 0;
  private readonly WINDOW_MS = 2800;
  private isActive = false;

  public static getInstance(): ComboSystem {
    if (!ComboSystem.instance) {
      ComboSystem.instance = new ComboSystem();
    }
    return ComboSystem.instance;
  }

  public registerHit(): void {
    this.count++;
    if (this.count > this.maxCombo) {
      this.maxCombo = this.count;
    }
    this.remainingMs = this.WINDOW_MS;
    this.isActive = true;

    this.emitUpdate();
  }

  public registerKill(): void {
    // Kills give a bigger combo boost and refresh timer fully
    this.count += 2;
    if (this.count > this.maxCombo) {
      this.maxCombo = this.count;
    }
    this.remainingMs = this.WINDOW_MS;
    this.isActive = true;

    this.emitUpdate();
  }

  public update(deltaMs: number): void {
    if (!this.isActive) return;

    this.remainingMs -= deltaMs;
    if (this.remainingMs <= 0) {
      this.breakCombo();
    } else {
      this.emitUpdate();
    }
  }

  public breakCombo(): void {
    if (this.count > 0) {
      GameEventBus.getInstance().emit('COMBO_BREAK', {
        finalCombo: this.count,
        maxCombo: this.maxCombo
      });
    }
    this.count = 0;
    this.remainingMs = 0;
    this.isActive = false;
    this.emitUpdate();
  }

  public reset(): void {
    this.count = 0;
    this.maxCombo = 0;
    this.remainingMs = 0;
    this.isActive = false;
    this.emitUpdate();
  }

  public getCombo(): number {
    return this.count;
  }

  public getMaxCombo(): number {
    return this.maxCombo;
  }

  public getMultiplier(): number {
    if (this.count >= 25) return 1.5;
    if (this.count >= 15) return 1.3;
    if (this.count >= 8) return 1.2;
    if (this.count >= 4) return 1.1;
    return 1.0;
  }

  private emitUpdate(): void {
    const ratio = Math.max(0, Math.min(1, this.remainingMs / this.WINDOW_MS));
    GameEventBus.getInstance().emit('COMBO_UPDATE', {
      combo: this.count,
      timerRatio: ratio,
      damageMultiplier: this.getMultiplier()
    });
  }
}
