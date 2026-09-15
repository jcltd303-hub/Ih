import { Container, Graphics, Sprite } from 'pixi.js';
import { BossManager } from './BossManager';
import { SpriteSheetManager, FishAnimationRig } from './SpriteSheetManager';
import { BoidSwarmManager, Boid } from './BoidSwarmManager';
import { EntityBounds } from './SpatialHashGrid';

export class Fish implements Boid {
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
  public animRig?: FishAnimationRig;
  public facing: 'left' | 'right' = 'right';
  public isAlive: boolean = true;
  public theme: 'light' | 'dark' = 'light';
  public hierarchy: 'NORMAL' | 'ELITE' | 'CRITICAL' | 'BOSS' = 'NORMAL';
  public bounds: EntityBounds;
  private maxSpeed: number;
  private maxForce: number;
  private panicTimer: number = 0;
  private miniHealthBar?: Graphics;
  private lodCounter: number = Math.floor(Math.random() * 3);
  private cachedAx: number = 0;
  private cachedAy: number = 0;

  constructor(
    id: string,
    type: 'small' | 'medium' | 'boss',
    startX: number,
    startY: number,
    screenWidth: number,
    screenHeight: number,
    theme: 'light' | 'dark' = 'light'
  ) {
    this.id = id;
    this.typeId = type;
    this.x = startX;
    this.y = startY;
    this.theme = theme;
    
    // Assign hierarchy based on type
    this.hierarchy = type === 'boss' ? 'BOSS' : (Math.random() < 0.1 ? 'CRITICAL' : (Math.random() < 0.25 ? 'ELITE' : 'NORMAL'));

    const isSmall = type === 'small';
    const isBoss = type === 'boss';

    const radius = isBoss ? 110 : isSmall ? 28 : 52;
    this.width = radius * 2;
    this.height = radius * 1.3;

    this.maxSpeed = isBoss ? 1.6 : isSmall ? 3.8 : 2.4;
    this.maxForce = 0.25;

    const baseSpeed = isBoss ? 0.7 : isSmall ? (Math.random() * 1.5 + 2.0) : (Math.random() * 1.0 + 1.4);
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * baseSpeed;
    this.vy = Math.sin(angle) * (baseSpeed * 0.5);
    this.facing = this.vx < 0 ? 'left' : 'right';

    // Reduced HP for high-impact arcade gameplay
    this.health = isBoss ? 28 : isSmall ? 2 : 6;
    this.maxHealth = this.health;
    this.multiplier = isBoss ? 25 : isSmall ? 1.2 : 4;
    this.worth = this.multiplier;

    this.bounds = {
      id: this.id,
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height
    };

    this.container = new Container();

    if (isBoss) {
      this.bossInstance = new BossManager(28, theme);
      this.container.addChild(this.bossInstance);
    } else {
      // Create animated sprite sheet rig for swimming and 3D turning with species and theme fidelity
      this.animRig = SpriteSheetManager.getInstance().createFishAnimationRig(type, theme);
      this.container.addChild(this.animRig.container);

      if (type === 'medium' && theme === 'light') {
        // Distinct electric cobalt/neon tint for medium cyber lionfish in light mode
        this.animRig.tint(0xa5f3fc);
      }

      // Initial animation matching initial movement direction
      this.animRig.playState(this.facing === 'left' ? 'swim_left' : 'swim_right');
    }

    this.container.x = this.x;
    this.container.y = this.y;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    if (this.animRig) {
      this.animRig.setTheme(theme);
      if (theme === 'light' && this.typeId === 'medium') {
        this.animRig.tint(0xa5f3fc);
      } else {
        this.animRig.resetTint();
      }
    }
    if (this.bossInstance) {
      this.bossInstance.setTheme(theme);
    }
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

    // Meta AI optimization: Boss uses autonomous spline/undulating pathing (bypasses boid neighbor calculations entirely)
    if (this.typeId === 'boss') {
      const targetSpeed = 1.25;
      const targetVx = this.facing === 'left' ? -targetSpeed : targetSpeed;
      this.vx += (targetVx - this.vx) * 0.04 * dtScale;
      this.vy = Math.sin(Date.now() * 0.0018 + this.x * 0.008) * 0.95;

      this.x += this.vx * dtScale;
      this.y += this.vy * dtScale;

      if (this.x < -160) {
        this.x = screenWidth + 140;
      } else if (this.x > screenWidth + 160) {
        this.x = -140;
      }
      if (this.y < 90) {
        this.y = 90;
      } else if (this.y > screenHeight - 120) {
        this.y = screenHeight - 120;
      }

      this.container.x = this.x;
      this.container.y = this.y;
      this.bounds.x = this.x - this.width / 2;
      this.bounds.y = this.y - this.height / 2;
      return;
    }

    // Small and medium fish flocking: zero-alloc pass-through + LOD frame staggering for tetras
    this.lodCounter++;
    let ax = this.cachedAx;
    let ay = this.cachedAy;

    const shouldRecalculateSteering =
      this.typeId !== 'small' ||
      (this.lodCounter & 1) === 0 ||
      threatX !== undefined;

    if (shouldRecalculateSteering) {
      const steering = BoidSwarmManager.computeSteering(this, neighbors, threatX, threatY);
      ax = steering.ax;
      ay = steering.ay;
      this.cachedAx = ax;
      this.cachedAy = ay;
    }

    // Threat panic (erratic jinking for small/medium)
    if (threatX !== undefined && threatY !== undefined) {
      const tdx = this.x - threatX;
      const tdy = this.y - threatY;
      const tdistSq = tdx * tdx + tdy * tdy;
      const panicRadius = this.typeId === 'medium' ? 170 : 180;
      if (tdistSq > 0 && tdistSq < panicRadius * panicRadius) {
        this.panicTimer = this.typeId === 'small' ? 50 : 35;
      }
    }

    let extraX = 0;
    let extraY = 0;
    if (this.panicTimer > 0) {
      this.panicTimer--;
      extraX = (Math.random() - 0.5) * 1.9;
      extraY = (Math.random() - 0.5) * 1.9;
    }

    this.vx += (ax + extraX) * dtScale;
    this.vy += (ay + extraY) * dtScale;

    const weights = BoidSwarmManager.getWeights(this.typeId);
    const currentSpeedSq = this.vx * this.vx + this.vy * this.vy;
    const effectiveMaxSpeed =
      this.panicTimer > 0
        ? weights.maxSpeed * 1.55
        : weights.maxSpeed;
    const maxSpeedSq = effectiveMaxSpeed * effectiveMaxSpeed;

    if (currentSpeedSq > maxSpeedSq) {
      const currentSpeed = Math.sqrt(currentSpeedSq);
      this.vx = (this.vx / currentSpeed) * effectiveMaxSpeed;
      this.vy = (this.vy / currentSpeed) * effectiveMaxSpeed;
    } else if (currentSpeedSq < 0.64) {
      const currentSpeed = Math.sqrt(currentSpeedSq) || 0.001;
      this.vx = (this.vx / currentSpeed) * 1.15;
      this.vy = (this.vy / currentSpeed) * 1.15;
    }

    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    // Screen wrap-around with vertical bounds
    if (this.x < -120) this.x = screenWidth + 110;
    if (this.x > screenWidth + 120) this.x = -110;
    if (this.y < 80) {
      this.y = 80;
      this.vy *= -1;
    }
    if (this.y > screenHeight - 100) {
      this.y = screenHeight - 100;
      this.vy *= -1;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.bounds.x = this.x - this.width / 2;
    this.bounds.y = this.y - this.height / 2;

    // Sprite sheet animated swimming and 3D turning
    if (this.animRig) {
      const heading = this.vx < -0.25 ? 'left' : this.vx > 0.25 ? 'right' : this.facing;

      if (heading !== this.facing && !this.animRig.isTurning) {
        this.facing = heading;
        const turnAnim = heading === 'left' ? 'turn_left' : 'turn_right';
        const targetSwim = heading === 'left' ? 'swim_left' : 'swim_right';

        this.animRig.playState(turnAnim, () => {
          if (this.isAlive && this.animRig) {
            this.animRig.playState(targetSwim);
          }
        });
      } else if (!this.animRig.isTurning) {
        const activeSwim = this.facing === 'left' ? 'swim_left' : 'swim_right';
        if (this.animRig.currentState !== activeSwim) {
          this.animRig.playState(activeSwim);
        }
      }

      const animSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      this.animRig.setSpeed(Math.max(0.7, animSpeed / this.maxSpeed));
    } else if (this.bossInstance) {
      this.bossInstance.update(dtScale, this.vx, this.vy);
    }
  }

  public inflictDamage(damage: number, forceInstantKill: boolean = false): { killed: boolean; multiplier: number; x: number; y: number } {
    if (!this.isAlive) return { killed: false, multiplier: 0, x: this.x, y: this.y };

    if (forceInstantKill) {
      this.kill();
      return { killed: true, multiplier: this.multiplier, x: this.x, y: this.y };
    }

    if (this.bossInstance) {
      const isDefeated = this.bossInstance.takeDamage(damage);
      if (isDefeated) {
        this.kill();
        return { killed: true, multiplier: this.multiplier, x: this.x, y: this.y };
      }
    } else {
      // Strictly monotonically decreasing health (guaranteed no health regeneration)
      this.health = Math.max(0, this.health - damage);
      this.updateMiniHealthBar();
      if (this.health <= 0) {
        this.kill();
        return { killed: true, multiplier: this.multiplier, x: this.x, y: this.y };
      }
    }

    // Hit pulse and flash reaction
    if (this.animRig) {
      this.animRig.tint(0xff4444);
      setTimeout(() => {
        if (this.isAlive && this.animRig) {
          if (this.typeId === 'medium') {
            this.animRig.tint(0xa5f3fc);
          } else {
            this.animRig.resetTint();
          }
        }
      }, 90);
    }

    this.container.scale.set(this.container.scale.x * 1.15, this.container.scale.y * 1.15);
    setTimeout(() => {
      if (this.container && !this.container.destroyed) {
        this.container.scale.set(this.container.scale.x / 1.15, this.container.scale.y / 1.15);
      }
    }, 70);

    return { killed: false, multiplier: 0, x: this.x, y: this.y };
  }

  private updateMiniHealthBar(): void {
    if (this.typeId === 'boss') return;
    if (!this.miniHealthBar) {
      this.miniHealthBar = new Graphics();
      this.container.addChild(this.miniHealthBar);
    }
    this.miniHealthBar.clear();
    const radius = this.typeId === 'small' ? 24 : 48;
    const barWidth = radius * 1.5;
    const barHeight = 4;
    const yPos = -radius * 0.7 - 8;
    const pct = Math.max(0, Math.min(1, this.health / this.maxHealth));

    // Dark background pill
    this.miniHealthBar.rect(-barWidth / 2, yPos, barWidth, barHeight);
    this.miniHealthBar.fill({ color: 0x0f172a, alpha: 0.85 });
    this.miniHealthBar.stroke({ width: 1, color: 0x334155, alpha: 0.8 });

    // Remaining HP fill (green -> amber -> crimson)
    const fillColor = pct > 0.6 ? 0x00ffcc : pct > 0.3 ? 0xffb703 : 0xff0055;
    this.miniHealthBar.rect(-barWidth / 2 + 0.5, yPos + 0.5, Math.max(0, (barWidth - 1) * pct), barHeight - 1);
    this.miniHealthBar.fill({ color: fillColor, alpha: 0.95 });
  }

  public kill(): void {
    this.isAlive = false;
    if (this.container && !this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}
