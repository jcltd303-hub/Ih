import { Assets, Container, Sprite, Texture } from 'pixi.js';

/** Shared authored Abyssal Horror artwork used as the boss in both themes. */
export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public isEnraged = false;

  private readonly sprite: Sprite;
  private facingSign = 1;
  private elapsed = 0;
  private readonly artworkUrl: string;

  constructor(maxHp = 28, initialTheme: 'light' | 'dark' = 'dark') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;

    this.artworkUrl = new URL('../../assets/images/abyssal_horror_boss_sheet.png', import.meta.url).href;
    this.sprite = new Sprite(Texture.EMPTY);
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
    this.sprite.renderable = false;
    this.addChild(this.sprite);
    void this.loadArtwork();
  }

  private async loadArtwork(): Promise<void> {
    try {
      const texture = await Assets.load(this.artworkUrl);
      if (this.destroyed) return;
      this.sprite.texture = texture;
      this.sprite.visible = true;
      this.sprite.renderable = true;
      this.sprite.alpha = 1;
      this.sprite.scale.set(1);
    } catch (error) {
      console.error('[AbyssalHorrorBoss] Failed to load authored boss sheet', error);
    }
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
  }

  public takeDamage(damage: number): boolean {
    const amount = Math.max(0, damage);
    this.currentHp = Math.max(0, this.currentHp - amount);
    if (this.currentHp <= this.maxHp * 0.35) this.isEnraged = true;
    return this.currentHp <= 0;
  }

  public update(dtScale = 1, vx = 1, _vy = 0): void {
    if (Math.abs(vx) > 0.15) this.facingSign = vx < 0 ? -1 : 1;
    this.elapsed += dtScale;
    if (this.sprite.visible) {
      this.sprite.scale.x = this.facingSign * (1 + Math.sin(this.elapsed * 0.08) * 0.015);
      this.sprite.scale.y = 1 + Math.sin(this.elapsed * 0.08) * 0.02;
    }
  }
}
