
import { Container, Sprite, Texture, Assets } from 'pixi.js';
import { IRenderRig } from './RenderRig';

export class BossRenderRig implements IRenderRig {
  public container: Container;
  private sprite: Sprite;
  private theme: 'light' | 'dark' = 'light';
  private damageFlashTimer = 0;
  private shudderTimer = 0;

  constructor(width: number, height: number, theme: 'light' | 'dark') {
    this.container = new Container();
    const tex = Assets.cache.get('abyssal_horror_boss') || Assets.cache.get('boss_core') || Texture.EMPTY;
    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(0.5);
    this.sprite.width = width;
    this.sprite.height = height;
    this.theme = theme;
    this.sprite.tint = theme === 'dark' ? 0xd8b4fe : 0xffffff;
    this.container.addChild(this.sprite);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.sprite.tint = theme === 'dark' ? 0xd8b4fe : 0xffffff;
  }

  applyFlash(color: number, duration: number): void {
    this.damageFlashTimer = duration;
    this.sprite.tint = color;
  }

  applyShudder(intensity: number, duration: number): void {
    this.shudderTimer = duration;
    // The actual displacement happens in the update loop via container position
  }

  playState(state: string, onComplete?: () => void): void {
    // Boss currently uses procedural transformation instead of animation states
  }

  update(dt: number, facing: 'left' | 'right', x: number, y: number): void {
    // Handle flash/shudder timers
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= 0.05 * dt;
      if (this.damageFlashTimer < 0) {
        this.damageFlashTimer = 0;
        this.sprite.tint = this.theme === 'dark' ? 0xd8b4fe : 0xffffff;
      }
    }
    if (this.shudderTimer > 0) {
      this.shudderTimer -= 0.016 * dt;
      if (this.shudderTimer < 0) this.shudderTimer = 0;
    }

    const dx = this.shudderTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
    const dy = this.shudderTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
    this.container.x = x + dx;
    this.container.y = y + dy;

    // Set facing
    const scaleSign = facing === 'left' ? 1 : -1;
    this.sprite.scale.x = scaleSign * Math.abs(this.sprite.scale.x);
    
    // Dynamic subtle breathing
    const breathe = 1.0 + Math.sin(Date.now() * 0.003) * 0.03;
    this.sprite.scale.y = Math.abs(this.sprite.scale.y) * breathe;
  }

  destroy(): void {
    this.sprite.destroy();
    this.container.destroy({ children: true });
  }
}
