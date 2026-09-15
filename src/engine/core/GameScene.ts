import { Application, Container } from 'pixi.js';
import { SpatialHashGrid } from '../systems/SpatialHashGrid';
import { FishManager } from '../systems/FishManager';
import { WeaponController } from '../systems/WeaponController';
import { ParticleFXManager } from '../systems/ParticleFXManager';
import { ThemeManager } from '../systems/ThemeManager';
import { AnimatedBackground } from '../systems/AnimatedBackground';
import { AbyssalPostProcessor } from '../systems/AbyssalPostProcessor';
import { UIManager } from '../../ui/UIManager';
import { MultiplayerTableManager } from '../../network/MultiplayerTableManager';
import { TournamentManager } from '../../network/TournamentManager';
import { GameConfig } from '../../config/GameConfig';
import { FeatureFlags } from '../../config/FeatureFlags';
import { isFirebaseConfigured } from '../../network/FirebaseClient';
import { SoundManager } from '../../audio/SoundManager';
import { FairnessSession } from '../../network/FairnessSession';
import { debugOverlay } from '../../ui/DebugOverlay';
import { AuthManager } from '../../network/AuthManager';
import { MultiplayerPresenceLayer } from '../systems/MultiplayerPresenceLayer';
import { BossRaidEvent } from '../systems/BossRaidEvent';
import { GameEventBus, ScreenShakeEvent } from './GameEvents';
import { TableSelection } from '../../network/TableSelection';
import type { TableInfo } from '../../network/TableSelection';
import { TableSelectionManager } from '../../network/TableSelectionManager';

export class GameScene {
  private app: Application;
  private worldContainer: Container;
  private animatedBackground: AnimatedBackground;
  private spatialGrid: SpatialHashGrid;
  private fishManager: FishManager;
  private weaponController: WeaponController;
  private particleFX: ParticleFXManager;
  private themeManager: ThemeManager;
  private abyssalPostProcessor: AbyssalPostProcessor;
  private uiManager: UIManager;
  private multiplayerTable: MultiplayerTableManager;
  private presenceLayer: MultiplayerPresenceLayer | null = null;
  private tableUnsub: (() => void) | null = null;
  private tableSelectionUnsub: (() => void) | null = null;
  private eventUnsubs: Array<() => void> = [];
  private activeTableId: string = 'table_practice';
  private lastSeenShotTs = 0;
  private aimBroadcastTimer = 0;

  private spawnTimer: number = 0;
  private autoFireActive: boolean = false;
  private autoFireTimer: number = 0;
  private lastTargetX: number = 0;
  private lastTargetY: number = 0;
  private isPlaying: boolean = false;
  private postFxEnabled: boolean = true;
  private particlesEnabled: boolean = true;

  private bossRaid: BossRaidEvent;
  private lastBossBashActive = false;
  private tableSelection: TableSelection;
  private bossProgressScore = 0;
  private readonly BOSS_PROGRESS_THRESHOLD = GameConfig.bossProgressThreshold;
  private bossUnlockAtMs = 0;

  private shakeIntensity = 0;
  private shakeDuration = 0;
  private hitStopRemainingMs = 0;
  private elapsedSeconds = 0;

