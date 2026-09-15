export interface EntityBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Bounds = EntityBounds;

/**
 * High-performance 2D Spatial Hash Grid with zero allocations per frame.
 * Uses 32-bit integer polynomial hashing and recycled bucket/query buffers.
 */
export class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<number, EntityBounds[]> = new Map();
  private activeKeys: number[] = [];
  private scratchResults: EntityBounds[] = [];
  private scratchVisited: Set<string> = new Set();

  constructor(cellSize: number = 128) {
    this.cellSize = cellSize;
  }

  public clear(): void {
    for (let i = 0; i < this.activeKeys.length; i++) {
      const bucket = this.cells.get(this.activeKeys[i]);
      if (bucket) bucket.length = 0;
    }
    this.activeKeys.length = 0;
  }

  /**
   * Fast 32-bit integer spatial hash (zero string allocations).
   */
  private getCellKey(cx: number, cy: number): number {
    return ((cx * 73856093) ^ (cy * 19349663)) | 0;
  }

  public insert(entity: EntityBounds): void {
    const startX = Math.floor(entity.x / this.cellSize);
    const endX = Math.floor((entity.x + entity.width) / this.cellSize);
    const startY = Math.floor(entity.y / this.cellSize);
    const endY = Math.floor((entity.y + entity.height) / this.cellSize);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = this.getCellKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        if (bucket.length === 0) {
          this.activeKeys.push(key);
        }
        bucket.push(entity);
      }
    }
  }

  public query(x: number, y: number, width: number = 20, height: number = 20): EntityBounds[] {
    this.scratchResults.length = 0;
    this.scratchVisited.clear();

    const startX = Math.floor(x / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = this.getCellKey(cx, cy);
        const bucket = this.cells.get(key);
        if (bucket && bucket.length > 0) {
          for (let i = 0; i < bucket.length; i++) {
            const entity = bucket[i];
            if (!this.scratchVisited.has(entity.id)) {
              this.scratchVisited.add(entity.id);
              if (
                x < entity.x + entity.width &&
                x + width > entity.x &&
                y < entity.y + entity.height &&
                y + height > entity.y
              ) {
                this.scratchResults.push(entity);
              }
            }
          }
        }
      }
    }
    return this.scratchResults;
  }
}
