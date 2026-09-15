import { GameEventBus } from '../core/GameEvents';
import { GameConfig } from '../../config/GameConfig';

export class ComboSystem {
  private static instance: ComboSystem | null = null;
  private count = 0;
  private maxCombo = 0;
  private remainingMs = 0;
  /** Short fighter-style chain window: keep pressure on instead of passive stacking. */
  private readonly WINDOW_MS = GameConfig.comboWindowMs;
  private isActive = false;
  private emitAccumulatorMs = 0;

  public static getInstance(): ComboSystem {
    if (!ComboSystem.instance) ComboSystem.instance = new ComboSystem();
    return ComboSystem.instance;
  }

  public registerHit(): void {
    this.count++;
    this.maxCombo = Math.max(this.maxCombo, this.count);
    this.remainingMs = this.WINDOW_MS;
    this.isActive = true;
    this.emitUpdate(true);
  }

  public registerKill(): void {
    this.count += 2;
    this.maxCombo = Math.max(this.maxCombo, this.count);
    this.remainingMs = this.WINDOW_MS;
    this.isActive = true;
    this.emitUpdate(true);
  }

  public update(deltaMs: number): void {
    if (!this.isActive) return;
    const dt = Math.max(0, Math.min(250, Number.isFinite(deltaMs) ? deltaMs : 0));
    this.remainingMs -= dt;
    this.emitAccumulatorMs += dt;
    if (this.remainingMs <= 0) {
      this.breakCombo();
    } else if (this.emitAccumulatorMs >= 80) {
      this.emitAccumulatorMs = 0;
      this.emitUpdate(false);
    }
  }

  public breakCombo(): void {
    if (this.count > 0) GameEventBus.getInstance().emit('COMBO_BREAK', { finalCombo: this.count, maxCombo: this.maxCombo });
    this.count = 0;
    this.remainingMs = 0;
    this.isActive = false;
    this.emitAccumulatorMs = 0;
    this.emitUpdate(true);
  }

  public reset(): void {
    this.count = 0; this.maxCombo = 0; this.remainingMs = 0; this.isActive = false; this.emitAccumulatorMs = 0;
    this.emitUpdate(true);
  }

  public getCombo(): number { return this.count; }
  public getMaxCombo(): number { return this.maxCombo; }

  public getMultiplier(): number {
    if (this.count >= 25) return 1.5;
    if (this.count >= 15) return 1.3;
    if (this.count >= 8) return 1.2;
    if (this.count >= 4) return 1.1;
    return 1.0;
  }

  private emitUpdate(_force: boolean): void {
    const ratio = Math.max(0, Math.min(1, this.remainingMs / this.WINDOW_MS));
    GameEventBus.getInstance().emit('COMBO_UPDATE', {
      combo: this.count,
      timerRatio: ratio,
      damageMultiplier: this.getMultiplier()
    });
  }
}