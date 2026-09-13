import { Container, Graphics, Text, TextStyle } from 'pixi.js';

interface ExplosionParticle {
  graphic: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
}

interface CoinToken {
  graphic: Graphics;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  life: number;
}

interface FloatingText {
  text: Text;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  life: number;
}

export class ParticleFXManager {
  private stage: Container;
  private particles: ExplosionParticle[] = [];
  private coins: CoinToken[] = [];
  private floatingTexts: FloatingText[] = [];
  private screenWidth: number;
  private screenHeight: number;

  constructor(stage: Container, screenWidth: number, screenHeight: number) {
    this.stage = stage;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  public spawnFloatingText(x: number, y: number, message: string, color: number | string = 0xffd700, isLarge: boolean = false): void {
    const text = new Text({
      text: message,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: isLarge ? 18 : 12,
        fontWeight: '800',
        fill: color,
        stroke: { color: 0x000000, width: 3 }
      })
    });
    text.anchor.set(0.5, 0.5);
    text.x = x;
    text.y = y;
    this.stage.addChild(text);

    this.floatingTexts.push({
      text,
      x,
      y,
      vy: isLarge ? -1.5 : -1.0,
      alpha: 1.0,
      life: isLarge ? 55 : 35
    });
  }

  public spawnExplosion(x: number, y: number, color: number = 0x00ffcc, count: number = 20): void {
    for (let i = 0; i < count; i++) {
      const graphic = new Graphics();
      const size = Math.random() * 5 + 2;
      
      graphic.rect(-size / 2, -size / 2, size, size);
      graphic.fill({ color, alpha: 0.95 });
      graphic.x = x;
      graphic.y = y;
      this.stage.addChild(graphic);

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2;

      this.particles.push({
        graphic,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        decay: Math.random() * 0.035 + 0.02
      });
    }
  }

  public emitCoinExplosion(x: number, y: number, count: number = 12): void {
    for (let i = 0; i < count; i++) {
      const graphic = new Graphics();
      graphic.circle(0, 0, 5);
      graphic.fill({ color: 0xffd700, alpha: 1 });
      graphic.stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
      graphic.x = x;
      graphic.y = y;
      this.stage.addChild(graphic);

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;

      this.coins.push({
        graphic,
        x,
        y,
        targetX: 200,
        targetY: 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 45
      });
    }
  }

  public update(deltaTime: number): void {
    const dtScale = Math.min(deltaTime * 0.06, 2.5);

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtScale;
      p.y += p.vy * dtScale;
      p.alpha -= p.decay * dtScale;

      p.graphic.x = p.x;
      p.graphic.y = p.y;
      p.graphic.alpha = Math.max(0, p.alpha);

      if (p.alpha <= 0) {
        p.graphic.destroy();
        this.particles.splice(i, 1);
      }
    }

    // Update coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.vx *= 0.94;
      c.vy += 0.35 * dtScale; // gravity
      c.x += c.vx * dtScale;
      c.y += c.vy * dtScale;

      c.graphic.x = c.x;
      c.graphic.y = c.y;
      c.life -= dtScale;

      if (c.life <= 0) {
        c.graphic.destroy();
        this.coins.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dtScale;
      ft.life -= dtScale;
      if (ft.life < 20) {
        ft.alpha = Math.max(0, ft.life / 20);
      }
      ft.text.y = ft.y;
      ft.text.alpha = ft.alpha;

      if (ft.life <= 0) {
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }
}
