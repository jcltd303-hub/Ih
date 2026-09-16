import { Container } from 'pixi.js';
import { AbyssalHorrorBoss } from './AbyssalHorrorBoss';
import { MutantCutoutPuppet } from './MutantCutoutPuppet';
import { Tetra } from './Tetra';
import { BoidSwarmManager, Boid } from './BoidSwarmManager';
import { EntityBounds, SpatialHashGrid } from './SpatialHashGrid';

export class Fish implements Boid {
  public id: string;
  public typeId: 'small' | 'medium' | 'boss';
  public x: number; public y: number; public vx: number; public vy: number;
  public width: number; public height: number;
  public health: number; public maxHealth: number;
  public multiplier: number; public worth: number;
  public container: Container;
  public abyssalBoss?: AbyssalHorrorBoss;
  public mutantPuppet?: MutantCutoutPuppet;
  public tetraPuppet?: Tetra;
  public facing: 'left' | 'right' = 'right';
  public isAlive = true;
  public theme: 'light' | 'dark' = 'light';
  public hierarchy: 'NORMAL' | 'ELITE' | 'CRITICAL' | 'BOSS' = 'NORMAL';
  public bounds: EntityBounds;
  private maxSpeed: number; private maxForce: number;
  private panicTimer = 0; private lodCounter = Math.floor(Math.random() * 3);
  private cachedAx = 0; private cachedAy = 0;

  constructor(id: string, type: 'small' | 'medium' | 'boss', startX: number, startY: number,
    screenWidth: number, screenHeight: number, theme: 'light' | 'dark' = 'light', maxHpOverride?: number) {
    this.id = id; this.typeId = type; this.x = startX; this.y = startY; this.theme = theme;
    this.hierarchy = type === 'boss' ? 'BOSS' : (Math.random() < 0.1 ? 'CRITICAL' : (Math.random() < 0.25 ? 'ELITE' : 'NORMAL'));
    const isSmall = type === 'small', isBoss = type === 'boss';
    // Horror boss 20% larger (radius 135 vs 110)
    const radius = isBoss ? 135 : isSmall ? 28 : 55;
    this.width = radius * 2; this.height = radius * 1.3;
    this.maxSpeed = isBoss ? 1.6 : isSmall ? 3.8 : 2.4; this.maxForce = 0.25;
    const baseSpeed = isBoss ? 0.7 : isSmall ? Math.random() * 1.5 + 2 : Math.random() + 1.4;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * baseSpeed; this.vy = Math.sin(angle) * baseSpeed * 0.5;
    if (this.x < 0) this.vx = Math.abs(this.vx) || baseSpeed;
    else if (this.x > screenWidth) this.vx = -(Math.abs(this.vx) || baseSpeed);
    this.facing = this.vx < 0 ? 'left' : 'right';
    this.health = isBoss ? (maxHpOverride ?? 28) : isSmall ? 2 : 6;
    this.maxHealth = this.health; this.multiplier = isBoss ? 25 : isSmall ? 1.2 : 4; this.worth = this.multiplier;
    this.bounds = { id, x: this.x - this.width / 2, y: this.y - this.height / 2, width: this.width, height: this.height };
    this.container = new Container();

    if (isBoss) {
      // 1. Horror Boss: Articulated 2D paper cutout rig (20% larger, targetSize 300)
      this.abyssalBoss = new AbyssalHorrorBoss(this.health, theme, 300);
      this.abyssalBoss.setFacing(this.facing);
      this.container.addChild(this.abyssalBoss);
    } else if (type === 'medium') {
      // 2. Mutant Fish: Articulated 2D paper cutout rigged puppet
      this.mutantPuppet = new MutantCutoutPuppet(this.health, theme, 140);
      this.mutantPuppet.setFacing(this.facing);
      this.container.addChild(this.mutantPuppet);
    } else {
      // 3. New Tetra: Articulated 2D paper cutout rigged puppet
      this.tetraPuppet = Tetra.create(this.health, theme);
      this.tetraPuppet.setFacing(this.facing);
      this.container.addChild(this.tetraPuppet);
    }
    this.container.x = this.x; this.container.y = this.y;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    if (this.typeId === 'boss') {
      if (!this.abyssalBoss) {
        this.abyssalBoss = new AbyssalHorrorBoss(this.health, theme, 300);
        this.container.addChild(this.abyssalBoss);
      } else {
        this.abyssalBoss.setTheme(theme);
      }
    }
    if (this.mutantPuppet) {
      this.mutantPuppet.setTheme(theme);
    }
    if (this.tetraPuppet) {
      this.tetraPuppet.setTheme(theme);
    }
  }

