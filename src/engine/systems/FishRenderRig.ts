
import { Container } from 'pixi.js';
import { FishAnimationRig } from './SpriteSheetManager';
import { IRenderRig } from './RenderRig';

export class FishRenderRig implements IRenderRig {
  private rig: FishAnimationRig;

  constructor(rig: FishAnimationRig) {
    this.rig = rig;
  }

  get container(): Container {
    return this.rig.container;
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.rig.setTheme(theme);
  }

  applyFlash(color: number, duration: number): void {
    this.rig.tint(color);
    setTimeout(() => {
      this.rig.resetTint();
    }, duration);
  }

  setMotion(speed: number, vy: number, panic: boolean): void {
    if (!this.rig || !this.rig.container) return;
    this.rig.setSpeed(panic ? speed * 1.8 : speed);
    // Apply slight tilt based on vertical velocity
    this.rig.container.rotation = vy * 0.05;
  }

  setHierarchy(hierarchy: 'NORMAL' | 'ELITE' | 'CRITICAL' | 'BOSS'): void {
    if (!this.rig || !this.rig.container) return;
    if (hierarchy === 'ELITE') this.rig.container.scale.set(1.1);
    else if (hierarchy === 'CRITICAL') this.rig.container.scale.set(1.25);
  }

  playHitReaction(amount: number, theme: 'light' | 'dark'): void {
    this.applyFlash(0xffffff, 0.1);
    if (!this.rig || !this.rig.container) return;
    // Quick scale punch
    this.rig.container.scale.set(0.9, 1.1);
    setTimeout(() => {
        if (this.rig && this.rig.container && !this.rig.container.destroyed) {
            this.rig.container.scale.set(1.0, 1.0);
        }
    }, 100);
  }

  applyShudder(intensity: number, duration: number): void {
    // Normal fish don't have shudder logic in the rig
  }

  playState(state: string, onComplete?: () => void): void {
    // FishAnimationRig uses specific states, mapping here
    this.rig.playState(state as any, onComplete);
  }

  destroy(): void {
    this.rig.destroy({ children: true });
  }
}
