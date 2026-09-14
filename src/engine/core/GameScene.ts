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

  private spawnTimer: number = 0;
  private autoFireActive: boolean = false;
  private autoFireTimer: number = 0;
  private lastTargetX: number = 0;
  private lastTargetY: number = 0;
  /** Game flow: idle until player hits Play on the start screen */
  private isPlaying: boolean = false;

  constructor(app: Application, uiRoot: HTMLElement) {
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
      },
      onAutoFireToggle: (enabled) => {
        this.autoFireActive = enabled;
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
      }
    );

    const postFilter = this.postProcessor.getFilter();
    if (postFilter) {
      this.worldContainer.filters = [postFilter];
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
    this.multiplayerTable.joinSharedTable(
      GameConfig.defaultTableId,
      GameConfig.localPlayerId,
      GameConfig.localDisplayName
    );
    // Seed a few more fish for an active trench
    for (let i = 0; i < GameConfig.playStartExtraWaves; i++) {
      this.fishManager.spawnRandomWave();
    }
  }

  private setupInputListeners(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener('pointermove', (e) => {
      if (!this.isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      this.lastTargetX = e.clientX - rect.left;
      this.lastTargetY = e.clientY - rect.top;
      this.weaponController.updateAim(this.lastTargetX, this.lastTargetY);
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      this.lastTargetX = clickX;
      this.lastTargetY = clickY;

      this.fireWeapon(clickX, clickY);
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
    const betAmount = this.uiManager.getCurrentBet();
    const currency = this.uiManager.getCurrency();

    if (!this.uiManager.deductBet()) {
      return; // Insufficient balance
    }

    this.weaponController.fireCannon(
      GameConfig.localPlayerId,
      GameConfig.localSessionId,
      currency,
      betAmount,
      targetX,
      targetY
    );

    this.multiplayerTable.broadcastTableShot(
      GameConfig.defaultTableId,
      GameConfig.localPlayerId,
      targetX,
      targetY,
      betAmount
    );
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

    // Auto-fire mechanism
    if (this.autoFireActive) {
      this.autoFireTimer += deltaTime;
      if (this.autoFireTimer > GameConfig.autoFireIntervalMs) {
        this.fireWeapon(this.lastTargetX, this.lastTargetY);
        this.autoFireTimer = 0;
      }
    }

    // Update systems
    this.fishManager.update(deltaTime, this.lastTargetX, this.lastTargetY);
    this.weaponController.update(deltaTime);
    this.particleFX.update(deltaTime);
  }
}
