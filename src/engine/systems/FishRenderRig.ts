
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
