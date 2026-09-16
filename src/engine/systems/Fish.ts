import { Container, Graphics } from 'pixi.js';
import { BossManager } from './BossManager';
import { AbyssalHorrorBoss } from './AbyssalHorrorBoss';
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
  public abyssalBoss?: AbyssalHorrorBoss;
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
    theme: 'light' | 'dark' = 'light',
    maxHpOverride?: number
  ) {
    this.id = id;
    this.typeId = type;
    this.x = startX;
    this.y = startY;
    this.theme = theme;

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

    this.health = isBoss ? (maxHpOverride ?? 28) : isSmall ? 2 : 6;
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
      // Use the same Abyssal Horror artwork in both themes for now. Theme
      // changes only retune its palette rather than swapping to the fallback
      // BossManager renderer.
      this.abyssalBoss = new AbyssalHorrorBoss(this.health, theme);
      this.container.addChild(this.abyssalBoss);
    } else {
      // Never render the old low-detail fallback. Small fish use the restored
      // detailed rig rather than the crude tetra/fallback look.
      const visualType = type === 'small' ? 'medium' : type;
      this.animRig = SpriteSheetManager.getInstance().createFishAnimationRig(visualType, theme);
      this.container.addChild(this.animRig.container);

      if (type === 'small') {
        this.animRig.container.scale.set(0.72, 0.72);
      } else if (type === 'medium' && theme === 'light') {
        this.animRig.tint(0xa5f3fc);
      }

      this.animRig.playState(this.facing === 'left' ? 'swim_left' : 'swim_right');
    }

    this.container.x = this.x;
    this.container.y = this.y;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;

    if (this.typeId === 'boss') {
      if (!this.abyssalBoss) {
        this.abyssalBoss = new AbyssalHorrorBoss(this.health, theme);
        this.container.addChild(this.abyssalBoss);
      } else {
        this.abyssalBoss.setTheme(theme);
      }
      // Do not recreate or switch to BossManager when the theme changes.
      this.bossInstance?.destroy({ children: true });
      this.bossInstance = undefined;
    }

    if (this.animRig) {
      this.animRig.setTheme(theme);
      if (theme === 'light' && this.typeId === 'medium') this.animRig.tint(0xa5f3fc);
      else this.animRig.resetTint();
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

    if (this.typeId === 'boss') {
      const targetSpeed = 1.25;
      const targetVx = this.facing === 'left' ? -targetSpeed : targetSpeed;
      this.vx += (targetVx - this.vx) * 0.04 * dtScale;
      this.vy = Math.sin(Date.now() * 0.0018 + this.x * 0.008) * 0.95;
      this.x += this.vx * dtScale;
      this.y += this.vy * dtScale;

      if (this.x < -160) this.x = screenWidth + 140;
      else if (this.x > screenWidth + 160) this.x = -140;
      if (this.y < 90) this.y = 90;
      else if (this.y > screenHeight - 120) this.y = screenHeight - 120;

      this.container.x = this.x;
      this.container.y = this.y;
      this.bounds.x = this.x - this.width / 2;
      this.bounds.y = this.y - this.height / 2;
      this.bossInstance?.update(dtScale, this.vx, this.vy);
      this.abyssalBoss?.update(dtScale, this.vx, this.vy);
      return;
    }

    this.lodCounter++;
    let ax = this.cachedAx;
    let ay = this.cachedAy;
    const shouldRecalculateSteering = this.typeId !== 'small' || (this.lodCounter & 1) === 0 || threatX !== undefined;

    if (shouldRecalculateSteering) {
      const steering = BoidSwarmManager.computeSteering(this, neighbors, threatX, threatY);
      ax = steering.ax;
      ay = steering.ay;
      this.cachedAx = ax;
      this.cachedAy = ay;
    }

    if (threatX !== undefined && threatY !== undefined) {
      const tdx = this.x - threatX;
      const tdy = this.y - threatY;
      const tdistSq = tdx * tdx + tdy * tdy;
      const panicRadius = this.typeId === 'medium' ? 170 : 180;
      if (tdistSq > 0 && tdistSq < panicRadius * panicRadius) this.panicTimer = this.typeId === 'small' ? 50 : 35;
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
    const effectiveMaxSpeed = this.panicTimer > 0 ? weights.maxSpeed * 1.55 : weights.maxSpeed;
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

    const margin = 80;
    if (this.x < -margin) this.x = screenWidth + margin;
    else if (this.x > screenWidth + margin) this.x = -margin;
    if (this.y < -margin) this.y = screenHeight + margin;
    else if (this.y > screenHeight + margin) this.y = -margin;

    const newFacing = this.vx < -0.1 ? 'left' : this.vx > 0.1 ? 'right' : this.facing;
    if (newFacing !== this.facing) {
      this.facing = newFacing;
      this.animRig?.playState(this.facing === 'left' ? 'swim_left' : 'swim_right');
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.bounds.x = this.x - this.width / 2;
    this.bounds.y = this.y - this.height / 2;
  }

  public takeDamage(damage: number): boolean {
    if (!this.isAlive) return false;
    const amount = Math.max(0, damage);
    this.health = Math.max(0, this.health - amount);

    if (this.typeId === 'boss') {
      const dead = this.abyssalBoss?.takeDamage(amount) ?? false;
      if (dead) this.health = 0;
      return dead;
    }

    return this.health <= 0;
  }

  public kill(): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.animRig?.destroy({ children: true });
    this.bossInstance?.destroy({ children: true });
    this.abyssalBoss?.destroy({ children: true });
    this.animRig = undefined;
    this.bossInstance = undefined;
    this.abyssalBoss = undefined;
    this.container.destroy({ children: true });
  }

  public getCollisionRadius(): number {
    return this.typeId === 'boss' ? 110 : this.typeId === 'medium' ? 52 : 28;
  }
}