  public updateSteering(
    spatialGrid: SpatialHashGrid,
    activeFishMap: Map<string, Fish>,
    screenWidth: number,
    screenHeight: number,
    threatX?: number,
    threatY?: number,
    dtScale = 1
  ): void {
    if (!this.isAlive) return;
    if (this.typeId === 'boss') {
      const targetSpeed = 1.25, targetVx = this.facing === 'left' ? -targetSpeed : targetSpeed;
      this.vx += (targetVx - this.vx) * 0.04 * dtScale;
      this.vy = Math.sin(Date.now() * 0.0018 + this.x * 0.008) * 0.95;
      this.x += this.vx * dtScale; this.y += this.vy * dtScale;
      if (this.x < -160) this.x = screenWidth + 140; else if (this.x > screenWidth + 160) this.x = -140;
      this.y = Math.max(90, Math.min(screenHeight - 120, this.y));
      this.container.x = this.x; this.container.y = this.y;
      this.bounds.x = this.x - this.width / 2; this.bounds.y = this.y - this.height / 2;
      this.abyssalBoss?.setFacing(this.facing);
      this.abyssalBoss?.update(dtScale, this.vx, this.vy);
      return;
    }
    this.lodCounter++;
    let ax = this.cachedAx, ay = this.cachedAy;
    if (this.typeId !== 'small' || (this.lodCounter & 1) === 0 || threatX !== undefined) {
      // Query spatial hash grid around this fish's current position (sensing radius ~160px)
      const radius = 160;
      const queryResults = spatialGrid.query(this.x - radius, this.y - radius, radius * 2, radius * 2);
      
      // Resolve bounds to neighbor Fish objects
      const neighbors: Fish[] = [];
      for (let i = 0; i < queryResults.length; i++) {
        const nf = activeFishMap.get(queryResults[i].id);
        if (nf && nf !== this && nf.isAlive) {
          neighbors.push(nf);
        }
      }

      const steering = BoidSwarmManager.computeSteering(this, neighbors, threatX, threatY); 
      ax = steering.ax; 
      ay = steering.ay; 
      this.cachedAx = ax; 
      this.cachedAy = ay;
    }
    if (threatX !== undefined && threatY !== undefined) {
      const dx = this.x - threatX, dy = this.y - threatY, ds = dx * dx + dy * dy, r = this.typeId === 'medium' ? 170 : 180;
      if (ds > 0 && ds < r * r) this.panicTimer = this.typeId === 'small' ? 50 : 35;
    }
    let extraX = 0, extraY = 0;
    if (this.panicTimer > 0) { this.panicTimer--; extraX = (Math.random() - 0.5) * 1.9; extraY = (Math.random() - 0.5) * 1.9; }
    this.vx += (ax + extraX) * dtScale; this.vy += (ay + extraY) * dtScale;
    const weights = BoidSwarmManager.getWeights(this.typeId), speedSq = this.vx * this.vx + this.vy * this.vy;
    const maxSpeed = (this.panicTimer > 0 ? weights.maxSpeed * 1.55 : weights.maxSpeed), maxSq = maxSpeed * maxSpeed;
    if (speedSq > maxSq) { const s = Math.sqrt(speedSq); this.vx = this.vx / s * maxSpeed; this.vy = this.vy / s * maxSpeed; }
    else if (speedSq < 0.64) { const s = Math.sqrt(speedSq) || 0.001; this.vx = this.vx / s * 1.15; this.vy = this.vy / s * 1.15; }
    this.x += this.vx * dtScale; this.y += this.vy * dtScale;
    const margin = 80;
    if (this.x < -margin) this.x = screenWidth + margin; else if (this.x > screenWidth + margin) this.x = -margin;
    if (this.y < -margin) this.y = screenHeight + margin; else if (this.y > screenHeight + margin) this.y = -margin;
    const newFacing = this.vx < -0.1 ? 'left' : this.vx > 0.1 ? 'right' : this.facing;
    if (newFacing !== this.facing) {
      this.facing = newFacing;
      this.mutantPuppet?.setFacing(this.facing);
      this.tetraPuppet?.setFacing(this.facing);
      this.abyssalBoss?.setFacing(this.facing);
    }
    this.container.x = this.x; this.container.y = this.y;
    this.bounds.x = this.x - this.width / 2; this.bounds.y = this.y - this.height / 2;
    this.mutantPuppet?.update(dtScale * 16.6);
    this.tetraPuppet?.update(dtScale * 16.6);
    this.abyssalBoss?.update(dtScale, this.vx, this.vy);
  }

  public takeDamage(damage: number): boolean {
    if (!this.isAlive) return false;
    const amount = Math.max(0, damage);
    this.health = Math.max(0, this.health - amount);
    if (this.typeId === 'boss') { const dead = this.abyssalBoss?.takeDamage(amount) ?? false; if (dead) this.health = 0; return dead; }
    if (this.typeId === 'medium') { this.mutantPuppet?.takeDamage(amount); }
    if (this.typeId === 'small') { this.tetraPuppet?.takeDamage(amount); }
    // Trash fish are purely RNG-killed in the new Payout Engine to enforce strict RTP bounds.
    return false;
  }

  public inflictDamage(damage: number, forceInstantKill = false): { killed: boolean; multiplier: number; x: number; y: number } {
    if (!this.isAlive) return { killed: false, multiplier: 0, x: this.x, y: this.y };
    const killed = forceInstantKill ? true : this.takeDamage(damage);
    if (forceInstantKill) this.health = 0;
    return { killed, multiplier: killed ? this.multiplier : 0, x: this.x, y: this.y };
  }

  public kill(): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.health = 0;
    this.container.visible = false;
    this.container.renderable = false;
    this.container.alpha = 0;

    const parent = this.container.parent;
    if (parent) parent.removeChild(this.container);

    this.tetraPuppet?.destroy({ children: true });
    this.mutantPuppet?.destroy();
    this.abyssalBoss?.destroy({ children: true });
    this.tetraPuppet = undefined;
    this.mutantPuppet = undefined;
    this.abyssalBoss = undefined;
    this.container.destroy({ children: true });
  }

  public getCollisionRadius(): number { return this.typeId === 'boss' ? 135 : this.typeId === 'medium' ? 52 : 28; }
}
