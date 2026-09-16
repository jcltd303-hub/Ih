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
import { GameEventBus, ScreenShakeEvent } from '../core/GameEvents';
import { ComboSystem } from './ComboSystem';
import { TurretSystem } from './TurretSystem';


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
  private lastTargetX = 0;
  private lastTargetY = 0;
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

    // Setup offline sync callback. Uses the same requestId+timestamp
    // idempotency scheme as the live path (see ShotSettlement.ts) — no
    // signature/nonce is needed or checked server-side.
    this.offlineQueue.setSyncHandler(async (queued) => {
      try {
        const processShot = httpsCallable(functions, 'processPlayerShot');
        const requestId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        await processShot({
          sessionId: queued.sessionId,
          currencyType: queued.currencyType,
          betAmount: queued.betAmount,
          targetId: queued.targetId,
          clientHitConfirmed: queued.clientHitConfirmed,
          timestamp: Date.now(),
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
    this.lastTargetX = targetX;
    this.lastTargetY = targetY;
    const angle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    this.cannonGraphic.rotation = angle + Math.PI / 2;
    if (this.turretRig) {
      this.turretRig.headContainer.rotation = angle + Math.PI / 2;
    }
    // Keep multi-barrel muzzles aligned with aim
    try {
      const barrels = PlayerProgressionManager.getInstance().getState();
      let n = 1;
      if (barrels.isBossUpgradeActive || barrels.isOvercharged) n = 3;
      else if (barrels.level >= 10) n = 3;
      else if (barrels.level >= 5) n = 2;
      this.drawBarrelIndicator(n);
    } catch {
      /* ignore */
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
    betAmount: number, targetX: number, targetY: number,
    barrelCount: number = 1
  ): Promise<boolean> {
    const stats = this.getActiveWeaponStats();
    const now = Date.now();
    if (now - this.lastFiredTime < stats.cooldownMs) return false;
    this.lastFiredTime = now;
    this.fireCooldownMs = stats.cooldownMs;

    const barrels = Math.max(1, Math.min(3, Math.floor(barrelCount) || 1));
    this.updateAim(targetX, targetY);
    if (this.turretRig) this.turretRig.playFire();
    this.drawBarrelIndicator(barrels);

    PlayerProgressionManager.getInstance().addXp(2 * barrels);

    const baseAngle = Math.atan2(targetY - this.cannonY, targetX - this.cannonX);
    const skin = PlayerProgressionManager.getInstance().getState().effectiveTurretSkin as TurretSkinId;
    const speed = stats.projectileSpeed;
    const barrelLength = 48;
    // Lateral spacing between muzzles (perpendicular to aim)
    const lateralStep = 10;

    for (let i = 0; i < barrels; i++) {
      const offsetIndex = i - (barrels - 1) / 2; // -1,0,1 for triple etc.
      let angle = baseAngle;
      if (stats.spreadDeg > 0) {
        angle += ((Math.random() - 0.5) * 2 * stats.spreadDeg * Math.PI) / 180;
      }
      // Slight fan so multi-barrel is readable in flight
      if (barrels > 1) {
        angle += offsetIndex * 0.035;
      }

      const perpX = -Math.sin(baseAngle);
      const perpY = Math.cos(baseAngle);
      const lat = offsetIndex * lateralStep;

      const muzzleX = this.cannonX + Math.cos(baseAngle) * barrelLength + perpX * lat;
      const muzzleY = this.cannonY + Math.sin(baseAngle) * barrelLength + perpY * lat;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.projectileIdCounter++;
      const projectileId = `proj_${this.projectileIdCounter}`;
      const container = this.projectilePool.acquire();
      const graphics = container.children[0] as Graphics;
      graphics.clear();
      container.rotation = angle + Math.PI / 2;
      this.drawProjectileGfx(graphics, skin, currencyType, betAmount);

      container.x = muzzleX;
      container.y = muzzleY;
      this.stage.addChild(container);

      const projectile: Projectile = {
        id: projectileId, userId, sessionId, currencyType, betAmount, turretSkin: skin,
        x: muzzleX, y: muzzleY, vx, vy, container
      };
      this.activeProjectiles.set(projectileId, projectile);
    }

    PayoutEngine.recordWager(betAmount);
    SoundManager.playTurretFire(skin, betAmount, currencyType);
    if (barrels > 1) {
      // Extra bark so multi-barrel reads in audio
      setTimeout(() => SoundManager.playTurretFire(skin, betAmount, currencyType), 30);
    }
    HapticManager.triggerShotImpact(betAmount).catch(()=>{});
    return true;
  }

  private drawProjectileGfx(
    graphics: Graphics,
    skin: TurretSkinId,
    currencyType: 'GC' | 'SC',
    betAmount: number
  ): void {
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
    } else {
      const bulletColor = currencyType==='SC'?(betAmount>=50?0xff0066:0x00ffcc):0xffb703;
      graphics.circle(-4,0,4); graphics.circle(4,0,4); graphics.fill({color:bulletColor,alpha:1});
      graphics.stroke({width:1.5,color:0xffffff,alpha:0.95});
    }
  }

  /** Visible muzzle count on the turret so multi-barrel is obvious at rest. */
  private barrelGfx: Graphics | null = null;
  private lastDrawnBarrels = 0;

  private drawBarrelIndicator(barrels: number): void {
    if (!this.barrelGfx) {
      this.barrelGfx = new Graphics();
      this.stage.addChild(this.barrelGfx);
    }
    if (barrels === this.lastDrawnBarrels && this.barrelGfx.visible) {
      // still refresh position with aim
    }
    this.lastDrawnBarrels = barrels;
    this.barrelGfx.clear();
    this.barrelGfx.visible = barrels > 1;
    if (barrels <= 1) return;

    const angle = Math.atan2(this.lastTargetY - this.cannonY, this.lastTargetX - this.cannonX);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const alongX = Math.cos(angle);
    const alongY = Math.sin(angle);
    for (let i = 0; i < barrels; i++) {
      const offsetIndex = i - (barrels - 1) / 2;
      const lat = offsetIndex * 9;
      const bx = this.cannonX + alongX * 36 + perpX * lat;
      const by = this.cannonY + alongY * 36 + perpY * lat;
      this.barrelGfx.circle(bx, by, 4);
      this.barrelGfx.fill({ color: 0xfbbf24, alpha: 0.95 });
      this.barrelGfx.stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
    }
  }

  public update(deltaTime: number): void {
    const dtScale = Math.min(deltaTime * 0.06, 2.5);
    const dtMs = deltaTime; // deltaTime is already in milliseconds (ticker.deltaMS)

    // Update arcade combat state machines
    ComboSystem.getInstance().update(dtMs);
    TurretSystem.getInstance().update(dtMs);


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
        // A shot that never hit anything still spent its wager — settle it
        // as a miss (clientHitConfirmed: false) so the bet is deducted
        // exactly once, same as a hit, instead of never reaching the
        // server at all.
        ShotSettlement.settle({
          sessionId: proj.sessionId,
          currencyType: proj.currencyType,
          betAmount: proj.betAmount,
          targetId: 'miss',
          clientHitConfirmed: false
        }).then(() => {}).catch(() => {});
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
        if (fishType === 'boss') {
          if (this.onBossDamage) {
            this.onBossDamage(proj.userId, evalHit.damage, hitEntity.id);
          }
        }

        // Register hit with ComboSystem and emit FISH_HIT
        ComboSystem.getInstance().registerHit();
        
        // Enhance hit effect based on hierarchy
        const hierarchyBonus = fish?.hierarchy === 'CRITICAL' ? 1.5 : (fish?.hierarchy === 'ELITE' ? 1.2 : 1.0);
        const isCrit = evalHit.isCrit || fish?.hierarchy === 'CRITICAL';
        
        if (isCrit) {
          GameEventBus.getInstance().emit<ScreenShakeEvent>('SCREEN_SHAKE', {
            intensity: 8,
            durationMs: 150
          });
        }
        
        GameEventBus.getInstance().emit('FISH_HIT', {
          fishId: hitEntity.id,
          fishType: fishType as 'small' | 'medium' | 'boss',
          hierarchy: fish?.hierarchy,
          damage: evalHit.damage * hierarchyBonus,
          x: proj.x,
          y: proj.y,
          isCrit: isCrit,
          isSuperCrit: evalHit.isSuperCrit,
          isInstantKill: evalHit.isInstantKill,
          payout: evalHit.hitPayout,
          currency: proj.currencyType
        });

        // Award XP for hit
        const hitXp = evalHit.isSuperCrit ? 35 : (evalHit.isCrit ? 18 : (evalHit.isLuckyHit ? 22 : 6));
        PlayerProgressionManager.getInstance().addXp(hitXp);

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

          // Register kill with ComboSystem
          ComboSystem.getInstance().registerKill();

          // Check Turret multiplier bonus eligibility
          const triggeredTurret = TurretSystem.getInstance().onFishKilled();
          if (triggeredTurret) {
            this.particleFX.spawnFloatingText(
              this.cannonX,
              this.cannonY - 45,
              '⚡ TURRET x2 ACTIVE (3.5s)!',
              0xfbbf24,
              true
            );
          }



          // Emit FISH_KILLED event for Kill Feed and UI
          const fishName = (fish as any)?.name || (fishType === 'boss' ? 'ABYSSAL HORROR BOSS' : fishType === 'medium' ? 'MUTANT FISH' : 'NEON TETRA');
          GameEventBus.getInstance().emit('FISH_KILLED', {
            fishId: hitEntity.id,
            fishType: fishType as 'small' | 'medium' | 'boss',
            name: fishName,
            x: hitResult.x,
            y: hitResult.y,
            payout: winAmount,
            currency: proj.currencyType,
            multiplier: killGamble.finalMultiplier,
            isJackpot: killGamble.isJackpot
          });

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
