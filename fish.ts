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
      this.bossInstance = new BossManager(this.health, theme);
      this.container.addChild(this.bossInstance);
    } else {
      this.graphics = this.createFallbackGraphic(type, theme);
      this.container.addChild(this.graphics);

      this.animRig = SpriteSheetManager.getInstance().createFishAnimationRig(type, theme);
      this.container.addChild(this.animRig.container);

      if (type === 'medium' && theme === 'light') {
        this.animRig.tint(0xa5f3fc);
      }

      this.animRig.playState(this.facing === 'left' ? 'swim_left' : 'swim_right');
    }

    this.container.x = this.x;
    this.container.y = this.y;
  }

  private createFallbackGraphic(type: 'small' | 'medium', theme: 'light' | 'dark'): Graphics {
    const g = new Graphics();
    const small = type === 'small';
    const bodyW = small ? 25 : 46;
    const bodyH = small ? 14 : 28;
    const tail = small ? 13 : 22;
    const fill = theme === 'dark' ? 0x0f172a : 0x064e6b;
    const stroke = theme === 'dark' ? 0xf472b6 : 0x67e8f9;
    const glow = theme === 'dark' ? 0xa855f7 : 0x22d3ee;

    g.circle(0, 0, bodyW + 8);
    g.fill({ color: glow, alpha: 0.12 });

    g.ellipse(0, 0, bodyW, bodyH);
    g.fill({ color: fill, alpha: 0.9 });
    g.stroke({ width: small ? 1.5 : 2, color: stroke, alpha: 0.95 });

    g.moveTo(bodyW - 2, 0);
    g.lineTo(bodyW + tail, -bodyH * 0.95);
    g.lineTo(bodyW + tail, bodyH * 0.95);
    g.closePath();
    g.fill({ color: fill, alpha: 0.85 });
    g.stroke({ width: 1.2, color: stroke, alpha: 0.88 });

    g.moveTo(-bodyW * 0.15, -bodyH * 0.7);
    g.lineTo(bodyW * 0.18, -bodyH * 1.45);
    g.lineTo(bodyW * 0.4, -bodyH * 0.62);
    g.closePath();
    g.fill({ color: stroke, alpha: 0.32 });

    g.ellipse(-bodyW * 0.55, -bodyH * 0.18, small ? 2.4 : 3.4, small ? 2.4 : 3.4);
    g.fill({ color: 0xffffff, alpha: 0.95 });
    g.circle(-bodyW * 0.52, -bodyH * 0.18, small ? 1 : 1.3);
    g.fill({ color: theme === 'dark' ? 0xfb7185 : 0x020617, alpha: 1 });

    g.moveTo(-bodyW * 0.08, bodyH * 0.3);
    g.lineTo(bodyW * 0.16, bodyH * 0.54);
    g.lineTo(bodyW * 0.3, bodyH * 0.22);
    g.stroke({ width: 1.1, color: theme === 'dark' ? 0xf9a8d4 : 0x0ea5e9, alpha: 0.7 });

    g.alpha = 0.98;
    return g;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    if (this.animRig) {
      this.animRig.setTheme(theme);
      if (theme === 'light' && this.typeId === 'medium') this.animRig.tint(0xa5f3fc);
      else this.animRig.resetTint();
    }
    if (this.bossInstance) this.bossInstance.setTheme(theme);
    if (this.graphics && (this.typeId === 'small' || this.typeId === 'medium')) {
      this.graphics.destroy();
      this.graphics = this.createFallbackGraphic(this.typeId, theme);
      this.container.removeChildren();
      this.container.addChild(this.graphics);
      if (this.animRig) this.container.addChild(this.animRig.container);
      if (this.bossInstance) this.container.addChild(this.bossInstance);
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
      this.y = Math.max(60, Math.min(screenHeight - 70, this.y));
      this.facing = this.vx < 0 ? 'left' : 'right';
      if (this.bossInstance) this.bossInstance.update(dtScale, this.vx, this.vy);
      return;
    }

    const speedBias = this.typeId === 'small' ? 1.0 : 0.75;
    const maxSpeed = this.maxSpeed * speedBias;
    const centerX = screenWidth * 0.5;
    const centerY = screenHeight * 0.48;
    const wobble = Math.sin(Date.now() * 0.001 + this.id.length) * 0.18;

    const seekX = (centerX - this.x) * 0.0012;
    const seekY = (centerY - this.y) * 0.0010 + wobble;
    this.cachedAx = this.cachedAx * 0.82 + seekX;
    this.cachedAy = this.cachedAy * 0.82 + seekY;

    this.vx += Math.max(-this.maxForce, Math.min(this.maxForce, this.cachedAx)) * dtScale;
    this.vy += Math.max(-this.maxForce, Math.min(this.maxForce, this.cachedAy)) * dtScale;

    const mag = Math.hypot(this.vx, this.vy);
    if (mag > maxSpeed) {
      this.vx = (this.vx / mag) * maxSpeed;
      this.vy = (this.vy / mag) * maxSpeed;
    }

    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    this.x = Math.max(-60, Math.min(screenWidth + 60, this.x));
    this.y = Math.max(50, Math.min(screenHeight - 50, this.y));
    this.facing = this.vx < 0 ? 'left' : 'right';

    if (this.animRig) {
      this.animRig.playState(this.facing === 'left' ? 'swim_left' : 'swim_right');
      this.animRig.container.alpha = this.typeId === 'medium' ? 0.98 : 1;
    }
  }
}
