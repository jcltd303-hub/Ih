import { Container, Graphics } from 'pixi.js';
import { SpatialHashGrid } from './SpatialHashGrid';
import { FishManager } from './FishManager';
import { ParticleFXManager } from './ParticleFXManager';
import { CryptoSigner } from '../../network/CryptoSigner';
import { OfflineTransactionQueue } from '../../network/OfflineTransactionQueue';
import { ShotSettlement } from '../../network/ShotSettlement';
import { HapticManager } from '../../network/HapticManager';
import { SoundManager } from '../../audio/SoundManager';
import { LoadoutManager } from '../../network/LoadoutManager';
import { ObjectPool } from './ObjectPool';
import { functions } from '../../network/FirebaseClient';
import { httpsCallable } from 'firebase/functions';
import { PayoutEngine } from './PayoutEngine';
import { SpriteSheetManager, TurretAnimationRig, TurretSkinId } from './SpriteSheetManager';

export interface Projectile {
  id: string;
  userId: string;
  sessionId: string;
  currencyType: 'GC' | 'SC';
  betAmount: number;
  turretSkin: TurretSkinId;
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
  private fireCooldownMs: number = 140; // Rate of fire limiter (overridden per skin)
  private cannonGraphic: Graphics;
  public turretRig: TurretAnimationRig;
  public cannonX: number;
  public cannonY: number;
  private onWinCallback?: (winAmount: number, currencyType: 'GC' | 'SC') => void;

  /** Per-turret combat profile: cooldown, projectile speed, damage multiplier */
  private static readonly WEAPON_STATS: Record<
    TurretSkinId,
    { cooldownMs: number; projectileSpeed: number; damageMult: number; spreadDeg: number }
  > = {
    plasma_neon: { cooldownMs: 115, projectileSpeed: 28, damageMult: 1.0, spreadDeg: 0 },
    cyber_gold: { cooldownMs: 180, projectileSpeed: 22, damageMult: 1.35, spreadDeg: 2 },
    abyssal_dread: { cooldownMs: 220, projectileSpeed: 18, damageMult: 1.7, spreadDeg: 4 },
    default: { cooldownMs: 140, projectileSpeed: 24, damageMult: 1.15, spreadDeg: 1.5 }
  };

  private getActiveWeaponStats() {
    const skin = (LoadoutManager.getLoadout().activeCannonSkin || 'plasma_neon') as TurretSkinId;
    return WeaponController.WEAPON_STATS[skin] ?? WeaponController.WEAPON_STATS.plasma_neon;
  }

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

    // Legacy fallback graphic
    this.cannonGraphic = new Graphics();