  constructor(
    app: Application,
    uiRoot: HTMLElement,
    options?: { postFxEnabled?: boolean; particlesEnabled?: boolean }
  ) {
    this.postFxEnabled = options?.postFxEnabled !== false;
    this.particlesEnabled = options?.particlesEnabled !== false;
    this.app = app;
    const width = this.app.screen.width;
    const height = this.app.screen.height;

    this.animatedBackground = new AnimatedBackground(width, height);
    this.app.stage.addChild(this.animatedBackground.container);

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.themeManager = new ThemeManager(app);
    this.abyssalPostProcessor = new AbyssalPostProcessor();
    this.spatialGrid = new SpatialHashGrid(128);
    this.fishManager = new FishManager(this.worldContainer, this.spatialGrid, width, height);
    this.particleFX = new ParticleFXManager(this.worldContainer, width, height);
    this.multiplayerTable = new MultiplayerTableManager();

    this.bossRaid = new BossRaidEvent(this.worldContainer, this.fishManager, this.particleFX);
    this.bossRaid.resize(width, height);
    this.tableSelection = TableSelection.getInstance();

    this.uiManager = new UIManager(uiRoot, {
      onThemeChange: (theme) => {
        this.themeManager.setTheme(theme);
        this.animatedBackground.setTheme(theme);
        this.fishManager.setTheme(theme);
        SoundManager.setTheme(theme);
      },
      onLoadoutChange: () => {
        this.weaponController.refreshCannonSkin();
      },
      onPlay: () => {
        this.startPlay();
      }
    });

    this.weaponController = new WeaponController(
      this.worldContainer,
      this.spatialGrid,
      this.fishManager,
      this.particleFX,
      width,
      height,
      (winAmount, currencyType) => {
        if (currencyType === 'SC') {
          this.uiManager.addBalance(0, winAmount);
          TournamentManager.addScore(GameConfig.localPlayerId, winAmount * 10);
        } else {
          this.uiManager.addBalance(winAmount * 100, 0);
          TournamentManager.addScore(GameConfig.localPlayerId, winAmount);
        }
        this.abyssalPostProcessor.triggerImpactGlitch(0.015);
      },
      (userId, damage, fishId) => {
        if (this.bossRaid.isActive() && fishId === this.bossRaid.getBossId()) {
          this.bossRaid.recordDamage(userId, damage);
        }
      }
    );

    if (this.postFxEnabled) {
      const postFilter = this.abyssalPostProcessor.getFilter();
      if (postFilter) this.worldContainer.filters = [postFilter];
    }

    this.lastTargetX = width / 2;
    this.lastTargetY = height / 3;

    this.setupInputListeners();
    this.setupResizeListener();
    this.renderCombatHUD();

    const events = GameEventBus.getInstance();
    this.eventUnsubs.push(
      events.on<ScreenShakeEvent>('SCREEN_SHAKE', (data) => {
        this.triggerShake(data.intensity, data.durationMs);
      }),
      events.on('FISH_HIT', (e: any) => {
        if (e.isCrit || e.fishType === 'boss') {
          this.hitStopRemainingMs = e.fishType === 'boss' ? 100 : 65;
        }
      }),
      events.on('BOSS_HIT', () => {
        this.hitStopRemainingMs = 90;
      }),
      events.on('SCREEN_DIM', (e: { intensity: number }) => {
        this.abyssalPostProcessor.setDim(e.intensity);
      })
    );

    this.uiManager.showStartScreen();
  }

  private renderCombatHUD(): void {
    // HUD is handled by UIManager and sub-components.
  }

  private startPlay(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.uiManager.hideStartScreen();

    void FairnessSession.getInstance().begin().then((sess) => {
      console.info('[Fairness] session', sess.status, sess.serverSeedHash.slice(0, 12) + '…');
    });

    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    const name = AuthManager.getInstance().getState().displayName || GameConfig.localDisplayName;
    const currentTable = this.tableSelection.getCurrentTable();
    this.multiplayerTable.joinSharedTable(currentTable.id, uid, name);
    this.tableSelection.joinPresence(uid, name);

    this.presenceLayer = new MultiplayerPresenceLayer(this.worldContainer);
    this.presenceLayer.setLocalUserId(uid);

    const joinTable = (table: TableInfo) => {
      if (this.tableUnsub) {
        this.tableUnsub();
        this.tableUnsub = null;
      }
      this.activeTableId = table.id;
      this.multiplayerTable.joinSharedTable(table.id, uid, name);
      this.tableUnsub = this.multiplayerTable.subscribeToTableState(table.id, (state) => {
        this.presenceLayer?.syncPlayers(state?.players);
        const shots = state?.shared_shots;
        if (shots && typeof shots === 'object') {
          for (const shot of Object.values(shots) as any[]) {
            if (!shot || typeof shot.timestamp !== 'number') continue;
            if (shot.timestamp <= this.lastSeenShotTs) continue;
            this.lastSeenShotTs = Math.max(this.lastSeenShotTs, shot.timestamp);
            this.presenceLayer?.showRemoteShot(shot);
          }
        }
      });
    };

    const initialTable = this.tableSelection.getCurrentTable() as any;
    joinTable(initialTable);

    if (!this.tableSelectionUnsub) {
      this.tableSelectionUnsub = TableSelectionManager.getInstance().onTableChange((tbl) => {
        joinTable(tbl as any);
      });
    }

    this.bossProgressScore = 0;
    this.bossUnlockAtMs = Date.now() + GameConfig.bossGracePeriodMs;
    this.lastBossBashActive = false;
    this.uiManager.setBossOverlay(false);
    SoundManager.setBossMusic(false, false);

    for (let i = 0; i < GameConfig.playStartExtraWaves; i++) {
      this.fishManager.spawnRandomWave();
    }
  }

