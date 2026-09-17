import { Container } from 'pixi.js';
import { SpatialHashGrid } from './SpatialHashGrid';
import { Fish } from './Fish';
import { SoundManager } from '../../audio/SoundManager';
import { GameConfig } from '../../config/GameConfig';

export type FishEntity = Fish;

export class FishManager {
  private stage: Container;
  private spatialGrid: SpatialHashGrid;
  private activeFish: Map<string, Fish> = new Map();
  private activeFishList: Fish[] = [];
  private screenWidth: number;
  private screenHeight: number;
  private fishIdCounter = 0;
  private currentTheme: 'light' | 'dark' = 'light';

  constructor(stage: Container, spatialGrid: SpatialHashGrid, screenWidth: number, screenHeight: number) {
    this.stage = stage;
    this.spatialGrid = spatialGrid;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Seed initial school directly on screen so the tank is immediately populated with swimming fish
    this.seedInitialFish();
  }

  private seedInitialFish(): void {
    const w = this.screenWidth > 0 ? this.screenWidth : 800;
    const h = this.screenHeight > 0 ? this.screenHeight : 600;

    // Spawn 3 medium mutant fish nicely spaced across the tank
    for (let i = 0; i < 3; i++) {
      const x = 50 + Math.random() * Math.max(80, w - 100);
      const y = 90 + Math.random() * Math.max(80, h * 0.55);
      this.spawnAt('medium', x, y);
    }

    // Spawn 6 small tetra fish spread across the water
    for (let i = 0; i < 6; i++) {
      const x = 40 + Math.random() * Math.max(80, w - 80);
      const y = 80 + Math.random() * Math.max(80, h * 0.6);
      this.spawnAt('small', x, y);
    }
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    for (let i = 0; i < this.activeFishList.length; i++) {
      this.activeFishList[i].setTheme(theme);
    }
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  public spawnFish(type: 'small' | 'medium' = 'small', maxHpOverride?: number): Fish {
    this.fishIdCounter++;
    const id = `fish_${this.fishIdCounter}`;

    const isLeftToRight = Math.random() > 0.45;
    const startX = isLeftToRight ? -100 : this.screenWidth + 100;
    const startY = Math.random() * (this.screenHeight * 0.6) + 80;

    const fish = new Fish(id, type, startX, startY, this.screenWidth, this.screenHeight, this.currentTheme, maxHpOverride);
    this.stage.addChild(fish.container);

    this.activeFish.set(id, fish);
    this.activeFishList.push(fish);
    return fish;
  }

  public spawnAt(type: 'small' | 'medium', x: number, y: number, maxHpOverride?: number): Fish {
    this.fishIdCounter++;
    const id = `fish_${this.fishIdCounter}`;
    const fish = new Fish(id, type, x, y, this.screenWidth, this.screenHeight, this.currentTheme, maxHpOverride);
    this.stage.addChild(fish.container);
    this.activeFish.set(id, fish);
    this.activeFishList.push(fish);
    return fish;
  }

  public spawnBoss(maxHp: number): Fish {
    this.fishIdCounter++;
    const id = `boss_${this.fishIdCounter}`;
    const isLeftToRight = Math.random() > 0.45;
    const startX = isLeftToRight ? -140 : this.screenWidth + 140;
    const startY = Math.random() * (this.screenHeight * 0.4) + 100;

    const fish = new Fish(id, 'boss', startX, startY, this.screenWidth, this.screenHeight, this.currentTheme, maxHp);
    this.stage.addChild(fish.container);
    this.activeFish.set(id, fish);
    this.activeFishList.push(fish);
    return fish;
  }

  public spawnRandomWave(): void {
    if (this.activeFish.size >= GameConfig.maxActiveFish) return;

    // Boss is progress/raid-gated only — never from random waves
    const roll = Math.random();
    if (roll > 0.55) {
      this.spawnFish('medium');
    } else {
      // Spawn a small school for visible flocking
      const span = GameConfig.schoolSizeMax - GameConfig.schoolSizeMin + 1;
      const schoolSize = GameConfig.schoolSizeMin + Math.floor(Math.random() * span);
      for (let i = 0; i < schoolSize && this.activeFish.size < GameConfig.maxActiveFish; i++) {
        this.spawnFish('small');
      }
    }
  }

  public update(deltaTime: number, threatX?: number, threatY?: number): void {
    const dtScale = Math.min(deltaTime * 0.06, 2.5);
    const list = this.activeFishList;

    // 1. Populate spatial grid with all alive fish first so that steering can query it
    for (let i = 0; i < list.length; i++) {
      const fish = list[i];
      if (fish.isAlive) {
        this.spatialGrid.insert(fish.bounds);
      }
    }

    // 2. Perform steering and position updates querying the spatial grid
    for (let i = 0; i < list.length; i++) {
      const fish = list[i];
      if (!fish.isAlive) continue;

      fish.updateSteering(
        this.spatialGrid,
        this.activeFish,
        this.screenWidth,
        this.screenHeight,
        threatX,
        threatY,
        dtScale
      );
    }
  }

  public inflictDamage(fishId: string, damage: number, forceInstantKill: boolean = false): { killed: boolean; multiplier: number; x: number; y: number } {
    const fish = this.activeFish.get(fishId);
    if (!fish || !fish.isAlive) return { killed: false, multiplier: 0, x: 0, y: 0 };

    const result = fish.inflictDamage(damage, forceInstantKill);
    if (result.killed) {
      this.killFish(fishId);
    }
    return result;
  }

  public getFish(fishId: string): Fish | undefined {
    return this.activeFish.get(fishId);
  }

  public killFish(fishId: string): void {
    const fish = this.activeFish.get(fishId);
    if (!fish) return;
    fish.kill();
    this.activeFish.delete(fishId);
    const idx = this.activeFishList.indexOf(fish);
    if (idx !== -1) {
      this.activeFishList.splice(idx, 1);
    }
  }

  public getActiveCount(): number {
    return this.activeFish.size;
  }
}
