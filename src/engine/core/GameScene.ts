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
import { BossRaidManager } from '../systems/BossRaidManager';
import { TableSelection } from '../../network/TableSelection';
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
  private postProcessor: AbyssalPostProcessor;
  private uiManager: UIManager;
  private multiplayerTable: MultiplayerTableManager;
  private presenceLayer: MultiplayerPresenceLayer | null = null;
  private tableUnsub: (() => void) | null = null;
  private tableSelectionUnsub: (() => void) | null = null;
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

  // New systems
  private bossRaid: BossRaidEvent;
  private lastBossBashActive = false;
  private tableSelection: TableSelection;
  private bossRaidTimer: ReturnType<typeof setInterval> | null = null;
  /** Combat progress toward next boss (not time-based). */
  private bossProgressScore = 0;
  private readonly BOSS_PROGRESS_THRESHOLD = 40;

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
    this.postProcessor = new AbyssalPostProcessor();
    this.spatialGrid = new SpatialHashGrid(128);
    this.fishManager = new FishManager(this.worldContainer, this.spatialGrid, width, height);
    this.particleFX = new ParticleFXManager(this.worldContainer, width, height);
    this.multiplayerTable = new MultiplayerTableManager();

    // Initialize new systems
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
        this.postProcessor.triggerImpactGlitch(0.015);
      },
      (userId, damage, fishId) => {
        if (this.bossRaid.isActive() && fishId === this.bossRaid.getBossId()) {
          this.bossRaid.recordDamage(userId, damage);
        }
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

    // Hook boss events directly to immersive backdrop darkening & audio atmosphere
    BossRaidManager.getInstance().subscribe((raid) => {
      const isRaidActive = raid.active && raid.status !== 'victory' && raid.status !== 'failed' && raid.status !== 'idle';
      const isEnraged = isRaidActive && (raid.enraged || raid.status === 'enraged');
      this.animatedBackground.setBossActive(isRaidActive, isEnraged);
      const hpPct = raid.sharedBossMaxHp > 0
        ? Math.round((raid.sharedBossHp / raid.sharedBossMaxHp) * 100)
        : 0;
      // Title is brief "FISH FRENZY" only; timer lives in HUD corner
      if (isRaidActive && !this.lastBossBashActive) {
        this.uiManager.showBossFrenzyTitle();
        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height * 0.22;
        this.particleFX.spawnExplosion(cx, cy, 0xff0033, 40);
        this.particleFX.spawnExplosion(cx - 40, cy + 20, 0x22d3ee, 18);
        this.particleFX.spawnExplosion(cx + 40, cy + 20, 0xfbbf24, 18);
        SoundManager.setBossMusic(true, isEnraged);
        SoundManager.playBossWarning();
      }
      if (!isRaidActive && this.lastBossBashActive) {
        SoundManager.setBossMusic(false, false);
        this.uiManager.setBossOverlay(false);
        this.bossProgressScore = 0;
      }
      if (isRaidActive) {
        this.uiManager.setBossOverlay(true, Math.ceil(raid.timeRemainingSec));
        SoundManager.setBossMusic(true, isEnraged);
      }
      this.lastBossBashActive = isRaidActive;
    });

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

    // Table selection: use current table from TableSelection
    const currentTable = this.tableSelection.getCurrentTable();
    this.multiplayerTable.joinSharedTable(currentTable.id, uid, name);
    this.tableSelection.joinPresence(uid, name);

    this.presenceLayer = new MultiplayerPresenceLayer(this.worldContainer);
    this.presenceLayer.setLocalUserId(uid);

    const joinTable = (table: TableConfig) => {
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

    this.tableSelectionUnsub = TableSelectionManager.getInstance().onTableChange((tbl) => {
      joinTable(tbl as any);
    });

    // Boss is progress-gated (shots/bets), never on room entry or fixed timer
    this.bossProgressScore = 0;

    // Seed a few more fish for an active room
    for (let i = 0; i < GameConfig.playStartExtraWaves; i++) {
      this.fishManager.spawnRandomWave();
    }
  }

  private tryStartBossFromProgress(): void {
    if (this.bossRaid.isActive()) return;
    const table = this.tableSelection.getCurrentTable() as any;
    if (table?.isPractice || table?.mode === 'practice') return;
    if (this.bossProgressScore < this.BOSS_PROGRESS_THRESHOLD) return;
    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    this.bossProgressScore = 0;
    this.bossRaid.startRaid(uid, (result) => {
      console.info('[BossRaid] completed', result);
    });
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
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    canvas.addEventListener('pointerup', endHold);
    canvas.addEventListener('pointercancel', endHold);
    canvas.addEventListener('pointerleave', () => {
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
      this.bossRaid.resize(width, height);
    });
  }

  private fireWeapon(targetX: number, targetY: number): void {
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
      return;
    }

    // Progress toward boss: shots + stake weight
    this.bossProgressScore += 1 + Math.min(4, betAmount);
    this.tryStartBossFromProgress();

    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    const barrels = this.uiManager.getBarrelCount();
    void this.weaponController.fireCannon(
      uid,
      FairnessSession.getInstance().getSessionId(),
      currency,
      betAmount * barrels,
      targetX,
      targetY
    );

    const currentTable = this.tableSelection.getCurrentTable();
    this.multiplayerTable.broadcastTableShot(
      currentTable.id,
      this.activeTableId,
      uid,
      targetX,
      targetY,
      betAmount * barrels
    );
  }

  public syncWalletBalances(gc: number, sc: number, _source?: string): void {
    this.uiManager.setBalances(gc, sc);
  }

  public update(deltaTime: number): void {
    this.animatedBackground.update(deltaTime);
    debugOverlay.ensure();
    debugOverlay.tick();

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
      if (this.autoFireTimer >= GameConfig.autoFireIntervalMs) {
        if (this.weaponController.canFire()) {
          this.fireWeapon(this.lastTargetX, this.lastTargetY);
          this.autoFireTimer = 0;
        }
      }
    }

    // Update boss raid
    this.bossRaid.update(deltaTime);
    const raidActive = this.bossRaid.isActive();
    if (raidActive && !this.lastBossBashActive) {
      this.uiManager.showBossFrenzyTitle();
      SoundManager.setBossMusic(true, false);
      SoundManager.playBossWarning();
      const cx = this.app.screen.width / 2;
      const cy = this.app.screen.height * 0.22;
      this.particleFX.spawnExplosion(cx, cy, 0xff0033, 40);
      this.particleFX.spawnExplosion(cx - 40, cy + 20, 0x22d3ee, 16);
    }
    if (raidActive) {
      const secs = Math.ceil(this.bossRaid.getState().timeRemaining / 1000);
      this.uiManager.setBossOverlay(true, secs);
      SoundManager.setBossMusic(true, this.bossRaid.getState().phase === 'enraged');
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
}
