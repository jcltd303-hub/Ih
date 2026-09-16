export interface EntityBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class QuadTreeNode {
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;
  public level: number = 0;
  
  public objects: EntityBounds[] = [];
  public children: QuadTreeNode[] | null = null;

  constructor() {}

  public init(x: number, y: number, width: number, height: number, level: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.level = level;
    this.objects.length = 0;
    this.children = null;
  }

  public clear(pool: QuadTreeNode[]): void {
    this.objects.length = 0;
    if (this.children) {
      for (let i = 0; i < 4; i++) {
        this.children[i].clear(pool);
        pool.push(this.children[i]);
      }
      this.children = null;
    }
  }

  /**
   * Helper to check if an entity fits entirely within a quadrant.
   * Quadrants:
   * 0: NW (Top-Left)
   * 1: NE (Top-Right)
   * 2: SW (Bottom-Left)
   * 3: SE (Bottom-Right)
   */
  public getIndex(entity: EntityBounds): number {
    const midX = this.x + this.width / 2;
    const midY = this.y + this.height / 2;

    const topQuadrant = (entity.y < midY) && (entity.y + entity.height < midY);
    const bottomQuadrant = (entity.y > midY);

    if (entity.x < midX && entity.x + entity.width < midX) {
      if (topQuadrant) return 0; // NW
      if (bottomQuadrant) return 2; // SW
    } else if (entity.x > midX) {
      if (topQuadrant) return 1; // NE
      if (bottomQuadrant) return 3; // SE
    }

    return -1; // Fits in multiple quadrants or intersects center lines, must remain in parent node
  }

  public split(pool: QuadTreeNode[]): void {
    const subWidth = this.width / 2;
    const subHeight = this.height / 2;
    const nextLevel = this.level + 1;

    // NW
    const nw = pool.pop() || new QuadTreeNode();
    nw.init(this.x, this.y, subWidth, subHeight, nextLevel);

    // NE
    const ne = pool.pop() || new QuadTreeNode();
    ne.init(this.x + subWidth, this.y, subWidth, subHeight, nextLevel);

    // SW
    const sw = pool.pop() || new QuadTreeNode();
    sw.init(this.x, this.y + subHeight, subWidth, subHeight, nextLevel);

    // SE
    const se = pool.pop() || new QuadTreeNode();
    se.init(this.x + subWidth, this.y + subHeight, subWidth, subHeight, nextLevel);

    this.children = [nw, ne, sw, se];
  }

  public insert(entity: EntityBounds, maxObjects: number, maxLevels: number, pool: QuadTreeNode[]): void {
    if (this.children) {
      const index = this.getIndex(entity);
      if (index !== -1) {
        this.children[index].insert(entity, maxObjects, maxLevels, pool);
        return;
      }
    }

    this.objects.push(entity);

    if (!this.children && this.objects.length > maxObjects && this.level < maxLevels) {
      this.split(pool);

      // Re-distribute existing objects into child nodes where they fit
      let i = 0;
      while (i < this.objects.length) {
        const obj = this.objects[i];
        const index = this.getIndex(obj);
        if (index !== -1 && this.children) {
          this.objects.splice(i, 1);
          this.children[index].insert(obj, maxObjects, maxLevels, pool);
        } else {
          i++;
        }
      }
    }
  }

  /**
   * Populate results with all entities that might collide with the query bounds.
   */
  public query(qx: number, qy: number, qWidth: number, qHeight: number, results: EntityBounds[]): void {
    // Check if the query rectangle intersects this node's bounds
    if (
      qx > this.x + this.width ||
      qx + qWidth < this.x ||
      qy > this.y + this.height ||
      qy + qHeight < this.y
    ) {
      return;
    }

    // Add objects in this node that overlap query bounds
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (
        qx < obj.x + obj.width &&
        qx + qWidth > obj.x &&
        qy < obj.y + obj.height &&
        qy + qHeight > obj.y
      ) {
        results.push(obj);
      }
    }

    // Recurse into children
    if (this.children) {
      for (let i = 0; i < 4; i++) {
        this.children[i].query(qx, qy, qWidth, qHeight, results);
      }
    }
  }
}

export class QuadTree {
  private root: QuadTreeNode;
  private pool: QuadTreeNode[] = [];
  private maxObjects: number;
  private maxLevels: number;
  private rootX: number;
  private rootY: number;
  private rootWidth: number;
  private rootHeight: number;
  private scratchResults: EntityBounds[] = [];

  constructor(
    rootX: number = -200,
    rootY: number = -200,
    rootWidth: number = 2400,
    rootHeight: number = 1600,
    maxObjects: number = 6,
    maxLevels: number = 5
  ) {
    this.rootX = rootX;
    this.rootY = rootY;
    this.rootWidth = rootWidth;
    this.rootHeight = rootHeight;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.root = new QuadTreeNode();
    this.root.init(rootX, rootY, rootWidth, rootHeight, 0);

    // Warm up the pool to avoid dynamic allocation peaks
    for (let i = 0; i < 128; i++) {
      this.pool.push(new QuadTreeNode());
    }
  }

  public clear(): void {
    this.root.clear(this.pool);
    this.root.init(this.rootX, this.rootY, this.rootWidth, this.rootHeight, 0);
  }

  public insert(entity: EntityBounds): void {
    this.root.insert(entity, this.maxObjects, this.maxLevels, this.pool);
  }

  public query(x: number, y: number, width: number, height: number): EntityBounds[] {
    this.scratchResults.length = 0;
    this.root.query(x, y, width, height, this.scratchResults);
    return this.scratchResults;
  }
}
