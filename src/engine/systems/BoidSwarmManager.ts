export interface Boid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class BoidSwarmManager {
  public static updateFlock(
    boids: Boid[],
    screenWidth: number,
    screenHeight: number,
    threatX?: number,
    threatY?: number
  ): void {
    const maxSpeed = 3.2;
    const separationDistance = 45;

    for (let i = 0; i < boids.length; i++) {
      const boid = boids[i];
      let sepX = 0;
      let sepY = 0;
      let neighbors = 0;

      // 1. Separation behavior (avoid crowding local peers)
      for (let j = 0; j < boids.length; j++) {
        if (i === j) continue;
        const other = boids[j];
        const dx = boid.x - other.x;
        const dy = boid.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < separationDistance) {
          sepX += dx / dist;
          sepY += dy / dist;
          neighbors++;
        }
      }

      if (neighbors > 0) {
        boid.vx += (sepX / neighbors) * 0.4;
        boid.vy += (sepY / neighbors) * 0.4;
      }

      // 2. Threat Evasion (scatter if player projectile or crosshair is near)
      if (threatX !== undefined && threatY !== undefined) {
        const tdx = boid.x - threatX;
        const tdy = boid.y - threatY;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist < 140 && tdist > 0) {
          boid.vx += (tdx / tdist) * 2.2;
          boid.vy += (tdy / tdist) * 2.2;
        }
      }

      // Speed clamping
      const currentSpeed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
      if (currentSpeed > maxSpeed) {
        boid.vx = (boid.vx / currentSpeed) * maxSpeed;
        boid.vy = (boid.vy / currentSpeed) * maxSpeed;
      }

      // Update position
      boid.x += boid.vx;
      boid.y += boid.vy;

      // Screen wrap-around bounds
      if (boid.x < -60) boid.x = screenWidth + 60;
      if (boid.x > screenWidth + 60) boid.x = -60;
      if (boid.y < 60) boid.y = screenHeight - 120;
      if (boid.y > screenHeight - 100) boid.y = 80;
    }
  }
}
