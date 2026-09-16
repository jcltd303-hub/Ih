import { Texture, Rectangle, AnimatedSprite, Container, Graphics, Assets } from 'pixi.js';

export type FishAnimState = 'swim_left' | 'swim_right' | 'turn_left' | 'turn_right';
export type FishSpecies = 'small' | 'medium' | 'angler' | 'boss';
export type TurretSkinId = 'default' | 'plasma_neon' | 'abyssal_dread' | 'cyber_gold';

export interface FishFrameset {
  swimLeft: Texture[];
  swimRight: Texture[];
  turnLeft: Texture[];
  turnRight: Texture[];
}

export interface FishAnimationRig {
  container: Container;
  sprite: AnimatedSprite;
  currentState: FishAnimState;
  currentTheme: 'light' | 'dark';
  species: FishSpecies;
  isTurning: boolean;
  playState: (state: FishAnimState, onComplete?: () => void) => void;
  setSpeed: (speedMultiplier: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  tint: (color: number) => void;
  resetTint: () => void;
}

export interface TurretSkinData {
  id: TurretSkinId;
  name: string;
  idleFrames: Texture[];
  chargeFrames: Texture[];
  fireFrames: Texture[];
  fullFireSequence: Texture[];
  bulletColor: number;
  strokeColor: number;
  coreColor: number;
  drawBase: (g: Graphics) => void;
}

export interface TurretAnimationRig {
  container: Container;
  baseSprite: Graphics;
  headContainer: Container;
  turretSprite: AnimatedSprite;
  activeSkin: TurretSkinId;
  recoilOffset: number;
  setSkin: (skinId: TurretSkinId) => void;
  playFire: (onMuzzleFlash?: () => void) => void;
  update: (deltaTime: number) => void;
}

export class SpriteSheetManager {
  private static instance: SpriteSheetManager;
  private fishSwimLeftFrames: Texture[] = [];
  private fishSwimRightFrames: Texture[] = [];
  private fishTurnLeftFrames: Texture[] = [];
  private fishTurnRightFrames: Texture[] = [];
  private fishFrameSets: Map<string, FishFrameset> = new Map();
  private turretSkins: Map<TurretSkinId, TurretSkinData> = new Map();
  private isInitialized: boolean = false;

  public static getInstance(): SpriteSheetManager {
    if (!SpriteSheetManager.instance) SpriteSheetManager.instance = new SpriteSheetManager();
    return SpriteSheetManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.buildFishSpriteSheets();
    this.buildTurretSpriteSheets();
    this.isInitialized = true;
    console.log('[SpriteSheetManager] Initialized animated sprite sheets successfully.');
  }

  private buildFishSpriteSheets(): void {
    const speciesList: Array<'small' | 'medium' | 'angler'> = ['small', 'medium', 'angler'];
    const themes: Array<'light' | 'dark'> = ['light', 'dark'];

    for (const species of speciesList) {
      for (const theme of themes) {
        const swimLeft: Texture[] = [];
        const swimRight: Texture[] = [];
        const turnLeft: Texture[] = [];
        const turnRight: Texture[] = [];

        for (let f = 0; f < 8; f++) {
          const phase = (f / 8) * Math.PI * 2;
          const canvas = this.renderSpeciesFrame(species, theme, 'left', phase, 0);
          swimLeft.push(Texture.from(canvas));
        }
        for (let f = 0; f < 8; f++) {
          const phase = (f / 8) * Math.PI * 2;
          const canvas = this.renderSpeciesFrame(species, theme, 'right', phase, 0);
          swimRight.push(Texture.from(canvas));
        }
        for (let f = 0; f < 8; f++) {
          const progress = f / 7;
          const phase = progress * Math.PI;
          turnLeft.push(Texture.from(this.renderSpeciesTurnFrame(species, theme, 'turn_left', progress, phase)));
          turnRight.push(Texture.from(this.renderSpeciesTurnFrame(species, theme, 'turn_right', progress, phase)));
        }

        this.fishFrameSets.set(`${species}_${theme}`, { swimLeft, swimRight, turnLeft, turnRight });
      }
    }

    const defaultSet = this.fishFrameSets.get('medium_light')!;
    this.fishSwimLeftFrames = defaultSet.swimLeft;
    this.fishSwimRightFrames = defaultSet.swimRight;
    this.fishTurnLeftFrames = defaultSet.turnLeft;
    this.fishTurnRightFrames = defaultSet.turnRight;
  }

  private renderSpeciesFrame(
    species: 'small' | 'medium' | 'angler',
    theme: 'light' | 'dark',
    direction: 'left' | 'right',
    phase: number,
    yawAngle: number
  ): HTMLCanvasElement {
    if (species === 'small') return this.renderTetraFrame(theme, direction, phase, yawAngle);
    if (species === 'angler') return this.renderAnglerFrame(theme, direction, phase, yawAngle);
    return this.renderLionfishFrame(theme, direction, phase, yawAngle);
  }

  private renderSpeciesTurnFrame(
    species: 'small' | 'medium' | 'angler',
    theme: 'light' | 'dark',
    type: 'turn_left' | 'turn_right',
    progress: number,
    phase: number
  ): HTMLCanvasElement {
    if (species === 'small') return this.renderTetraTurnFrame(theme, type, progress, phase);
    if (species === 'angler') return this.renderAnglerTurnFrame(theme, type, progress, phase);
    return this.renderLionfishTurnFrame(theme, type, progress, phase);
  }
