export interface EntityBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Bounds = EntityBounds;

/**
 * Lightweight 2D Spatial Hash Grid for fast O(1) collision detection
 * between bullets and swimming targets.
 */
export class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<string, EntityBounds[]> = new Map();

  constructor(cellSize: number = 128) {
    this.cellSize = cellSize;
  }

  public clear(): void {
    this.cells.clear();
  }

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  public insert(entity: EntityBounds): void {
    const startX = Math.floor(entity.x / this.cellSize);
    const endX = Math.floor((entity.x + entity.width) / this.cellSize);
    const startY = Math.floor(entity.y / this.cellSize);
    const endY = Math.floor((entity.y + entity.height) / this.cellSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        if (!this.cells.has(key)) {
          this.cells.set(key, []);
        }
        this.cells.get(key)!.push(entity);
      }
    }
  }

  public query(x: number, y: number, width: number = 20, height: number = 20): EntityBounds[] {
    const results: EntityBounds[] = [];
    const visited = new Set<string>();

    const startX = Math.floor(x / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (bucket) {
          for (const entity of bucket) {
            if (!visited.has(entity.id)) {
              visited.add(entity.id);
              if (
                x < entity.x + entity.width &&
                x + width > entity.x &&
                y < entity.y + entity.height &&
                y + height > entity.y
              ) {
                results.push(entity);
              }
            }
          }
        }
      }
    }
    return results;
  }
}
