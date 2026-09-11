import { Container, Graphics, Sprite } from 'pixi.js';
import { BossManager } from './BossManager';

export class Fish {
  public id: string;
  public typeId: 'small' | 'medium' | 'boss';
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public width: number;
  public height: number;
  public health: number;
  public maxHealth: number;
  public multiplier: number;
  public worth: number;
  public container: Container;
  public graphics?: Graphics;
  public bossInstance?: BossManager;
  public isAlive: boolean = true;
  private maxSpeed: number;
  private maxForce: number;
  private panicTimer: number = 0;

  constructor(id: string, type: 'small' | 'medium' | 'boss', startX: number, startY: number, screenWidth: number, screenHeight: number) {
    this.id = id;
    this.typeId = type;
    this.x = startX;
    this.y = startY;

    const isSmall = type === 'small';
    const isBoss = type === 'boss';

    const radius = isBoss ? 85 : isSmall ? 24 : 48;
    this.width = radius * 2;
    this.height = radius * 1.3;

    this.maxSpeed = isBoss ? 1.6 : isSmall ? 3.8 : 2.4;
    this.maxForce = 0.25;

    const baseSpeed = isBoss ? 0.7 : isSmall ? (Math.random() * 1.5 + 2.0) : (Math.random() * 1.0 + 1.4);
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * baseSpeed;
    this.vy = Math.sin(angle) * (baseSpeed * 0.5);

    this.health = isBoss ? 2500 : isSmall ? 80 : 350;
    this.maxHealth = this.health;
    this.multiplier = isBoss ? 35 : isSmall ? 1.8 : 6;
    this.worth = this.multiplier;

    this.container = new Container();

    if (isBoss) {
      this.bossInstance = new BossManager(2500);
      this.container.addChild(this.bossInstance);
    } else if (isSmall) {
      try {
        const sprite = Sprite.from('tetra_sprite');
        sprite.anchor.set(0.5, 0.5);
        sprite.width = radius * 2.6;
        sprite.height = radius * 1.5;
        this.container.addChild(sprite);
      } catch (e) {
        this.graphics = new Graphics();
        this.graphics.ellipse(0, 0, radius, radius * 0.55);
        this.graphics.fill({ color: 0x00d4ff, alpha: 0.95 });
        this.container.addChild(this.graphics);
      }
    } else {
      this.graphics = new Graphics();
      const primaryColor = isSmall ? 0x00f0ff : 0xff9900;
      const accentColor = isSmall ? 0x3b82f6 : 0xff3366;
      const glowColor = isSmall ? 0x00ffcc : 0xffd700;

      // Drop shadow / glow aura
      this.graphics.ellipse(0, 2, radius * 0.95, radius * 0.5);
      this.graphics.fill({ color: glowColor, alpha: 0.18 });

      // Main streamlined armored hull
      this.graphics.ellipse(0, 0, radius, radius * 0.52);
      this.graphics.fill({ color: primaryColor, alpha: 0.9 });
      this.graphics.stroke({ width: 2.5, color: glowColor, alpha: 0.95 });

      // Segmented cyber armor plates
      this.graphics.poly([
        { x: -radius * 0.2, y: -radius * 0.48 },
        { x: radius * 0.1, y: -radius * 0.52 },
        { x: radius * 0.2, y: radius * 0.52 },
        { x: -radius * 0.1, y: radius * 0.48 }
      ]);
      this.graphics.fill({ color: accentColor, alpha: 0.4 });

      // Bioluminescent neon stripe
      this.graphics.moveTo(-radius * 0.6, 0);
      this.graphics.bezierCurveTo(-radius * 0.2, -radius * 0.25, radius * 0.3, -radius * 0.2, radius * 0.7, 0);
      this.graphics.bezierCurveTo(radius * 0.3, radius * 0.2, -radius * 0.2, radius * 0.25, -radius * 0.6, 0);
      this.graphics.fill({ color: 0xffffff, alpha: 0.85 });

      // Sleek multi-rib dorsal fin
      this.graphics.poly([
        { x: -radius * 0.3, y: -radius * 0.5 },
        { x: -radius * 0.1, y: -radius * 0.85 },
        { x: radius * 0.2, y: -radius * 0.52 }
      ]);
      this.graphics.fill({ color: accentColor, alpha: 0.85 });
      this.graphics.stroke({ width: 1.5, color: glowColor, alpha: 0.9 });

      // Pectoral fin
      this.graphics.poly([
        { x: 0, y: radius * 0.2 },
        { x: radius * 0.25, y: radius * 0.65 },
        { x: radius * 0.4, y: radius * 0.3 }
      ]);
      this.graphics.fill({ color: accentColor, alpha: 0.75 });

      // Graceful flowing tail fin with energy membrane
      this.graphics.poly([
        { x: -radius, y: 0 },
        { x: -radius - (isSmall ? 18 : 28), y: -radius * 0.7 },
        { x: -radius - (isSmall ? 10 : 16), y: 0 },
        { x: -radius - (isSmall ? 18 : 28), y: radius * 0.7 }
      ]);
      this.graphics.fill({ color: accentColor, alpha: 0.8 });
      this.graphics.stroke({ width: 2, color: glowColor, alpha: 0.9 });

      // Piercing cybernetic optic eye
      this.graphics.circle(radius * 0.52, -radius * 0.1, isSmall ? 3.5 : 5.5);
      this.graphics.fill({ color: 0xffffff, alpha: 1.0 });
      this.graphics.circle(radius * 0.54, -radius * 0.1, isSmall ? 1.5 : 2.5);
      this.graphics.fill({ color: 0xff0055, alpha: 1.0 });

      this.container.addChild(this.graphics);
    }

    this.container.x = this.x;
    this.container.y = this.y;
  }

