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
import { BossRaidEvent } from '../systems/BossRaidEvent';
import { ShareClipManager } from '../systems/ShareClipManager';
import { TableSelection } from '../../network/TableSelection';
import { TableSelectionManager, TableConfig } from '../../network/TableSelectionManager';
import { BossRaidManager } from '../systems/BossRaidManager';

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
  private shareClip: ShareClipManager;
  private tableSelection: TableSelection;
  private clipRecording = false;
  private bossRaidTimer: ReturnType<typeof setInterval> | null = null;

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
    this.shareClip = new ShareClipManager(this.app, this.particleFX);
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
      },
      (killText) => {
        if (this.clipRecording) {
          void this.shareClip.shareClip(killText);
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

    // Start clip recording
    this.shareClip.startRecording();
    this.clipRecording = true;

    // Boss raid every ~3 minutes (only on public/tournament tables)
    if (!currentTable.isPractice) {
      this.bossRaidTimer = setInterval(() => {
        if (!this.bossRaid.isActive()) {
          this.bossRaid.startRaid(uid, (result) => {
            console.info('[BossRaid] completed', result);
          });
        }
      }, 180000);
      // First raid after 60s
      setTimeout(() => {
        if (!this.bossRaid.isActive()) {
          this.bossRaid.startRaid(uid);
        }
      }, 60000);
    }

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

    const uid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    void this.weaponController.fireCannon(
      uid,
      FairnessSession.getInstance().getSessionId(),
      currency,
      betAmount,
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
      betAmount
    );
  }

  public syncWalletBalances(gc: number, sc: number, _source?: string): void {
    this.uiManager.setBalances(gc, sc);
  }

  public update(deltaTime: number): void {
    this.animatedBackground.update(deltaTime);

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

    // Record clip frames
    if (this.clipRecording) {
      const projArr: Array<{x:number;y:number;color:number}> = [];
      const wc = this.weaponController as any;
      if (wc.activeProjectiles) {
        for (const p of wc.activeProjectiles.values()) {
          projArr.push({ x: p.x, y: p.y, color: p.currencyType === 'SC' ? 0x00ffcc : 0xffb703 });
        }
      }
      const fishArr: Array<{x:number;y:number;type:string;hpPct:number}> = [];
      const fm = this.fishManager as any;
      if (fm.activeFish) {
        for (const f of fm.activeFish.values()) {
          fishArr.push({ x: f.x, y: f.y, type: f.typeId, hpPct: f.hp / (f.maxHp || 1) });
        }
      }
      this.shareClip.captureFrame(projArr, fishArr);
    }

    this.fishManager.update(deltaTime, this.lastTargetX, this.lastTargetY);
    this.weaponController.update(deltaTime);
    this.particleFX.update(deltaTime);
  }
}
