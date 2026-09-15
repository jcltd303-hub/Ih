/**
 * Full Reynolds flocking (separation + alignment + cohesion)
 * with type-aware weights and threat evasion.
 * Used by small/medium schools; bosses use independent pathing.
 */
export interface Boid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  typeId?: 'small' | 'medium' | 'boss';
}

export interface FlockWeights {
  separation: number;
  alignment: number;
  cohesion: number;
  separationRadius: number;
  neighborRadius: number;
  maxSpeed: number;
  maxForce: number;
}

const DEFAULT_WEIGHTS: Record<'small' | 'medium' | 'boss', FlockWeights> = {
  small: {
    separation: 1.6,
    alignment: 1.1,
    cohesion: 0.85,
    separationRadius: 42,
    neighborRadius: 95,
    maxSpeed: 3.6,
    maxForce: 0.28
  },
  medium: {
    separation: 1.2,
    alignment: 0.7,
    cohesion: 0.45,
    separationRadius: 55,
    neighborRadius: 110,
    maxSpeed: 2.5,
    maxForce: 0.2
  },
  boss: {
    separation: 0.4,
    alignment: 0.15,
    cohesion: 0.1,
    separationRadius: 90,
    neighborRadius: 140,
    maxSpeed: 1.7,
    maxForce: 0.12
  }
};

export class BoidSwarmManager {
  public static getWeights(typeId: 'small' | 'medium' | 'boss' = 'small'): FlockWeights {
    return DEFAULT_WEIGHTS[typeId] ?? DEFAULT_WEIGHTS.small;
  }

  /**
   * Compute steering forces for a single boid given the full flock.
   * Returns { ax, ay } acceleration to apply (caller handles integration).
   */
  public static computeSteering(
    boid: Boid,
    flock: Boid[],
    threatX?: number,
    threatY?: number
  ): { ax: number; ay: number } {
    const type = boid.typeId ?? 'small';
    const w = this.getWeights(type);

    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohX = 0;
    let cohY = 0;
    let sepCount = 0;
    let neighborCount = 0;
    let cohCount = 0;

    for (let j = 0; j < flock.length; j++) {
      const other = flock[j];
      if (other.id === boid.id) continue;

      const dx = boid.x - other.x;
      const dy = boid.y - other.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0) continue;
      const dist = Math.sqrt(distSq);

      // Separation (close range, inverse-distance weighted)
      if (dist < w.separationRadius) {
        const inv = 1 / dist;
        sepX += (dx / dist) * inv;
        sepY += (dy / dist) * inv;
        sepCount++;
      }

      // Alignment + cohesion (wider neighborhood, prefer same-ish size)
      if (dist < w.neighborRadius) {
        const sameSchool =
          !other.typeId || !boid.typeId || other.typeId === boid.typeId ||
          (boid.typeId === 'small' && other.typeId === 'medium') ||
          (boid.typeId === 'medium' && other.typeId === 'small');
        if (sameSchool) {
          aliX += other.vx;
          aliY += other.vy;
          neighborCount++;

          // Cohesion only applies outside the separation radius. Neighbors
          // close enough to trigger separation shouldn't also be pulled
          // together by cohesion — the two forces fought each other and
          // let overlapping boids stay overlapped indefinitely.
          if (dist >= w.separationRadius) {
            cohX += other.x;
            cohY += other.y;
            cohCount++;
          }
        }
      }
    }

    let ax = 0;
    let ay = 0;

    if (sepCount > 0) {
      ax += (sepX / sepCount) * w.separation;
      ay += (sepY / sepCount) * w.separation;
    }

    if (neighborCount > 0) {
      // Alignment: steer toward average velocity
      aliX /= neighborCount;
      aliY /= neighborCount;
      ax += (aliX - boid.vx) * w.alignment;
      ay += (aliY - boid.vy) * w.alignment;
    }

    if (cohCount > 0) {
      // Cohesion: steer toward average position of non-overlapping neighbors
      cohX = cohX / cohCount - boid.x;
      cohY = cohY / cohCount - boid.y;
      const cDist = Math.sqrt(cohX * cohX + cohY * cohY);
      if (cDist > 0.001) {
        ax += (cohX / cDist) * w.cohesion;
        ay += (cohY / cDist) * w.cohesion;
      }
    }

    // Threat evasion (crosshair / projectiles)
    if (threatX !== undefined && threatY !== undefined) {
      const tdx = boid.x - threatX;
      const tdy = boid.y - threatY;
      const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
      const threatRadius = type === 'boss' ? 200 : type === 'medium' ? 160 : 140;
      if (tdist > 0 && tdist < threatRadius) {
        const strength = (1 - tdist / threatRadius) * (type === 'small' ? 2.8 : type === 'medium' ? 2.0 : 1.2);
        ax += (tdx / tdist) * strength;
        ay += (tdy / tdist) * strength;
      }
    }

    // Clamp force
    const forceMag = Math.sqrt(ax * ax + ay * ay);
    if (forceMag > w.maxForce) {
      ax = (ax / forceMag) * w.maxForce;
      ay = (ay / forceMag) * w.maxForce;
    }

    return { ax, ay };
  }

  /** Legacy batch update kept for any external callers */
  public static updateFlock(
    boids: Boid[],
    screenWidth: number,
    screenHeight: number,
    threatX?: number,
    threatY?: number
  ): void {
    for (let i = 0; i < boids.length; i++) {
      const boid = boids[i];
      const type = boid.typeId ?? 'small';
      const w = this.getWeights(type);
      const { ax, ay } = this.computeSteering(boid, boids, threatX, threatY);

      boid.vx += ax;
      boid.vy += ay;

      const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
      if (speed > w.maxSpeed) {
        boid.vx = (boid.vx / speed) * w.maxSpeed;
        boid.vy = (boid.vy / speed) * w.maxSpeed;
      }

      boid.x += boid.vx;
      boid.y += boid.vy;

      if (boid.x < -60) boid.x = screenWidth + 60;
      if (boid.x > screenWidth + 60) boid.x = -60;
      if (boid.y < 60) boid.y = screenHeight - 120;
      if (boid.y > screenHeight - 100) boid.y = 80;
    }
  }
}
