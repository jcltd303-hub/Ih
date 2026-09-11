import { Container } from 'pixi.js';

/**
 * Generic Object Pool for PixiJS entities (bullets, fish, effects)
 * Prevents GC spikes to maintain a rock-solid 60 FPS.
 */
export class ObjectPool<T extends Container> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn: (item: T) => void;

  constructor(factory: () => T, resetFn: (item: T) => void, initialSize: number = 50) {
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.visible = false;
      this.pool.push(item);
    }
  }

  public acquire(): T {
    const item = this.pool.length > 0 ? this.pool.pop()! : this.factory();
    item.visible = true;
    return item;
  }

  public release(item: T): void {
    item.visible = false;
    this.resetFn(item);
    this.pool.push(item);
  }

  public get size(): number {
    return this.pool.length;
  }
}
