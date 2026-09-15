import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { SpatialHashGrid } from './SpatialHashGrid';
import { FishManager } from './FishManager';
import { ParticleFXManager } from './ParticleFXManager';
import { OfflineTransactionQueue } from '../../network/OfflineTransactionQueue';
import { ShotSettlement } from '../../network/ShotSettlement';
import { HapticManager } from '../../network/HapticManager';
import { SoundManager } from '../../audio/SoundManager';
import { PlayerProgressionManager } from './PlayerProgressionManager';
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
  private fireCooldownMs: number = 140;
  private cannonGraphic: Graphics;
  public turretRig: TurretAnimationRig;
  public cannonX: number;
  public cannonY: number;
  private upgradeOverlay: Graphics;
  private upgradeCountdown: Text;
  private onWinCallback?: (winAmount: number, currencyType: 'GC' | 'SC') => void;
  private onBossDamage?: (userId: string, damage: number, fishId: string) => void;

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
    const prog = PlayerProgressionManager.getInstance().getState();
    const skin = prog.effectiveTurretSkin;
    const base = WeaponController.WEAPON_STATS[skin] ?? WeaponController.WEAPON_STATS.plasma_neon;
    if (prog.isOvercharged) {
      return {
        cooldownMs: 80,
        projectileSpeed: 34,
        damageMult: base.damageMult * 1.5,
        spreadDeg: Math.max(0.5, base.spreadDeg * 0.5)
      };
    }
    if (prog.isBossUpgradeActive) {
      return {
        cooldownMs: Math.max(90, Math.round(base.cooldownMs * 0.8)),
        projectileSpeed: Math.round(base.projectileSpeed * 1.25),
        damageMult: base.damageMult * 1.4,
        spreadDeg: base.spreadDeg
      };
    }
    return base;
  }

  constructor(
    stage: Container,
    spatialGrid: SpatialHashGrid,
    fishManager: FishManager,
    particleFX: ParticleFXManager,
    screenWidth: number,
    screenHeight: number,
    onWin?: (winAmount: number, currencyType: 'GC' | 'SC') => void,
    onBossDamage?: (userId: string, damage: number, fishId: string) => void
  ) {
    this.stage = stage;
    this.spatialGrid = spatialGrid;
    this.fishManager = fishManager;
    this.particleFX = particleFX;
    this.offlineQueue = OfflineTransactionQueue.getInstance();
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.onWinCallback = onWin;
    this.onBossDamage = onBossDamage;

    this.cannonX = screenWidth / 2;
    this.cannonY = screenHeight - 40;

    this.projectilePool = new ObjectPool<Container>(
      () => {
        const c = new Container();
        const g = new Graphics();
        c.addChild(g);
        return c;
      },
      (c) => {
        c.x = 0; c.y = 0; c.rotation = 0; c.alpha = 1;
      },
      60
    );

    this.cannonGraphic = new Graphics();

    // Animated Sci-Fi Turret Rig from Sprite Sheet driven by Player Progression
    const initialSkin = PlayerProgressionManager.getInstance().getState().effectiveTurretSkin as TurretSkinId;
    this.turretRig = SpriteSheetManager.getInstance().createTurretRig(initialSkin);
    this.turretRig.container.x = this.cannonX;
    this.turretRig.container.y = this.cannonY;
    this.stage.addChild(this.turretRig.container);
    this.refreshCannonSkin();

    // Colored upgrade ring + countdown (Electric Rage cannon upgrade)
    this.upgradeOverlay = new Graphics();
    this.upgradeOverlay.visible = false;
    this.stage.addChild(this.upgradeOverlay);
    this.upgradeCountdown = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'ui-monospace, monospace',
        fontSize: 14,
        fontWeight: '900',
        fill: 0xfbbf24,
        stroke: { color: 0x450a0a, width: 3 }
      })
    });
    this.upgradeCountdown.anchor.set(0.5);
    this.upgradeCountdown.visible = false;
    this.stage.addChild(this.upgradeCountdown);

    PlayerProgressionManager.getInstance().onOvercharge((active, remainingSec) => {
      this.syncUpgradeVisual(active, remainingSec);
    });

    // Dynamically refresh turret chassis when skill level unlocks or lucky overcharge activates
    PlayerProgressionManager.getInstance().subscribe(() => {
      this.refreshCannonSkin();
    });

    // Setup offline sync callback
    this.offlineQueue.setSyncHandler(async (queued) => {
      try {
        const processShot = httpsCallable(functions, 'processPlayerShot');
        const timestamp = queued.timestamp;
        const nonce = Math.random().toString(36).substring(2);
        const signature = await CryptoSigner.generateSignature(
          queued.userId, queued.sessionId, queued.betAmount, queued.targetId, timestamp, nonce
        );
        const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        await processShot({
          sessionId: queued.sessionId,
          currencyType: queued.currencyType,
          betAmount: queued.betAmount,
          targetId: queued.targetId,
          clientHitConfirmed: queued.clientHitConfirmed,
          timestamp, nonce, signature,
          requestId
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
    const prog = PlayerProgressionManager.getInstance().getState();
    this.syncUpgradeVisual(prog.isOvercharged, prog.overchargeRemainingSec);
  }

  public updateAim(targetX: number, targetY: number): void {
    const angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    this.cannonGraphic.rotation = angle + Math.PI / 2;
    if (this.turretRig) {
      this.turretRig.headContainer.rotation = angle + Math.PI / 2;
    }
  }

  public refreshCannonSkin(): void {
    const skin = PlayerProgressionManager.getInstance().getState().effectiveTurretSkin;
    if (this.turretRig) {
      this.turretRig.setSkin(skin);
    }
  }

  private syncUpgradeVisual(active: boolean, remainingSec: number): void {
    if (!this.upgradeOverlay || !this.upgradeCountdown) return;
    this.upgradeOverlay.clear();
    if (!active) {
      this.upgradeOverlay.visible = false;
      this.upgradeCountdown.visible = false;
      return;
    }
    this.upgradeOverlay.visible = true;
    this.upgradeCountdown.visible = true;
    // Neon cyan/gold ring around turret
    this.upgradeOverlay.circle(this.cannonX, this.cannonY, 42);
    this.upgradeOverlay.stroke({ width: 4, color: 0x22d3ee, alpha: 0.9 });
    this.upgradeOverlay.circle(this.cannonX, this.cannonY, 48);
    this.upgradeOverlay.stroke({ width: 2, color: 0xfbbf24, alpha: 0.7 });
    this.upgradeCountdown.text = String(remainingSec);
    this.upgradeCountdown.x = this.cannonX;
    this.upgradeCountdown.y = this.cannonY - 58;
  }

  public canFire(): boolean {
    const stats = this.getActiveWeaponStats();
    return Date.now() - this.lastFiredTime >= stats.cooldownMs;
  }

  public async fireCannon(
    userId: string, sessionId: string, currencyType: 'GC' | 'SC',
    betAmount: number, targetX: number, targetY: number
  ): Promise<boolean> {
    const stats = this.getActiveWeaponStats();
    const now = Date.now();
    if (now - this.lastFiredTime < stats.cooldownMs) return false;
    this.lastFiredTime = now;
    this.fireCooldownMs = stats.cooldownMs;

    this.updateAim(targetX, targetY);
    if (this.turretRig) this.turretRig.playFire();

    // Track shot firing XP
    PlayerProgressionManager.getInstance().addXp(2);

    // Trigger dual-barrel animated muzzle flashes, recoil and shell ejection
    if (this.turretRig) {
      this.turretRig.playFire();
    }

    this.projectileIdCounter++;
    const projectileId = `proj_${this.projectileIdCounter}`;

    let angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    if (stats.spreadDeg > 0) {
      angle += ((Math.random() - 0.5) * 2 * stats.spreadDeg * Math.PI) / 180;
    }
    const speed = stats.projectileSpeed;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const container = this.projectilePool.acquire();
    const graphics = container.children[0] as Graphics;
    graphics.clear();

    const skin = PlayerProgressionManager.getInstance().getState().effectiveTurretSkin as TurretSkinId;

    // Rotate container to match flight trajectory
    container.rotation = angle + Math.PI / 2;

    if (skin === 'plasma_neon') {
      graphics.poly([{x:0,y:-16},{x:5,y:-4},{x:4,y:12},{x:-4,y:12},{x:-5,y:-4}]);
      graphics.fill({color:0x00f0ff,alpha:0.95});
      graphics.stroke({width:2,color:0xff007f,alpha:0.9});
      graphics.circle(0,0,3.5); graphics.fill({color:0xffffff,alpha:1});
      graphics.circle(-2,14,2); graphics.circle(2,14,2); graphics.fill({color:0x00ffcc,alpha:0.8});
    } else if (skin === 'abyssal_dread') {
      graphics.poly([{x:0,y:-18},{x:6,y:-6},{x:5,y:10},{x:-5,y:10},{x:-6,y:-6}]);
      graphics.fill({color:0xef4444,alpha:1});
      graphics.stroke({width:2,color:0xffffff,alpha:0.9});
      graphics.circle(0,-6,3); graphics.fill({color:0xfef08a,alpha:1});
      graphics.poly([{x:-4,y:10},{x:0,y:20},{x:4,y:10}]);
      graphics.fill({color:0xea580c,alpha:0.85});
    } else if (skin === 'cyber_gold') {
      graphics.circle(0,0,betAmount>=50?8:6);
      graphics.fill({color:0xfbbf24,alpha:0.95});
      graphics.stroke({width:2,color:0xfffbeb,alpha:0.95});
      graphics.circle(0,0,3.5); graphics.fill({color:0xffffff,alpha:1});
      graphics.poly([{x:0,y:-14},{x:3,y:0},{x:14,y:0},{x:3,y:0},{x:0,y:14},{x:-3,y:0},{x:-14,y:0},{x:-3,y:0}]);
      graphics.fill({color:0xfef08a,alpha:0.75});
    } else {
      const bulletColor = currencyType==='SC'?(betAmount>=50?0xff0066:0x00ffcc):0xffb703;
      graphics.circle(-4,0,4); graphics.circle(4,0,4); graphics.fill({color:bulletColor,alpha:1});
      graphics.stroke({width:1.5,color:0xffffff,alpha:0.95});
    }

    const barrelLength = 48;
    const muzzleX = this.cannonX + Math.cos(angle) * barrelLength;
    const muzzleY = this.cannonY + Math.sin(angle) * barrelLength;

    container.x = muzzleX; container.y = muzzleY;
    this.stage.addChild(container);

    const projectile: Projectile = {
      id: projectileId, userId, sessionId, currencyType, betAmount, turretSkin: skin,
      x: muzzleX, y: muzzleY, vx, vy, container
    };

    this.activeProjectiles.set(projectileId, projectile);
    PayoutEngine.recordWager(betAmount);
    SoundManager.playTurretFire(skin, betAmount, currencyType);
    HapticManager.triggerShotImpact(betAmount).catch(()=>{});
    this.dispatchServerShot(projectile);
    return true;
  }

  private async dispatchServerShot(projectile: Projectile): Promise<void> {
    const timestamp = Date.now();
    try {
      const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

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
        signature,
        requestId
      });
    } catch {
      await this.offlineQueue.enqueueShot({
        userId: projectile.userId, sessionId: projectile.sessionId,
        currencyType: projectile.currencyType, betAmount: projectile.betAmount,
        targetId: 'pending_collision', clientHitConfirmed: false
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

      if (proj.x < -30 || proj.x > this.screenWidth + 30 || proj.y < -30 || proj.y > this.screenHeight + 30) {
        this.stage.removeChild(proj.container);
        this.projectilePool.release(proj.container);
        this.activeProjectiles.delete(id);
        SoundManager.playTurretMiss(proj.turretSkin);
        continue;
      }

      const nearbyEntities = this.spatialGrid.query(proj.x - 14, proj.y - 14, 28, 28);
      if (nearbyEntities.length > 0) {
        const hitEntity = nearbyEntities[0];
        const fish = this.fishManager.getFish(hitEntity.id);
        const fishType = fish?.typeId || 'small';

        const weaponStats = WeaponController.WEAPON_STATS[proj.turretSkin] ?? WeaponController.WEAPON_STATS.plasma_neon;
        const skinBonus = 1.0 * weaponStats.damageMult;
        const evalHit = PayoutEngine.evaluateHit(proj.betAmount, fishType, skinBonus);
        const hitResult = this.fishManager.inflictDamage(hitEntity.id, evalHit.damage, evalHit.isInstantKill);

        // Route boss damage to raid event
        if (fishType === 'boss' && this.onBossDamage) {
          this.onBossDamage(proj.userId, evalHit.damage, hitEntity.id);
        }

        // Award XP for hit & grant chance of lucky shot turret upgrade
        const hitXp = evalHit.isSuperCrit ? 35 : (evalHit.isCrit ? 18 : (evalHit.isLuckyHit ? 22 : 6));
        PlayerProgressionManager.getInstance().addXp(hitXp);

        // Lucky shot upgrade trigger (instant kill, super crit, or lucky hit triggers temporary turret overcharge)
        if (evalHit.isInstantKill || evalHit.isSuperCrit) {
          PlayerProgressionManager.getInstance().triggerLuckyOvercharge(8);
          this.particleFX.spawnFloatingText(this.cannonX, this.cannonY - 45, '⚡ LUCKY OVERCHARGE (8s)!', 0x00f0ff, true);
        } else if (evalHit.isLuckyHit || (evalHit.isCrit && Math.random() < 0.25)) {
          PlayerProgressionManager.getInstance().triggerLuckyOvercharge(5);
          this.particleFX.spawnFloatingText(this.cannonX, this.cannonY - 45, '⚡ TURRET BOOST (5s)!', 0xffd700, true);
        }

        // Pay-per-hit payout
        const hitPayout = evalHit.hitPayout;
        PayoutEngine.recordPayout(hitPayout);

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
          proj.x, proj.y,
          evalHit.isSuperCrit ? 0xff0055 : (evalHit.isCrit ? 0xffd700 : (proj.currencyType === 'SC' ? 0x00ffcc : 0xffb703)),
          evalHit.isSuperCrit ? 22 : (evalHit.isCrit ? 15 : 8)
        );
        SoundManager.playTurretHit(proj.turretSkin, fishType, fishType === 'boss');

        if (this.onWinCallback && hitPayout > 0) {
          this.onWinCallback(hitPayout, proj.currencyType);
          SoundManager.playCoinDrop('small', hitPayout);
        }

        ShotSettlement.settle({
          sessionId: proj.sessionId, currencyType: proj.currencyType, betAmount: proj.betAmount,
          targetId: hitEntity.id, clientHitConfirmed: true, clientKillConfirmed: hitResult.killed,
          fishType: fishType as 'small' | 'medium' | 'boss', skinBonus
        }).then(()=>{}).catch(()=>{});

        if (hitResult.killed) {
          const killGamble = PayoutEngine.evaluateKillMultiplier(hitResult.multiplier, fishType);
          const winAmount = proj.betAmount * killGamble.finalMultiplier * 0.70;
          // Award kill XP based on fish tier
          const killXp = fishType === 'boss' ? 350 : (fishType === 'medium' ? 70 : 25);
          PlayerProgressionManager.getInstance().addXp(killXp);

          // Lucky kill upgrade: ~14% chance on any kill, or guaranteed on jackpot/boss kill
          if (killGamble.isJackpot || fishType === 'boss' || Math.random() < 0.14) {
            PlayerProgressionManager.getInstance().triggerLuckyOvercharge(7);
            this.particleFX.spawnFloatingText(
              this.cannonX,
              this.cannonY - 45,
              '⚡ LUCKY KILL TURRET OVERCHARGE (7s)!',
              0xffd700,
              true
            );
          }

          PayoutEngine.recordPayout(winAmount);

          this.particleFX.emitCoinExplosion(hitResult.x, hitResult.y, killGamble.isJackpot ? 32 : 16);
          this.particleFX.spawnExplosion(hitResult.x, hitResult.y, 0xffd700, killGamble.isJackpot ? 40 : 25);

          const killText = `${killGamble.bonusLabel} +${winAmount.toFixed(2)} ${proj.currencyType}`;
          if (killGamble.isJackpot || fishType === 'boss' || winAmount >= proj.betAmount * 12) {
            SoundManager.playCoinDrop('jackpot', winAmount);
            this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 25, killText, 0xffd700, true);
          } else if (winAmount >= proj.betAmount * 3.5 || fishType === 'medium') {
            SoundManager.playCoinDrop('medium', winAmount);
            this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 15, `+${winAmount.toFixed(2)} ${proj.currencyType}`, 0x34d399, false);
          } else {
            SoundManager.playCoinDrop('small', winAmount);
            this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 15, `+${winAmount.toFixed(2)} ${proj.currencyType}`, 0x34d399, false);
          }

          if (this.onWinCallback) this.onWinCallback(winAmount, proj.currencyType);
        }

        this.stage.removeChild(proj.container);
        this.projectilePool.release(proj.container);
        this.activeProjectiles.delete(id);
      }
    }

    if (this.turretRig) this.turretRig.update(dtScale);
    const prog = PlayerProgressionManager.getInstance().getState();
    if (prog.isOvercharged) {
      this.syncUpgradeVisual(true, prog.overchargeRemainingSec);
    }
  }
}