    // Animated Sci-Fi Turret Rig from Sprite Sheet
    const initialSkin = (LoadoutManager.getLoadout().activeCannonSkin || 'plasma_neon') as TurretSkinId;
    this.turretRig = SpriteSheetManager.getInstance().createTurretRig(initialSkin);
    this.turretRig.container.x = this.cannonX;
    this.turretRig.container.y = this.cannonY;
    this.stage.addChild(this.turretRig.container);
    this.refreshCannonSkin();

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
    if (this.turretRig) {
      this.turretRig.container.x = this.cannonX;
      this.turretRig.container.y = this.cannonY;
    }
  }

  public updateAim(targetX: number, targetY: number): void {
    const angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    this.cannonGraphic.rotation = angle + Math.PI / 2;
    if (this.turretRig) {
      this.turretRig.headContainer.rotation = angle + Math.PI / 2;
    }
  }

  public refreshCannonSkin(): void {
    const skin = (LoadoutManager.getLoadout().activeCannonSkin || 'default') as TurretSkinId;
    if (this.turretRig) {
      this.turretRig.setSkin(skin);
    }
  }

  public async fireCannon(
    userId: string,
    sessionId: string,
    currencyType: 'GC' | 'SC',
    betAmount: number,
    targetX: number,
    targetY: number
  ): Promise<boolean> {
    const stats = this.getActiveWeaponStats();
    const now = Date.now();
    if (now - this.lastFiredTime < stats.cooldownMs) {
      return false;
    }
    this.lastFiredTime = now;
    this.fireCooldownMs = stats.cooldownMs;

    this.updateAim(targetX, targetY);

    // Trigger dual-barrel animated muzzle flashes, recoil and shell ejection
    if (this.turretRig) {
      this.turretRig.playFire();
    }

    this.projectileIdCounter++;
    const projectileId = `proj_${this.projectileIdCounter}`;

    let angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    // Per-skin spread for heavier weapons
    if (stats.spreadDeg > 0) {
      const spreadRad = ((Math.random() - 0.5) * 2 * stats.spreadDeg * Math.PI) / 180;
      angle += spreadRad;
    }
    const speed = stats.projectileSpeed;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    // Acquire from Object Pool to prevent GC pauses
    const container = this.projectilePool.acquire();
    const graphics = container.children[0] as Graphics;
    graphics.clear();

    const skin = (LoadoutManager.getLoadout().activeCannonSkin || 'plasma_neon') as TurretSkinId;

    // Rotate container to match flight trajectory
    container.rotation = angle + Math.PI / 2;

    if (skin === 'plasma_neon') {
      // Streamlined Kinetic-Ion Slug with Cyan-Magenta Dual Energy Plume
      graphics.poly([
        { x: 0, y: -16 },
        { x: 5, y: -4 },
        { x: 4, y: 12 },
        { x: -4, y: 12 },
        { x: -5, y: -4 }
      ]);
      graphics.fill({ color: 0x00f0ff, alpha: 0.95 });
      graphics.stroke({ width: 2, color: 0xff007f, alpha: 0.9 });

      // Core ion tracer
      graphics.circle(0, 0, 3.5);
      graphics.fill({ color: 0xffffff, alpha: 1.0 });

      // Dual exhaust ion trails
      graphics.circle(-2, 14, 2);
      graphics.circle(2, 14, 2);
      graphics.fill({ color: 0x00ffcc, alpha: 0.8 });
    } else if (skin === 'abyssal_dread') {
      // Heavy Spiked Armor-Piercing Artillery Slug with Crimson Rocket Plume
      graphics.poly([
        { x: 0, y: -18 },
        { x: 6, y: -6 },
        { x: 5, y: 10 },
        { x: -5, y: 10 },
        { x: -6, y: -6 }
      ]);
      graphics.fill({ color: 0xef4444, alpha: 1.0 });
      graphics.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });

      // Incandescent yellow-white core
      graphics.circle(0, -6, 3);
      graphics.fill({ color: 0xfef08a, alpha: 1.0 });

      // Rocket fire exhaust
      graphics.poly([
        { x: -4, y: 10 },
        { x: 0, y: 20 },
        { x: 4, y: 10 }
      ]);
      graphics.fill({ color: 0xea580c, alpha: 0.85 });
    } else if (skin === 'cyber_gold') {
      // Radiant Solar Sunstone Lance / Topaz Energy Orb with Starburst Corona
      graphics.circle(0, 0, betAmount >= 50 ? 8 : 6);
      graphics.fill({ color: 0xfbbf24, alpha: 0.95 });
      graphics.stroke({ width: 2, color: 0xfffbeb, alpha: 0.95 });

      // Blinding white-gold center
      graphics.circle(0, 0, 3.5);
      graphics.fill({ color: 0xffffff, alpha: 1.0 });

      // 4-point star lens flare
      graphics.poly([
        { x: 0, y: -14 }, { x: 3, y: 0 },
        { x: 14, y: 0 }, { x: 3, y: 0 },
        { x: 0, y: 14 }, { x: -3, y: 0 },
        { x: -14, y: 0 }, { x: -3, y: 0 }
      ]);
      graphics.fill({ color: 0xfef08a, alpha: 0.75 });
    } else {
      // Default Tactical Dual-Bolt Plasma
      const bulletColor = currencyType === 'SC' ? (betAmount >= 50 ? 0xff0066 : 0x00ffcc) : 0xffb703;
      graphics.circle(-4, 0, 4);
      graphics.circle(4, 0, 4);
      graphics.fill({ color: bulletColor, alpha: 1.0 });
      graphics.stroke({ width: 1.5, color: 0xffffff, alpha: 0.95 });
    }

    const barrelLength = 48;
    const muzzleX = this.cannonX + Math.cos(angle) * barrelLength;
    const muzzleY = this.cannonY + Math.sin(angle) * barrelLength;

    container.x = muzzleX;
    container.y = muzzleY;
    this.stage.addChild(container);

    const projectile: Projectile = {
      id: projectileId,
      userId,
      sessionId,
      currencyType,
      betAmount,
      turretSkin: skin,
      x: muzzleX,
      y: muzzleY,
      vx,
      vy,
      container
    };

    this.activeProjectiles.set(projectileId, projectile);

    // Record wager in PayoutEngine telemetry
    PayoutEngine.recordWager(betAmount);

    // Per-turret audio & haptic feedback
    SoundManager.playTurretFire(skin, betAmount, currencyType);
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

      // Screen boundary cleanup -> recycle into object pool (Miss sound)
      if (
        proj.x < -30 ||
        proj.x > this.screenWidth + 30 ||
        proj.y < -30 ||
        proj.y > this.screenHeight + 30
      ) {
        this.stage.removeChild(proj.container);
        this.projectilePool.release(proj.container);
        this.activeProjectiles.delete(id);
        SoundManager.playTurretMiss(proj.turretSkin);
        continue;
      }

      // Check collision with spatial grid
      const nearbyEntities = this.spatialGrid.query(proj.x - 14, proj.y - 14, 28, 28);
      if (nearbyEntities.length > 0) {
        const hitEntity = nearbyEntities[0];
        const fish = this.fishManager.getFish(hitEntity.id);
        const fishType = fish?.typeId || 'small';

        // Loadout + per-turret damage profile
        const weaponStats =
          WeaponController.WEAPON_STATS[proj.turretSkin] ?? WeaponController.WEAPON_STATS.plasma_neon;
        const skinBonus = 1.0 * weaponStats.damageMult;

        // Evaluate gamble hit via PayoutEngine (governed by Admin Looseness slider)
        const evalHit = PayoutEngine.evaluateHit(proj.betAmount, fishType, skinBonus);

        // Inflict damage with optional instant gamble kill
        const hitResult = this.fishManager.inflictDamage(hitEntity.id, evalHit.damage, evalHit.isInstantKill);

        // Pay-per-hit payout
        const hitPayout = evalHit.hitPayout;
        PayoutEngine.recordPayout(hitPayout);

        // Visual floating text & acoustic feedback for special gamble hits & per-turret crits
        if (evalHit.isInstantKill) {
          this.particleFX.spawnFloatingText(proj.x, proj.y - 15, '⚡ INSTANT CAPTURE!', 0x00ffcc, true);
          SoundManager.playTurretCrit(proj.turretSkin, 'instant_kill');
        } else if (evalHit.isSuperCrit) {
          this.particleFX.spawnFloatingText(proj.x, proj.y - 15, '🔥 SUPER CRIT!', 0xff0055, true);
          SoundManager.playTurretCrit(proj.turretSkin, 'super_crit');
        } else if (evalHit.isCrit) {
          this.particleFX.spawnFloatingText(proj.x, proj.y - 12, 'CRITICAL HIT', 0xffd700, false);
          SoundManager.playTurretCrit(proj.turretSkin, 'crit');
        } else if (evalHit.isLuckyHit) {
          this.particleFX.spawnFloatingText(proj.x, proj.y - 12, `LUCKY HIT! +${hitPayout.toFixed(2)}`, 0x34d399, false);
        }

        this.particleFX.spawnExplosion(
          proj.x,
          proj.y,
          evalHit.isSuperCrit ? 0xff0055 : (evalHit.isCrit ? 0xffd700 : (proj.currencyType === 'SC' ? 0x00ffcc : 0xffb703)),
          evalHit.isSuperCrit ? 22 : (evalHit.isCrit ? 15 : 8)
        );

        // Per-turret acoustic impact (with boss forcefield shield deflection layer)
        SoundManager.playTurretHit(proj.turretSkin, fishType, fishType === 'boss');

        // Pay-per-hit coin drop on win
        if (this.onWinCallback && hitPayout > 0) {
          this.onWinCallback(hitPayout, proj.currencyType);
          SoundManager.playCoinDrop('small', hitPayout);
        }

        // Server settlement (balance sync) — offline falls back to local HUD only
        ShotSettlement.settle({
          sessionId: proj.sessionId,
          currencyType: proj.currencyType,
          betAmount: proj.betAmount,
          targetId: hitEntity.id,
          clientHitConfirmed: true,
          clientKillConfirmed: hitResult.killed,
          fishType: fishType as 'small' | 'medium' | 'boss',
          skinBonus
        }).then((result) => {
          if (result.online && result.serverAuthoritative && result.payoutAmount > 0) {
            // Prefer server payout for SC when authoritative; still show FX from local eval
          }
        }).catch(() => {});


        if (hitResult.killed) {
          // Gamble bonus multiplier on kill (1.5x up to 10x jackpot, scaled by Looseness)
          const killGamble = PayoutEngine.evaluateKillMultiplier(hitResult.multiplier, fishType);
          const winAmount = proj.betAmount * killGamble.finalMultiplier * 0.70;

          PayoutEngine.recordPayout(winAmount);

          this.particleFX.emitCoinExplosion(hitResult.x, hitResult.y, killGamble.isJackpot ? 32 : 16);
          this.particleFX.spawnExplosion(hitResult.x, hitResult.y, 0xffd700, killGamble.isJackpot ? 40 : 25);

          // Tiered arcade coin drop on win
          if (killGamble.isJackpot || fishType === 'boss' || winAmount >= proj.betAmount * 12) {
            SoundManager.playCoinDrop('jackpot', winAmount);
            this.particleFX.spawnFloatingText(
              hitResult.x,
              hitResult.y - 25,
              `${killGamble.bonusLabel} +${winAmount.toFixed(2)} ${proj.currencyType}`,
              0xffd700,
              true
            );
          } else if (winAmount >= proj.betAmount * 3.5 || fishType === 'medium') {
            SoundManager.playCoinDrop('medium', winAmount);
            this.particleFX.spawnFloatingText(
              hitResult.x,
              hitResult.y - 15,
              `+${winAmount.toFixed(2)} ${proj.currencyType}`,
              0x34d399,
              false
            );
          } else {
            SoundManager.playCoinDrop('small', winAmount);
            this.particleFX.spawnFloatingText(
              hitResult.x,
              hitResult.y - 15,
              `+${winAmount.toFixed(2)} ${proj.currencyType}`,
              0x34d399,
              false
            );
          }

          if (this.onWinCallback) {
            this.onWinCallback(winAmount, proj.currencyType);
          }
        }

        this.stage.removeChild(proj.container);
        this.projectilePool.release(proj.container);
        this.activeProjectiles.delete(id);
      }
    }

    if (this.turretRig) {
      this.turretRig.update(dtScale);
    }
  }
}