  private tryStartBossFromProgress(): void {
    if (this.bossRaid.isActive()) return;
    if (Date.now() < this.bossUnlockAtMs) return;

    const table = this.tableSelection.getCurrentTable() as any;
    const raidAllowed = TableSelectionManager.getInstance().isBossRaidAllowed();
    if (table?.isPractice || table?.mode === 'practice') {
      if (!raidAllowed) return;
    } else if (!raidAllowed) {
      return;
    }

    if (this.bossProgressScore < this.BOSS_PROGRESS_THRESHOLD) return;

    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    this.bossProgressScore = 0;
    this.bossRaid.startRaid(uid, (result) => {
      console.info('[BossRaid] completed', result);
      this.bossUnlockAtMs = Date.now() + 60000;
    });
  }

  private setupInputListeners(): void {
    const canvas = this.app.canvas;

    const syncAim = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      this.lastTargetX = clientX - rect.left;
      this.lastTargetY = clientY - rect.top;
      this.weaponController.updateAim(this.lastTargetX, this.lastTargetY);
      GameEventBus.getInstance().emit('AIM_UPDATE', { x: this.lastTargetX, y: this.lastTargetY });
    };

    canvas.addEventListener('pointermove', (e) => {
      if (!this.isPlaying) return;
      syncAim(e.clientX, e.clientY);
      this.aimBroadcastTimer += 1;
      if (this.aimBroadcastTimer > 8) {
        this.aimBroadcastTimer = 0;
        this.multiplayerTable.updateLocalAim(this.lastTargetX, this.lastTargetY);
      }
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying) return;
      canvas.setPointerCapture?.(e.pointerId);
      syncAim(e.clientX, e.clientY);
      this.autoFireActive = true;
      this.autoFireTimer = 0;
      this.fireWeapon(this.lastTargetX, this.lastTargetY);
    });

    const endHold = (e: PointerEvent) => {
      this.autoFireActive = false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    };
    canvas.addEventListener('pointerup', endHold);
    canvas.addEventListener('pointercancel', endHold);
    canvas.addEventListener('pointerleave', () => { this.autoFireActive = false; });
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      const width = this.app.screen.width;
      const height = this.app.screen.height;
      this.animatedBackground.resize(width, height);
      this.fishManager.resize(width, height);
      this.weaponController.resize(width, height);
      this.particleFX.resize(width, height);
      this.bossRaid.resize(width, height);
      this.abyssalPostProcessor.resize(width, height);
    });
  }

  private fireWeapon(targetX: number, targetY: number): void {
    if (!this.weaponController.canFire()) return;

    const betAmount = this.uiManager.getCurrentBet();
    const currency = this.uiManager.getCurrency();
    if (currency === 'SC' && FeatureFlags.realSc && !isFirebaseConfigured) {
      console.warn('[SC] Real-SC mode requires Firebase — switch to GC or configure env.');
      return;
    }
    if (!this.uiManager.deductBet()) return;

    this.bossProgressScore += 1 + Math.min(4, betAmount);
    this.tryStartBossFromProgress();

    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    const barrels = this.uiManager.getBarrelCount();
    void this.weaponController.fireCannon(
      uid,
      FairnessSession.getInstance().getSessionId(),
      currency,
      betAmount,
      targetX,
      targetY,
      barrels
    );

    const currentTable = this.tableSelection.getCurrentTable();
    this.multiplayerTable.broadcastTableShot(currentTable.id, uid, targetX, targetY, betAmount);
  }

  public syncWalletBalances(gc: number, sc: number, _source?: string): void {
    this.uiManager.setBalances(gc, sc);
  }

  public triggerShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = durationMs;
  }

  public update(deltaTime: number): void {
    if (this.hitStopRemainingMs > 0) {
      this.hitStopRemainingMs -= deltaTime;
      return;
    }

    this.elapsedSeconds += deltaTime / 1000;
    this.abyssalPostProcessor.update(this.elapsedSeconds);
    this.animatedBackground.update(deltaTime);
    debugOverlay.tick();

    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime;
      const offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      const offsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.worldContainer.position.set(offsetX, offsetY);
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
        this.worldContainer.position.set(0, 0);
      }
    }

    if (!this.isPlaying) {
      this.spatialGrid.clear();
      this.fishManager.update(deltaTime);
      this.particleFX.update(deltaTime);
      return;
    }

    this.spatialGrid.clear();
    this.spawnTimer += deltaTime;
    if (this.spawnTimer > GameConfig.spawnIntervalMs) {
      this.fishManager.spawnRandomWave();
      this.spawnTimer = 0;
    }

    if (this.autoFireActive) {
      this.autoFireTimer += deltaTime;
      if (this.autoFireTimer >= GameConfig.autoFireIntervalMs && this.weaponController.canFire()) {
        this.fireWeapon(this.lastTargetX, this.lastTargetY);
        this.autoFireTimer = 0;
      }
    }

    this.bossRaid.update(deltaTime);
    const raidActive = this.bossRaid.isActive();

    if (raidActive) {
      if (!this.lastBossBashActive) {
        this.uiManager.showBossFrenzyTitle();
        SoundManager.setBossMusic(true, false);
        SoundManager.playBossWarning();
        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height * 0.22;
        this.particleFX.spawnExplosion(cx, cy, 0xff0033, 40);
        this.particleFX.spawnExplosion(cx - 40, cy + 20, 0x22d3ee, 16);
      }

      const bossState = this.bossRaid.getState();
      const secs = Math.ceil(bossState.timeRemaining / 1000);
      const hpPercent = bossState.maxHp > 0 ? (bossState.hp / bossState.maxHp) * 100 : 0;
      this.uiManager.setBossOverlay(true, secs, hpPercent, bossState.phase, bossState.totalDamage);
      SoundManager.setBossMusic(true, bossState.phase === 'enraged');
    } else if (this.lastBossBashActive) {
      this.uiManager.setBossOverlay(false);
      SoundManager.setBossMusic(false, false);
      this.bossProgressScore = 0;
    }
    this.lastBossBashActive = raidActive;

    this.fishManager.update(deltaTime, this.lastTargetX, this.lastTargetY);
    this.weaponController.update(deltaTime);
    this.particleFX.update(deltaTime);
  }

  /** Release scene-owned subscriptions when the scene is discarded. */
  public destroy(): void {
    this.eventUnsubs.forEach((unsubscribe) => unsubscribe());
    this.eventUnsubs = [];
    if (this.tableUnsub) this.tableUnsub();
    if (this.tableSelectionUnsub) this.tableSelectionUnsub();
    this.tableUnsub = null;
    this.tableSelectionUnsub = null;
    this.isPlaying = false;
    this.autoFireActive = false;
  }
}