  public updateSteering(
    neighbors: Fish[],
    screenWidth: number,
    screenHeight: number,
    threatX?: number,
    threatY?: number,
    dtScale: number = 1.0
  ): void {
    if (!this.isAlive) return;

    let steerX = 0;
    let steerY = 0;

    // 1. Separation & Cohesion steering behaviors if peers exist
    if (neighbors.length > 0 && this.typeId === 'small') {
      let sepX = 0;
      let sepY = 0;
      let cohX = 0;
      let cohY = 0;
      let count = 0;

      for (const other of neighbors) {
        if (other.id === this.id) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < 50) {
          // Separation
          sepX += (dx / dist) / dist;
          sepY += (dy / dist) / dist;
        }

        cohX += other.x;
        cohY += other.y;
        count++;
      }

      if (count > 0) {
        steerX += sepX * 1.5;
        steerY += sepY * 1.5;

        // Cohesion towards flock center
        cohX /= count;
        cohY /= count;
        const toCenterX = cohX - this.x;
        const toCenterY = cohY - this.y;
        const centerDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
        if (centerDist > 0) {
          steerX += (toCenterX / centerDist) * 0.4;
          steerY += (toCenterY / centerDist) * 0.4;
        }
      }
    }

    // 2. Threat Evasion (Harder to catch: sudden erratic bursts away from crosshair/shots)
    if (threatX !== undefined && threatY !== undefined) {
      const tdx = this.x - threatX;
      const tdy = this.y - threatY;
      const tdist = Math.sqrt(tdx * tdx + tdy * tdy);

      if (tdist < 180 && tdist > 0) {
        this.panicTimer = 45; // panic frames
        const evasionStrength = (1 - tdist / 180) * 3.5;
        steerX += (tdx / tdist) * evasionStrength * 2.2;
        steerY += (tdy / tdist) * evasionStrength * 2.2;
      }
    }

    if (this.panicTimer > 0) {
      this.panicTimer--;
      // Erratic jinking
      steerX += (Math.random() - 0.5) * 1.8;
      steerY += (Math.random() - 0.5) * 1.8;
    }

    // Apply steering acceleration
    this.vx += steerX * 0.2 * dtScale;
    this.vy += steerY * 0.2 * dtScale;

    // Speed limiting & dash multipliers
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const effectiveMaxSpeed = this.panicTimer > 0 ? this.maxSpeed * 1.6 : this.maxSpeed;

    if (currentSpeed > effectiveMaxSpeed) {
      this.vx = (this.vx / currentSpeed) * effectiveMaxSpeed;
      this.vy = (this.vy / currentSpeed) * effectiveMaxSpeed;
    } else if (currentSpeed < 0.8 && this.typeId !== 'boss') {
      // Ensure minimum cruising velocity so fish never stall
      const angle = Math.atan2(this.vy, this.vx) || Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * 1.2;
      this.vy = Math.sin(angle) * 1.2;
    }

    // Update positions
    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    // Screen wrap-around with vertical bounds containment
    if (this.x < -120) this.x = screenWidth + 110;
    if (this.x > screenWidth + 120) this.x = -110;
    if (this.y < 80) { this.y = 80; this.vy *= -1; }
    if (this.y > screenHeight - 100) { this.y = screenHeight - 100; this.vy *= -1; }

    this.container.x = this.x;
    this.container.y = this.y;

    // Face orientation towards velocity vector
    if (Math.abs(this.vx) > 0.1) {
      this.container.scale.x = this.vx > 0 ? 1 : -1;
    }
  }

  public inflictDamage(damage: number): { killed: boolean; multiplier: number; x: number; y: number } {
    if (!this.isAlive) return { killed: false, multiplier: 0, x: this.x, y: this.y };

    if (this.bossInstance) {
      const isDefeated = this.bossInstance.takeDamage(damage);
      if (isDefeated) {
        this.kill();
        return { killed: true, multiplier: this.multiplier, x: this.x, y: this.y };
      }
    } else {
      this.health -= damage;
      if (this.health <= 0) {
        this.kill();
        return { killed: true, multiplier: this.multiplier, x: this.x, y: this.y };
      }
    }

    // Hit pulse reaction
    this.container.scale.set(1.2);
    setTimeout(() => {
      if (this.container && !this.container.destroyed) {
        this.container.scale.set(this.vx > 0 ? 1 : -1, 1);
      }
    }, 70);

    return { killed: false, multiplier: 0, x: this.x, y: this.y };
  }

  public kill(): void {
    this.isAlive = false;
    if (this.container && !this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}
