import { Container, Graphics } from 'pixi.js';
import { SpatialHashGrid } from './SpatialHashGrid';
import { FishManager } from './FishManager';
import { ParticleFXManager } from './ParticleFXManager';
import { CryptoSigner } from '../../network/CryptoSigner';
import { OfflineTransactionQueue } from '../../network/OfflineTransactionQueue';
import { HapticManager } from '../../network/HapticManager';
import { SoundManager } from '../../audio/SoundManager';
import { LoadoutManager } from '../../network/LoadoutManager';
import { ObjectPool } from './ObjectPool';
import { functions } from '../../network/FirebaseClient';
import { httpsCallable } from 'firebase/functions';

export interface Projectile {
  id: string;
  userId: string;
  sessionId: string;
  currencyType: 'GC' | 'SC';
  betAmount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  container: Container;
}

export class WeaponController {
  private stage: Container;
  private spatialGrid: SpatialHashGrid;
  private fishManager: FishManager;
  private particleFX: ParticleFXManager;
  private offlineQueue: OfflineTransactionQueue;
  private projectilePool: ObjectPool<Container>;
  private activeProjectiles: Map<string, Projectile> = new Map();
  private screenWidth: number;
  private screenHeight: number;
  private projectileIdCounter = 0;
  private lastFiredTime: number = 0;
  private fireCooldownMs: number = 140; // Rate of fire limiter
  private cannonGraphic: Graphics;
  public cannonX: number;
  public cannonY: number;
  private onWinCallback?: (winAmount: number, currencyType: 'GC' | 'SC') => void;

  constructor(
    stage: Container,
    spatialGrid: SpatialHashGrid,
    fishManager: FishManager,
    particleFX: ParticleFXManager,
    screenWidth: number,
    screenHeight: number,
    onWin?: (winAmount: number, currencyType: 'GC' | 'SC') => void
  ) {
    this.stage = stage;
    this.spatialGrid = spatialGrid;
    this.fishManager = fishManager;
    this.particleFX = particleFX;
    this.offlineQueue = OfflineTransactionQueue.getInstance();
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.onWinCallback = onWin;

    this.cannonX = screenWidth / 2;
    this.cannonY = screenHeight - 40;

    // Zero-allocation Object Pool for projectiles to guarantee 60 FPS
    this.projectilePool = new ObjectPool<Container>(
      () => {
        const c = new Container();
        const g = new Graphics();
        c.addChild(g);
        return c;
      },
      (c) => {
        c.x = 0;
        c.y = 0;
        c.rotation = 0;
        c.alpha = 1;
      },
      60
    );

    // Tactical Turret base & barrel
    this.cannonGraphic = new Graphics();
    this.refreshCannonSkin();
    this.cannonGraphic.x = this.cannonX;
    this.cannonGraphic.y = this.cannonY;
    this.stage.addChild(this.cannonGraphic);

    // Setup offline sync callback
    this.offlineQueue.setSyncHandler(async (queued) => {
      try {
        const processShot = httpsCallable(functions, 'processPlayerShot');
        const timestamp = queued.timestamp;
        const nonce = Math.random().toString(36).substring(2);
        const signature = await CryptoSigner.generateSignature(
          queued.userId,
          queued.sessionId,
          queued.betAmount,
          queued.targetId,
          timestamp,
          nonce
        );

        await processShot({
          sessionId: queued.sessionId,
          currencyType: queued.currencyType,
          betAmount: queued.betAmount,
          targetId: queued.targetId,
          clientHitConfirmed: queued.clientHitConfirmed,
          timestamp,
          nonce,
          signature
        });
        return true;
      } catch (err) {
        console.warn('[WeaponController] Cloud sync failed, will retry on next cycle:', err);
        return false;
      }
    });
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.cannonX = width / 2;
    this.cannonY = height - 40;
    this.cannonGraphic.x = this.cannonX;
    this.cannonGraphic.y = this.cannonY;
  }

  public updateAim(targetX: number, targetY: number): void {
    const angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    this.cannonGraphic.rotation = angle + Math.PI / 2;
  }

  public refreshCannonSkin(): void {
    const skin = LoadoutManager.getLoadout().activeCannonSkin || 'default';
    this.cannonGraphic.clear();

    let baseColor = 0x1e293b;
    let strokeColor = 0x00ffcc;
    let coreColor = 0x00ffcc;
    let barrelColor = 0x334155;
    let accentColor = 0x60a5fa;

    if (skin === 'abyssal_dread') {
      baseColor = 0x0f051d;
      strokeColor = 0xff0055;
      coreColor = 0xff0033;
      barrelColor = 0x1a0b2e;
      accentColor = 0xff3366;
    } else if (skin === 'cyber_gold') {
      baseColor = 0x1c1917;
      strokeColor = 0xfbbf24;
      coreColor = 0xf59e0b;
      barrelColor = 0x292524;
      accentColor = 0xfde047;
    } else if (skin === 'plasma_neon') {
      baseColor = 0x090d16;
      strokeColor = 0x00ffcc;
      coreColor = 0xff007f;
      barrelColor = 0x1e1b4b;
      accentColor = 0x00ffcc;
    }

    // Base pedestal
    this.cannonGraphic.circle(0, 0, 32);
    this.cannonGraphic.fill({ color: baseColor, alpha: 0.95 });
    this.cannonGraphic.stroke({ width: 3, color: strokeColor, alpha: 0.9 });

    // Inner energy reactor
    this.cannonGraphic.circle(0, 0, 16);
    this.cannonGraphic.fill({ color: coreColor, alpha: 0.85 });

    // Twin plasma barrels
    this.cannonGraphic.rect(-10, -52, 6, 38);
    this.cannonGraphic.fill({ color: barrelColor, alpha: 1.0 });
    this.cannonGraphic.stroke({ width: 1.5, color: accentColor });

    this.cannonGraphic.rect(4, -52, 6, 38);
    this.cannonGraphic.fill({ color: barrelColor, alpha: 1.0 });
    this.cannonGraphic.stroke({ width: 1.5, color: accentColor });
  }

