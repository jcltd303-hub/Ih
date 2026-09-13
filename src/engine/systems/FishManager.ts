import { Container } from 'pixi.js';
import { SpatialHashGrid, EntityBounds } from './SpatialHashGrid';
import { Fish } from './Fish';

export type FishEntity = Fish;

export class FishManager {
  private stage: Container;
  private spatialGrid: SpatialHashGrid;
  private activeFish: Map<string, Fish> = new Map();
  private screenWidth: number;
  private screenHeight: number;
  private fishIdCounter = 0;

  constructor(stage: Container, spatialGrid: SpatialHashGrid, screenWidth: number, screenHeight: number) {
    this.stage = stage;
    this.spatialGrid = spatialGrid;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Initial seed wave
    for (let i = 0; i < 6; i++) {
      this.spawnRandomWave();
    }
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  public spawnFish(type: 'small' | 'medium' | 'boss' = 'small'): Fish {
    this.fishIdCounter++;
    const id = `fish_${this.fishIdCounter}`;

    const isLeftToRight = Math.random() > 0.45;
    const startX = isLeftToRight ? -100 : this.screenWidth + 100;
    const startY = Math.random() * (this.screenHeight * 0.6) + 80;

    const fish = new Fish(id, type, startX, startY, this.screenWidth, this.screenHeight);
    this.stage.addChild(fish.container);

    this.activeFish.set(id, fish);
    return fish;
  }

  public spawnRandomWave(): void {
    if (this.activeFish.size >= 12) return;

    // Guarantee only one active boss at any time
    const hasBoss = Array.from(this.activeFish.values()).some(f => f.typeId === 'boss' && f.isAlive);
    const roll = Math.random();
    if (roll > 0.90 && !hasBoss) {
      this.spawnFish('boss');
    } else if (roll > 0.45) {
      this.spawnFish('medium');
    } else {
      this.spawnFish('small');
    }
  }

  public update(deltaTime: number, threatX?: number, threatY?: number): void {
    const dtScale = Math.min(deltaTime * 0.06, 2.5);
    const fishArray = Array.from(this.activeFish.values());

    for (const fish of fishArray) {
      if (!fish.isAlive) continue;

      // Pass neighboring fish for steering/flocking behaviors
      fish.updateSteering(fishArray, this.screenWidth, this.screenHeight, threatX, threatY, dtScale);

      const bounds: EntityBounds = {
        id: fish.id,
        x: fish.x - fish.width / 2,
        y: fish.y - fish.height / 2,
        width: fish.width,
        height: fish.height
      };

      this.spatialGrid.insert(bounds);
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
  }

  public getActiveCount(): number {
    return this.activeFish.size;
  }
}
