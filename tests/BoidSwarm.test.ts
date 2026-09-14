import { describe, it, expect } from 'vitest';
import { BoidSwarmManager, Boid } from '../src/engine/systems/BoidSwarmManager';

function makeBoid(id: string, x: number, y: number, vx = 1, vy = 0, typeId: Boid['typeId'] = 'small'): Boid {
  return { id, x, y, vx, vy, typeId };
}

describe('BoidSwarmManager', () => {
  it('returns type-specific weights', () => {
    const small = BoidSwarmManager.getWeights('small');
    const medium = BoidSwarmManager.getWeights('medium');
    const boss = BoidSwarmManager.getWeights('boss');

    expect(small.maxSpeed).toBeGreaterThan(medium.maxSpeed);
    expect(medium.maxSpeed).toBeGreaterThan(boss.maxSpeed);
    expect(small.separation).toBeGreaterThan(boss.separation);
    expect(small.alignment).toBeGreaterThan(0);
    expect(small.cohesion).toBeGreaterThan(0);
  });

  it('applies separation when two small boids overlap', () => {
    const a = makeBoid('a', 100, 100, 0, 0);
    const b = makeBoid('b', 105, 100, 0, 0);
    const { ax, ay } = BoidSwarmManager.computeSteering(a, [a, b]);

    // a should be pushed left (away from b on the right)
    expect(ax).toBeLessThan(0);
    expect(Math.abs(ay)).toBeLessThan(Math.abs(ax) + 0.5);
  });

  it('applies alignment toward neighbor velocity', () => {
    const a = makeBoid('a', 200, 200, 0, 0);
    const b = makeBoid('b', 220, 200, 2, 0);
    const { ax } = BoidSwarmManager.computeSteering(a, [a, b]);

    // steer toward neighbor's +vx
    expect(ax).toBeGreaterThan(0);
  });

  it('applies threat evasion away from crosshair', () => {
    const a = makeBoid('a', 300, 300, 0, 0);
    const { ax, ay } = BoidSwarmManager.computeSteering(a, [a], 310, 300);

    // threat is to the right → flee left
    expect(ax).toBeLessThan(0);
    expect(Number.isFinite(ay)).toBe(true);
  });

  it('clamps steering force to maxForce', () => {
    const w = BoidSwarmManager.getWeights('small');
    const a = makeBoid('a', 0, 0, 0, 0);
    // many close neighbors to amplify separation
    const flock: Boid[] = [a];
    for (let i = 1; i < 12; i++) {
      flock.push(makeBoid(`n${i}`, i * 2, 0));
    }
    const { ax, ay } = BoidSwarmManager.computeSteering(a, flock);
    const mag = Math.sqrt(ax * ax + ay * ay);
    expect(mag).toBeLessThanOrEqual(w.maxForce + 1e-6);
  });

  it('updateFlock moves boids and respects max speed', () => {
    const boids: Boid[] = [
      makeBoid('a', 50, 100, 10, 0), // overspeeding
      makeBoid('b', 80, 100, 1, 0)
    ];
    BoidSwarmManager.updateFlock(boids, 800, 600);
    const speedA = Math.sqrt(boids[0].vx ** 2 + boids[0].vy ** 2);
    expect(speedA).toBeLessThanOrEqual(BoidSwarmManager.getWeights('small').maxSpeed + 1e-6);
    expect(boids[0].x).not.toBe(50);
  });

  it('boss weights are more sluggish than small tetras', () => {
    const small = BoidSwarmManager.getWeights('small');
    const boss = BoidSwarmManager.getWeights('boss');
    expect(boss.maxForce).toBeLessThan(small.maxForce);
    expect(boss.neighborRadius).toBeGreaterThan(small.neighborRadius);
  });
});
