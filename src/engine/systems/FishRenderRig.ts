
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

  private flashTimeout: ReturnType<typeof setTimeout> | null = null;
  private shudderTimeout: ReturnType<typeof setTimeout> | null = null;

  setTheme(theme: 'light' | 'dark'): void {
    this.rig.setTheme(theme);
  }

  applyFlash(color: number, durationSeconds: number): void {
    if (this.flashTimeout) clearTimeout(this.flashTimeout);
    this.rig.tint(color);
    this.flashTimeout = setTimeout(() => {
      this.rig.resetTint();
      this.flashTimeout = null;
    }, durationSeconds * 1000);
  }

  setMotion(speed: number, vy: number, panic: boolean): void {
    if (!this.rig || !this.rig.container) return;
    this.rig.setSpeed(panic ? speed * 1.8 : speed);
    // Apply slight tilt based on vertical velocity
    this.rig.container.rotation = vy * 0.05;
  }

  setHierarchy(hierarchy: 'NORMAL' | 'ELITE' | 'CRITICAL' | 'BOSS'): void {
    if (!this.rig || !this.rig.container || !this.rig.sprite) return;
    if (hierarchy === 'ELITE') {
        this.rig.container.scale.set(1.1);
        this.rig.sprite.tint = 0xaaaaff; // Faint blue-ish tint
    }
    else if (hierarchy === 'CRITICAL') {
        this.rig.container.scale.set(1.25);
        this.rig.sprite.tint = 0xffaaaa; // Brighter red-ish tint
    }
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

  applyShudder(intensity: number, durationSeconds: number): void {
    if (!this.rig || !this.rig.container) return;
    if (this.shudderTimeout) clearTimeout(this.shudderTimeout);
    
    // Simple shudder implementation: shake container
    const originalPos = { x: this.rig.container.x, y: this.rig.container.y };
    const interval = setInterval(() => {
        this.rig.container.x = originalPos.x + (Math.random() - 0.5) * intensity;
        this.rig.container.y = originalPos.y + (Math.random() - 0.5) * intensity;
    }, 30);
    
    this.shudderTimeout = setTimeout(() => {
        clearInterval(interval);
        this.rig.container.x = originalPos.x;
        this.rig.container.y = originalPos.y;
        this.shudderTimeout = null;
    }, durationSeconds * 1000);
  }

  playState(state: string, onComplete?: () => void): void {
    // FishAnimationRig uses specific states, mapping here
    this.rig.playState(state as any, onComplete);
  }

  destroy(): void {
    this.rig.destroy({ children: true });
  }
}
