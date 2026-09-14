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
import { AuthManager } from '../../network/AuthManager';
import { MultiplayerPresenceLayer } from '../systems/MultiplayerPresenceLayer';

export class GameScene {
  private app: Application;
  private worldContainer: Container;
  private animatedBackground: AnimatedBackground;
  private spatialGrid: SpatialHashGrid;
  private fishManager: FishManager;
  private weaponController: WeaponController;
  private particleFX: ParticleFXManager;
  private themeManager: ThemeManager;
  private postProcessor: AbyssalPostProcessor;
  private uiManager: UIManager;
  private multiplayerTable: MultiplayerTableManager;
  private presenceLayer: MultiplayerPresenceLayer | null = null;
  private tableUnsub: (() => void) | null = null;
  private lastSeenShotTs = 0;
  private aimBroadcastTimer = 0;

  private spawnTimer: number = 0;
  private autoFireActive: boolean = false;
  private autoFireTimer: number = 0;
  private lastTargetX: number = 0;
  private lastTargetY: number = 0;
  /** Game flow: idle until player hits Play on the start screen */
  private isPlaying: boolean = false;
  private postFxEnabled: boolean = true;
  private particlesEnabled: boolean = true;

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

    // Layer 0: Animated living background (caustics, god rays, marine snow, rising bubbles)
    this.animatedBackground = new AnimatedBackground(width, height);
    this.app.stage.addChild(this.animatedBackground.container);

    // Layer 1: Game world (entities, projectiles, fx)
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.themeManager = new ThemeManager(app);
    this.postProcessor = new AbyssalPostProcessor();
    this.spatialGrid = new SpatialHashGrid(128);
    this.fishManager = new FishManager(this.worldContainer, this.spatialGrid, width, height);
    this.particleFX = new ParticleFXManager(this.worldContainer, width, height);
    this.multiplayerTable = new MultiplayerTableManager();

    this.uiManager = new UIManager(uiRoot, {
      onThemeChange: (theme) => {
        this.themeManager.setTheme(theme);
        this.animatedBackground.setTheme(theme);
        this.fishManager.setTheme(theme);
        SoundManager.setTheme(theme);
      },
      // Auto-fire is hold-to-fire on canvas (no HUD toggle)
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
        this.postProcessor.triggerImpactGlitch(0.015);
      }
    );

    if (this.postFxEnabled) {
      const postFilter = this.postProcessor.getFilter();
      if (postFilter) {
        this.worldContainer.filters = [postFilter];
      }
    }

    this.lastTargetX = width / 2;
    this.lastTargetY = height / 3;

    this.setupInputListeners();
    this.setupResizeListener();

    // Show start screen; gameplay + multiplayer join after Play
    this.uiManager.showStartScreen();
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
    // Presence is cosmetic (not authoritative table settlement)
    this.multiplayerTable.joinSharedTable(GameConfig.defaultTableId, uid, name);
    this.presenceLayer = new MultiplayerPresenceLayer(this.worldContainer);
    this.presenceLayer.setLocalUserId(uid);
    this.tableUnsub = this.multiplayerTable.subscribeToTableState(GameConfig.defaultTableId, (state) => {
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
    // Seed a few more fish for an active trench
    for (let i = 0; i < GameConfig.playStartExtraWaves; i++) {
      this.fishManager.spawnRandomWave();
    }
  }

  private setupInputListeners(): void {
    const canvas = this.app.canvas;

    const syncAim = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      this.lastTargetX = clientX - rect.left;
      this.lastTargetY = clientY - rect.top;
      this.weaponController.updateAim(this.lastTargetX, this.lastTargetY);
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

    // Hold = continuous auto-fire toward aim; release stops
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying) return;
      canvas.setPointerCapture?.(e.pointerId);
      syncAim(e.clientX, e.clientY);
      this.autoFireActive = true;
      this.autoFireTimer = 0; // interval counted from this shot; no instant double-fire
      this.fireWeapon(this.lastTargetX, this.lastTargetY);
    });

    const endHold = (e: PointerEvent) => {
      this.autoFireActive = false;
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    canvas.addEventListener('pointerup', endHold);
    canvas.addEventListener('pointercancel', endHold);
    canvas.addEventListener('pointerleave', () => {
      // only stop if no buttons held (mouse drag off canvas)
      this.autoFireActive = false;
    });
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      const width = this.app.screen.width;
      const height = this.app.screen.height;

      this.animatedBackground.resize(width, height);
      this.fishManager.resize(width, height);
      this.weaponController.resize(width, height);
      this.particleFX.resize(width, height);
    });
  }

  private fireWeapon(targetX: number, targetY: number): void {
    // Charge only when a shot can actually leave the barrel (fixes multi-SC deduct on cooldown)
    if (!this.weaponController.canFire()) {
      return;
    }

    const betAmount = this.uiManager.getCurrentBet();
    const currency = this.uiManager.getCurrency();
    if (currency === 'SC' && FeatureFlags.realSc && !isFirebaseConfigured) {
      console.warn('[SC] Real-SC mode requires Firebase — switch to GC or configure env.');
      return;
    }

    if (!this.uiManager.deductBet()) {
      return; // Insufficient balance
    }

    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    void this.weaponController.fireCannon(
      uid,
      FairnessSession.getInstance().getSessionId(),
      currency,
      betAmount,
      targetX,
      targetY
    );

    this.multiplayerTable.broadcastTableShot(
      GameConfig.defaultTableId,
      uid,
      targetX,
      targetY,
      betAmount
    );
  }

  /** Push server/local wallet into the DOM HUD */
  public syncWalletBalances(gc: number, sc: number, _source?: string): void {
    this.uiManager.setBalances(gc, sc);
  }

  public update(deltaTime: number): void {
    // Always animate the living background
    this.animatedBackground.update(deltaTime);

    if (!this.isPlaying) {
      // Idle: gentle fish drift for the title scene, no shooting / betting
      this.spatialGrid.clear();
      this.fishManager.update(deltaTime);
      this.particleFX.update(deltaTime);
      return;
    }

    this.spatialGrid.clear();

    // Fish waves spawn schedule
    this.spawnTimer += deltaTime;
    if (this.spawnTimer > GameConfig.spawnIntervalMs) {
      this.fishManager.spawnRandomWave();
      this.spawnTimer = 0;
    }

    // Hold-to-fire: pace shots by interval AND weapon cooldown
    if (this.autoFireActive) {
      this.autoFireTimer += deltaTime;
      if (this.autoFireTimer >= GameConfig.autoFireIntervalMs) {
        if (this.weaponController.canFire()) {
          this.fireWeapon(this.lastTargetX, this.lastTargetY);
          this.autoFireTimer = 0;
        }
        // else keep timer at threshold and retry next frame when cooldown ready
      }
    }

    // Update systems
    this.fishManager.update(deltaTime, this.lastTargetX, this.lastTargetY);
    this.weaponController.update(deltaTime);
    this.particleFX.update(deltaTime);
  }
}
