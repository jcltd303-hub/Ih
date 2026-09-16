import { QuadTree, EntityBounds } from './QuadTree';

export type { EntityBounds };
export type Bounds = EntityBounds;

/**
 * Backward-compatible SpatialHashGrid wrapper that inherits from our high-performance QuadTree.
 * Under the hood, this converts the entire spatial querying system to O(N log N) QuadTree partitioning,
 * delivering exceptional frame rates in high-fish-count scenes.
 */
export class SpatialHashGrid extends QuadTree {
  constructor(cellSize: number = 128) {
    // Initialize the QuadTree root boundary with wide margins covering the active play area
    super(-400, -400, 2800, 2000, 6, 5);
  }
}

