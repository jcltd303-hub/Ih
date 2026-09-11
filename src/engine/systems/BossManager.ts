import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

export class BossManager extends Container {
  public maxHp: number;
  public currentHp: number;
  private healthBarBg: Graphics;
  private healthBarFill: Graphics;
  private bossGraphic: Graphics | Sprite;
  private bossLabel: Text;
  public isEnraged: boolean = false;

  constructor(maxHp: number = 500) {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;

    // Try loading Leviathan sprite image from cache
    try {
      const sprite = Sprite.from('leviathan_sprite');
      sprite.anchor.set(0.5, 0.5);
      sprite.width = 180;
      sprite.height = 120;
      this.bossGraphic = sprite;
      this.addChild(this.bossGraphic);
    } catch (e) {
      // Fallback to procedural graphics
      const g = new Graphics();
      this.renderBossShape(g, 0xff0055);
      this.bossGraphic = g;
      this.addChild(this.bossGraphic);
    }

    // Health Bar
    this.healthBarBg = new Graphics();
    this.healthBarBg.rect(-60, -75, 120, 8);
    this.healthBarBg.fill({ color: 0x111827, alpha: 0.8 });
    this.healthBarBg.stroke({ width: 1, color: 0xff0055 });
    this.addChild(this.healthBarBg);

    this.healthBarFill = new Graphics();
    this.updateHealthBar();
    this.addChild(this.healthBarFill);

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fontWeight: 'bold',
      fill: 0xff0055
    });
    this.bossLabel = new Text({ text: 'APEX LEVIATHAN', style });
    this.bossLabel.anchor.set(0.5);
    this.bossLabel.y = -90;
    this.addChild(this.bossLabel);
  }

  private renderBossShape(g: Graphics, color: number): void {
    g.clear();
    const goldArmor = 0xffb703;
    const goldHighlight = 0xffd700;
    const corePurple = 0xd946ef;
    const wingColor = 0xf59e0b;

    // Wing back-layer
    g.poly([
      { x: -10, y: -20 },
      { x: -50, y: -90 },
      { x: 10, y: -60 },
      { x: 40, y: -80 },
      { x: 30, y: -30 }
    ]);
    g.fill({ color: wingColor, alpha: 0.85 });
    g.stroke({ width: 2, color: corePurple, alpha: 0.9 });

    // Plasma lightning across wings
    g.moveTo(-20, -50);
    g.lineTo(0, -70);
    g.lineTo(25, -60);
    g.stroke({ width: 2, color: corePurple, alpha: 1.0 });

    // Main dragon body hull (segmented gold armor)
    g.ellipse(0, 0, 75, 42);
    g.fill({ color: goldArmor, alpha: 0.95 });
    g.stroke({ width: 3, color: goldHighlight, alpha: 1.0 });

    // Central plasma reactor core
    g.circle(0, 0, 16);
    g.fill({ color: 0x1e1b4b, alpha: 1.0 });
    g.circle(0, 0, 10);
    g.fill({ color: corePurple, alpha: 1.0 });
    g.circle(0, 0, 5);
    g.fill({ color: 0xffffff, alpha: 1.0 });

    // Segmented dragon tail with spikes
    g.moveTo(-70, 0);
    g.bezierCurveTo(-100, 20, -130, 50, -150, 30);
    g.bezierCurveTo(-130, 0, -100, -20, -70, 0);
    g.fill({ color: goldArmor, alpha: 0.9 });
    g.stroke({ width: 2, color: goldHighlight, alpha: 0.95 });

    // Tail spikes and plasma nodes
    for (let i = 1; i <= 4; i++) {
      const tx = -70 - i * 20;
      g.poly([
        { x: tx, y: -10 - i * 4 },
        { x: tx - 10, y: -25 - i * 4 },
        { x: tx - 5, y: 0 }
      ]);
      g.fill({ color: goldHighlight, alpha: 0.9 });
      g.circle(tx - 5, 0, 3);
      g.fill({ color: corePurple, alpha: 1.0 });
    }

    // Dragon head and jaw
    g.poly([
      { x: 50, y: -25 },
      { x: 95, y: -10 },
      { x: 95, y: 15 },
      { x: 50, y: 20 }
    ]);
    g.fill({ color: goldArmor, alpha: 0.95 });
    g.stroke({ width: 2.5, color: goldHighlight, alpha: 1.0 });

    // Horns
    g.poly([
      { x: 60, y: -25 },
      { x: 80, y: -55 },
      { x: 70, y: -25 }
    ]);
    g.fill({ color: goldHighlight, alpha: 0.95 });

    g.poly([
      { x: 50, y: -25 },
      { x: 65, y: -65 },
      { x: 55, y: -25 }
    ]);
    g.fill({ color: goldHighlight, alpha: 0.95 });

    // Glowing purple dragon eye
    g.circle(75, -5, 6);
    g.fill({ color: 0xffffff, alpha: 1.0 });
    g.circle(76, -5, 3);
    g.fill({ color: corePurple, alpha: 1.0 });

    // Open jaws with plasma breath
    g.poly([
      { x: 80, y: 0 },
      { x: 105, y: -5 },
      { x: 90, y: 10 }
    ]);
    g.fill({ color: corePurple, alpha: 0.8 });
  }

  public takeDamage(amount: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - amount);
    this.updateHealthBar();

    if (this.currentHp < this.maxHp * 0.4 && !this.isEnraged) {
      this.isEnraged = true;
      if (this.bossGraphic instanceof Graphics) {
        this.renderBossShape(this.bossGraphic, 0xff3300);
      }
      this.bossLabel.text = '⚠️ ENRAGED LEVIATHAN ⚠️';
    }

    if (this.currentHp <= 0) {
      this.visible = false;
      return true; // Defeated
    }
    return false;
  }

  private updateHealthBar(): void {
    const pct = Math.max(0, this.currentHp / this.maxHp);
    this.healthBarFill.clear();
    this.healthBarFill.rect(-59, -74, 118 * pct, 6);
    this.healthBarFill.fill({ color: this.isEnraged ? 0xff3300 : 0x00ffcc, alpha: 0.95 });
  }
}
