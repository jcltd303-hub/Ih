import { Container, Sprite, Texture, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Abyssal Horror Boss — shared artwork for both themes.
 * No procedural/placeholder boss fallback is rendered here.
 * The real boss sprite is loaded from the authored Abyssal Horror texture.
 */
export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public isEnraged = false;

  private readonly sprite: Sprite;
  private readonly glow: Graphics;
  private readonly label: Text;
  private facingSign = 1;
  private elapsed = 0;

  constructor(maxHp = 28, initialTheme: 'light' | 'dark' = 'dark') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;

    this.glow = new Graphics();
    this.addChild(this.glow);

    // Use the authored boss texture only. If it is unavailable, remain empty
    // rather than drawing the old crude ellipse/triangle fallback.
    this.sprite = new Sprite(Texture.EMPTY);
    this.sprite.anchor.set(0.5);
    this.addChild(this.sprite);

    this.label = new Text({
      text: '',
      style: new TextStyle({ fontSize: 12, fill: 0xffffff }),
    });
    this.label.anchor.set(0.5);
    this.label.visible = false;
    this.addChild(this.label);

    void this.loadArtwork();
  }

  private async loadArtwork(): Promise<void> {
    const candidates = [
      '/abyssal_horror_boss.png',
      '/abyssal-horror-boss.png',
      '/boss/abyssal_horror_boss.png',
      '/boss/abyssal-horror-boss.png',
    ];

    for (const path of candidates) {
      try {
        const texture = Texture.from(path);
        if (texture !== Texture.EMPTY) {
          this.sprite.texture = texture;
          this.sprite.visible = true;
          this.sprite.scale.set(1);
          this.sprite.alpha = 1;
          return;
        }
      } catch {
        // Keep searching. Never substitute procedural fallback artwork.
      }
    }

    this.sprite.visible = false;
    this.glow.visible = false;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    // Artwork is intentionally identical across themes for now.
    this.glow.visible = false;
  }

  public takeDamage(damage: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - Math.max(0, damage));
    if (this.currentHp <= this.maxHp * 0.35) this.isEnraged = true;
    return this.currentHp <= 0;
  }

  public update(dtScale = 1, vx = 1, _vy = 0): void {
    if (Math.abs(vx) > 0.15) this.facingSign = vx > 0 ? 1 : -1;
    this.elapsed += dtScale;

    if (this.sprite.visible) {
      this.sprite.scale.x = this.facingSign * (1 + Math.sin(this.elapsed * 0.08) * 0.015);
      this.sprite.scale.y = 1 + Math.sin(this.elapsed * 0.08) * 0.02;
    }
  }
}