  public async fireCannon(
    userId: string,
    sessionId: string,
    currencyType: 'GC' | 'SC',
    betAmount: number,
    targetX: number,
    targetY: number
  ): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastFiredTime < this.fireCooldownMs) {
      return false;
    }
    this.lastFiredTime = now;

    this.updateAim(targetX, targetY);

    this.projectileIdCounter++;
    const projectileId = `proj_${this.projectileIdCounter}`;

    const angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    const speed = 24;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    // Acquire from Object Pool to prevent GC pauses
    const container = this.projectilePool.acquire();
    const graphics = container.children[0] as Graphics;
    graphics.clear();

    const skin = LoadoutManager.getLoadout().activeCannonSkin;
    let bulletColor = currencyType === 'SC' ? (betAmount >= 50 ? 0xff0066 : 0x00ffcc) : 0xffb703;
    let strokeColor = 0xffffff;

    if (skin === 'abyssal_dread') {
      bulletColor = 0xff0033;
      strokeColor = 0xff6688;
    } else if (skin === 'cyber_gold') {
      bulletColor = 0xfbbf24;
      strokeColor = 0xfffbeb;
    } else if (skin === 'plasma_neon') {
      bulletColor = 0x00ffcc;
      strokeColor = 0xff007f;
    }

    // Glowing plasma bolt
    graphics.circle(0, 0, betAmount >= 50 ? 6 : 4.5);
    graphics.fill({ color: bulletColor, alpha: 1.0 });
    graphics.stroke({ width: 1.5, color: strokeColor, alpha: 0.95 });

    container.x = this.cannonX;
    container.y = this.cannonY - 15;
    this.stage.addChild(container);

    const projectile: Projectile = {
      id: projectileId,
      userId,
      sessionId,
      currencyType,
      betAmount,
      x: this.cannonX,
      y: this.cannonY - 15,
      vx,
      vy,
      container
    };

    this.activeProjectiles.set(projectileId, projectile);

    // Audio & Haptic feedback
    SoundManager.playCannonShot(betAmount);
    HapticManager.triggerShotImpact(betAmount).catch(() => {});

    // Cryptographic dispatch & offline fallback
    this.dispatchServerShot(projectile);
    return true;
  }

  private async dispatchServerShot(projectile: Projectile): Promise<void> {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2);

    try {
      const signature = await CryptoSigner.generateSignature(
        projectile.userId,
        projectile.sessionId,
        projectile.betAmount,
        'pending_collision',
        timestamp,
        nonce
      );

      // Invoke server-authoritative verification if online
      const processShot = httpsCallable(functions, 'processPlayerShot');
      await processShot({
        sessionId: projectile.sessionId,
        currencyType: projectile.currencyType,
        betAmount: projectile.betAmount,
        targetId: 'pending_collision',
        clientHitConfirmed: false,
        timestamp,
        nonce,
        signature
      });
    } catch {
      // Offline fallback: enqueue in durable offline queue for auto-sync on reconnection
      await this.offlineQueue.enqueueShot({
        userId: projectile.userId,
        sessionId: projectile.sessionId,
        currencyType: projectile.currencyType,
        betAmount: projectile.betAmount,
        targetId: 'pending_collision',
        clientHitConfirmed: false
      });
    }
  }

  public update(deltaTime: number): void {
    const dtScale = Math.min(deltaTime * 0.06, 2.5);

    for (const [id, proj] of this.activeProjectiles.entries()) {
      proj.x += proj.vx * dtScale;
      proj.y += proj.vy * dtScale;

      proj.container.x = proj.x;
      proj.container.y = proj.y;

      // Screen boundary cleanup -> recycle into object pool
      if (
        proj.x < -30 ||
        proj.x > this.screenWidth + 30 ||
        proj.y < -30 ||
        proj.y > this.screenHeight + 30
      ) {
        this.stage.removeChild(proj.container);
        this.projectilePool.release(proj.container);
        this.activeProjectiles.delete(id);
        continue;
      }

      // Check collision with spatial grid
      const nearbyEntities = this.spatialGrid.query(proj.x - 14, proj.y - 14, 28, 28);
      if (nearbyEntities.length > 0) {
        const hitEntity = nearbyEntities[0];
        const hitResult = this.fishManager.inflictDamage(hitEntity.id, proj.betAmount * 1.5);

        // Pay per hit reward (instant fractional win on every hit)
        const hitPayout = proj.betAmount * 0.28;
        this.particleFX.spawnExplosion(proj.x, proj.y, proj.currencyType === 'SC' ? 0x00ffcc : 0xffb703, 8);
        SoundManager.playSound('hit');

        if (this.onWinCallback) {
          this.onWinCallback(hitPayout, proj.currencyType);
        }

        if (hitResult.killed) {
          const winAmount = proj.betAmount * hitResult.multiplier * 0.65;
          this.particleFX.emitCoinExplosion(hitResult.x, hitResult.y, 16);
          this.particleFX.spawnExplosion(hitResult.x, hitResult.y, 0xffd700, 25);
          SoundManager.playSound('coin');

          if (this.onWinCallback) {
            this.onWinCallback(winAmount, proj.currencyType);
          }
        }

        this.stage.removeChild(proj.container);
        this.projectilePool.release(proj.container);
        this.activeProjectiles.delete(id);
      }
    }
  }
}
