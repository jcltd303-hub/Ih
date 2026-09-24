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
  updatePose: (deltaSeconds: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  tint: (color: number) => void;
  resetTint: () => void;
  destroy: (options?: { children?: boolean }) => void;
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

  // Cached frame textures
  private fishSwimLeftFrames: Texture[] = [];
  private fishSwimRightFrames: Texture[] = [];
  private fishTurnLeftFrames: Texture[] = [];
  private fishTurnRightFrames: Texture[] = [];

  // Multi-species & multi-theme frame sets:
  // Keys: "small_light", "small_dark", "medium_light", "medium_dark", "angler_light", "angler_dark"
  private fishFrameSets: Map<string, FishFrameset> = new Map();

  // Turret skins frame maps
  private turretSkins: Map<TurretSkinId, TurretSkinData> = new Map();

  private isInitialized: boolean = false;

  public static getInstance(): SpriteSheetManager {
    if (!SpriteSheetManager.instance) {
      SpriteSheetManager.instance = new SpriteSheetManager();
    }
    return SpriteSheetManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Build only metadata/fallback state, then replace every gameplay frame
    // with authored raster artwork before any Pixi rig can be created.
    this.buildPlasmaNeonSkin();
    this.buildAbyssalDreadSkin();
    this.buildCyberGoldSkin();
    this.buildDefaultSkin();
    await Promise.all([
      this.loadAuthoredFishSpriteSheets(),
      this.loadExternalSpriteSheets()
    ]);

    this.isInitialized = true;
    console.log('[SpriteSheetManager] Initialized animated sprite sheets successfully.');
  }

  private assetUrl(path: string): string {
    const base = import.meta.env.BASE_URL || '/';
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private async loadAuthoredFishSpriteSheets(): Promise<void> {
    // These are single authored raster cutouts. Pixi animates them as articulated
    // containers (body/root + tail/fin motion) rather than chopping the source
    // artwork into arbitrary atlas cells.
    const authored: Record<'small' | 'medium' | 'angler', string> = {
      small: 'Untitled design_20260924_033437_0000.png',
      medium: 'file_000000005b7481f58b53685838851dcc.png',
      angler: 'Untitled design_20260924_033554_0000.png'
    };

    for (const [species, path] of Object.entries(authored) as Array<['small' | 'medium' | 'angler', string]>) {
      const texture = await Assets.load(this.assetUrl(path)) as Texture;
      const frames = Array.from({ length: 8 }, () => texture);
      const set: FishFrameset = {
        swimLeft: frames.slice(),
        swimRight: frames.slice(),
        turnLeft: frames.slice(),
        turnRight: frames.slice()
      };
      this.fishFrameSets.set(`${species}_light`, set);
      this.fishFrameSets.set(`${species}_dark`, set);
    }

    const defaultSet = this.fishFrameSets.get('medium_light')!;
    this.fishSwimLeftFrames = defaultSet.swimLeft;
    this.fishSwimRightFrames = defaultSet.swimRight;
    this.fishTurnLeftFrames = defaultSet.turnLeft;
    this.fishTurnRightFrames = defaultSet.turnRight;
  }

  private async loadExternalSpriteSheets(): Promise<void> {
    const skins: { id: TurretSkinId; file: string }[] = [
      { id: 'plasma_neon', file: 'skins/plasma_neon_sheet.png' },
      { id: 'cyber_gold', file: 'skins/cyber_gold_sheet.png' },
      { id: 'abyssal_dread', file: 'skins/abyssal_dread_sheet.png' },
      { id: 'default', file: 'skins/default_sheet.png' }
    ];

    for (const item of skins) {
      const frames = await this.loadCalibratedSheet(this.assetUrl(item.file));
      try {
        if (frames.length >= 12) {
          const skin = this.turretSkins.get(item.id);
          if (skin) {
            skin.idleFrames = [frames[0], frames[1], frames[2], frames[3]];
            skin.chargeFrames = [frames[4], frames[5], frames[6]];
            skin.fireFrames = [frames[7], frames[8]];
            skin.fullFireSequence = [
              frames[4], frames[5], frames[7], frames[8],
              frames[9], frames[10], frames[11], frames[0]
            ];
            console.log(`[SpriteSheetManager] Loaded calibrated high-res sprite sheet for ${item.id}`);
          }
        }
      } catch (e) {
        console.warn(`[SpriteSheetManager] Fallback active for ${item.id}`, e);
      }
    }
  }

  private loadCalibratedSheet(url: string): Promise<Texture[]> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const frameW = 192;
        const frameH = 192;
        const cols = Math.floor(img.width / frameW);
        const textures: Texture[] = [];

        for (let i = 0; i < cols; i++) {
          const canvas = document.createElement('canvas');
          canvas.width = frameW;
          canvas.height = frameH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, i * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
            textures.push(Texture.from(canvas));
          }
        }
        resolve(textures);
      };
      img.onerror = () => resolve([]);
      img.src = url;
    });
  }

  /**
   * 1. Plasma Neon Railgun Skin (Inspired by 1789267203509.png)
   */
  private buildPlasmaNeonSkin(): void {
    const size = 140;
    const idleFrames: Texture[] = [];
    const chargeFrames: Texture[] = [];
    const fireFrames: Texture[] = [];
    const fullFireSequence: Texture[] = [];

    for (let f = 0; f < 16; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      ctx.translate(size / 2, size / 2);

      const isCharging = f >= 2 && f <= 4;
      const isFiring = f >= 5 && f <= 8;
      const isRecoil = f >= 9 && f <= 12;

      let recoilY = 0;
      if (isFiring) recoilY = 7;
      else if (isRecoil) recoilY = Math.max(0, 7 - (f - 8) * 1.8);

      // Chassis Body (pointing UP at -Y)
      ctx.save();
      ctx.translate(0, recoilY);

      // Outer Cyan Aerodynamic Shroud
      ctx.fillStyle = '#082f49';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-28, 26);
      ctx.quadraticCurveTo(-34, 0, -22, -22);
      ctx.lineTo(-12, -48); // Left rail tip
      ctx.lineTo(-4, -48);
      ctx.lineTo(-4, -18);
      ctx.lineTo(4, -18);
      ctx.lineTo(4, -48);
      ctx.lineTo(12, -48);  // Right rail tip
      ctx.lineTo(22, -22);
      ctx.quadraticCurveTo(34, 0, 28, 26);
      ctx.quadraticCurveTo(0, 36, -28, 26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rail Magnetic Accelerators
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-11, -44, 6, 26);
      ctx.fillRect(5, -44, 6, 26);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(-11, -44, 6, 26);
      ctx.strokeRect(5, -44, 6, 26);

      // Magnetic Coils along rails
      for (let c = 0; c < 4; c++) {
        const cy = -40 + c * 6;
        ctx.fillStyle = isCharging || isFiring ? '#ffffff' : '#00f0ff';
        ctx.fillRect(-10, cy, 4, 2);
        ctx.fillRect(6, cy, 4, 2);
      }

      // Glowing Magenta Energy Ring Aperture
      const ringGlow = isFiring ? 1.0 : isCharging ? 0.85 : 0.45 + Math.sin(f * 0.7) * 0.15;
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(0, 4, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(244, 63, 94, ${ringGlow})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 4, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Core
      const coreGrad = ctx.createRadialGradient(0, 4, 1, 0, 4, 12);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, `rgba(255, 0, 127, ${ringGlow})`);
      coreGrad.addColorStop(0.7, `rgba(225, 29, 72, ${ringGlow * 0.7})`);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 4, 12, 0, Math.PI * 2);
      ctx.fill();

      // Electric Lightning Arcs in Charge / Pre-fire
      if (isCharging || f === 5) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(-8, -12);
        ctx.lineTo(-3, -24);
        ctx.lineTo(-9, -38);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(8, -10);
        ctx.lineTo(4, -26);
        ctx.lineTo(10, -40);
        ctx.stroke();
      }

      // Blinding Muzzle Blast & Kinetic Slug Flight in Firing frames
      if (isFiring) {
        // Dual Beam Plume between the rails
        const beamGrad = ctx.createLinearGradient(0, 0, 0, -68);
        beamGrad.addColorStop(0, '#ffffff');
        beamGrad.addColorStop(0.4, 'rgba(0, 240, 255, 0.95)');
        beamGrad.addColorStop(0.8, 'rgba(255, 0, 127, 0.7)');
        beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(-6, -18);
        ctx.lineTo(6, -18);
        ctx.lineTo(12, -68);
        ctx.lineTo(-12, -68);
        ctx.closePath();
        ctx.fill();

        // White-hot plasma slug projectile launching forward
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, -48, 5, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Muzzle flare spikes
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-18, -48); ctx.lineTo(18, -48);
        ctx.moveTo(0, -66); ctx.lineTo(0, -32);
        ctx.stroke();
      }

      // Spent Cartridge Ejection during recoil
      if (isRecoil) {
        const off = (f - 9) * 7;
        ctx.save();
        ctx.translate(22 + off, 2 - off * 0.4);
        ctx.rotate((f - 9) * 0.7);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-3, -6, 6, 12);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-3, -6, 6, 12);
        ctx.restore();

        // Cooling Smoke Vents
        ctx.fillStyle = `rgba(226, 232, 240, ${0.45 - (f - 9) * 0.1})`;
        ctx.beginPath();
        ctx.arc(0, -20, 10 + (f - 9) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // end recoil translate
      ctx.restore(); // end center translate

      const tex = Texture.from(canvas);
      if (f <= 2 || f === 15) idleFrames.push(tex);
      if (f >= 2 && f <= 4) chargeFrames.push(tex);
      if (f >= 5 && f <= 8) fireFrames.push(tex);
      fullFireSequence.push(tex);
    }

    this.turretSkins.set('plasma_neon', {
      id: 'plasma_neon',
      name: 'Plasma Neon',
      idleFrames,
      chargeFrames,
      fireFrames,
      fullFireSequence,
      bulletColor: 0x00ffcc,
      strokeColor: 0xff007f,
      coreColor: 0xff007f,
      drawBase: (g: Graphics) => {
        g.clear();
        // Hexagonal high-tech base pedestal
        g.poly([
          { x: -36, y: 18 }, { x: -36, y: -18 },
          { x: 0, y: -38 }, { x: 36, y: -18 },
          { x: 36, y: 18 }, { x: 0, y: 38 }
        ]);
        g.fill({ color: 0x031d33, alpha: 0.95 });
        g.stroke({ width: 3, color: 0x00f0ff, alpha: 0.9 });
        // Neon power conduits
        g.circle(0, 0, 26);
        g.stroke({ width: 1.5, color: 0xf43f5e, alpha: 0.85 });
      }
    });
  }

  /**
   * 2. Abyssal Dread Spiked Rotary Cannon (Inspired by 1789267331314.png)
   */
  private buildAbyssalDreadSkin(): void {
    const size = 140;
    const idleFrames: Texture[] = [];
    const chargeFrames: Texture[] = [];
    const fireFrames: Texture[] = [];
    const fullFireSequence: Texture[] = [];

    for (let f = 0; f < 16; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      ctx.translate(size / 2, size / 2);

      const isCharging = f >= 2 && f <= 4;
      const isFiring = f >= 5 && f <= 8;
      const isRecoil = f >= 9 && f <= 12;

      let recoilY = 0;
      if (isFiring) recoilY = 8;
      else if (isRecoil) recoilY = Math.max(0, 8 - (f - 8) * 2);

      ctx.save();
      ctx.translate(0, recoilY);

      // Heavy Spiked Armor Collar (8 Spikes around chassis)
      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 2;
      for (let s = 0; s < 10; s++) {
        const a = (s * Math.PI * 2) / 10;
        const x1 = Math.cos(a) * 32;
        const y1 = Math.sin(a) * 32;
        const x2 = Math.cos(a) * 44;
        const y2 = Math.sin(a) * 44;
        ctx.beginPath();
        ctx.moveTo(x1 - 4, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x1 + 4, y1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Main Armored Spherical Dome
      const domeGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 32);
      domeGrad.addColorStop(0, '#3f3f46');
      domeGrad.addColorStop(0.5, '#18181b');
      domeGrad.addColorStop(1, '#09090b');
      ctx.fillStyle = domeGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Blood-Red Radiator Gills / Heat Grates
      const heatIntensity = isFiring ? 1.0 : isCharging ? 0.8 : 0.4 + Math.sin(f * 0.8) * 0.2;
      ctx.strokeStyle = `rgba(239, 68, 68, ${heatIntensity})`;
      ctx.lineWidth = 2.5;
      for (let g = -3; g <= 3; g++) {
        const gy = g * 6;
        const gw = Math.sqrt(Math.max(0, 30 * 30 - gy * gy)) * 0.75;
        ctx.beginPath();
        ctx.moveTo(-gw, gy);
        ctx.lineTo(gw, gy);
        ctx.stroke();
      }

      // Rotary Heavy Gatling Shroud (pointing UP)
      ctx.fillStyle = '#1c1917';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-10, -56, 20, 32);
      ctx.strokeRect(-10, -56, 20, 32);

      // Rotary Barrels
      ctx.fillStyle = '#450a0a';
      const barrelRot = (f * 0.8) % Math.PI;
      const bx = Math.sin(barrelRot) * 4;
      ctx.fillRect(-7 + bx, -60, 4, 34);
      ctx.fillRect(3 - bx, -60, 4, 34);

      // Red Laser Targeting Tracer in charge state
      if (isCharging) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -60);
        ctx.lineTo(0, -78);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -78, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Massive Explosive Crimson Muzzle Blast in firing frames
      if (isFiring) {
        // Starburst flame
        const flameGrad = ctx.createRadialGradient(0, -64, 2, 0, -64, 30);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#fca5a5');
        flameGrad.addColorStop(0.6, '#ef4444');
        flameGrad.addColorStop(1, 'rgba(153, 27, 27, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(0, -64, 28, 0, Math.PI * 2);
        ctx.fill();

        // Jagged blast spikes
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-16, -64); ctx.lineTo(16, -64);
        ctx.moveTo(0, -82); ctx.lineTo(0, -48);
        ctx.moveTo(-12, -76); ctx.lineTo(12, -52);
        ctx.moveTo(12, -76); ctx.lineTo(-12, -52);
        ctx.stroke();
      }

      // Red-hot spent brass ejection in recoil
      if (isRecoil) {
        const off = (f - 9) * 7;
        ctx.save();
        ctx.translate(22 + off, -15 - off * 0.3);
        ctx.rotate((f - 9) * 0.8);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(-3, -7, 6, 14);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-3, -7, 6, 14);
        ctx.restore();

        // Dark heavy propellant smoke
        ctx.fillStyle = `rgba(39, 39, 42, ${0.55 - (f - 9) * 0.12})`;
        ctx.beginPath();
        ctx.arc(0, -64, 12 + (f - 9) * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // end recoil translate
      ctx.restore(); // end center translate

      const tex = Texture.from(canvas);
      if (f <= 2 || f === 15) idleFrames.push(tex);
      if (f >= 2 && f <= 4) chargeFrames.push(tex);
      if (f >= 5 && f <= 8) fireFrames.push(tex);
      fullFireSequence.push(tex);
    }

    this.turretSkins.set('abyssal_dread', {
      id: 'abyssal_dread',
      name: 'Abyssal Dread',
      idleFrames,
      chargeFrames,
      fireFrames,
      fullFireSequence,
      bulletColor: 0xff0033,
      strokeColor: 0xff6688,
      coreColor: 0xdc2626,
      drawBase: (g: Graphics) => {
        g.clear();
        // Heavy spiked fortress base
        g.circle(0, 0, 36);
        g.fill({ color: 0x09090b, alpha: 0.98 });
        g.stroke({ width: 3.5, color: 0xef4444, alpha: 0.95 });
        // Spikes on base
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4;
          const sx = Math.cos(ang) * 44;
          const sy = Math.sin(ang) * 44;
          g.circle(sx, sy, 3.5);
          g.fill({ color: 0x71717a, alpha: 1.0 });
        }
      }
    });
  }

  /**
   * 3. Cyber Gold Solar Sunstone Obelisk (Inspired by 1789267423057.png)
   */
  private buildCyberGoldSkin(): void {
    const size = 140;
    const idleFrames: Texture[] = [];
    const chargeFrames: Texture[] = [];
    const fireFrames: Texture[] = [];
    const fullFireSequence: Texture[] = [];

    for (let f = 0; f < 16; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      ctx.translate(size / 2, size / 2);

      const isCharging = f >= 2 && f <= 4;
      const isFiring = f >= 5 && f <= 8;
      const isOverheat = f >= 9 && f <= 12;

      let recoilY = 0;
      if (isFiring) recoilY = 6;
      else if (isOverheat) recoilY = Math.max(0, 6 - (f - 8) * 1.5);

      ctx.save();
      ctx.translate(0, recoilY);

      // Antique Gilded Stepped Pedestal (Bronze/Gold filigree)
      const baseGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 42);
      baseGrad.addColorStop(0, '#fef08a');
      baseGrad.addColorStop(0.4, '#d97706');
      baseGrad.addColorStop(0.8, '#78350f');
      baseGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Relief Filigree Ring
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();

      // Forward Gilded Solar Armatures (pointing UP at -Y)
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-16, -20);
      ctx.lineTo(-8, -48);
      ctx.lineTo(-2, -48);
      ctx.lineTo(-6, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(16, -20);
      ctx.lineTo(8, -48);
      ctx.lineTo(2, -48);
      ctx.lineTo(6, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Faceted Golden Sunstone / Topaz Gemstone Lens
      const gemRadius = 20;
      let gemCenterColor = '#ffffff';
      let gemMidColor = '#fbbf24';
      let gemEdgeColor = '#b45309';

      if (isOverheat) {
        // Incandescent Ruby Thermal Overheat
        gemCenterColor = '#ffedd5';
        gemMidColor = '#ef4444';
        gemEdgeColor = '#7f1d1d';
      } else if (isCharging || isFiring) {
        // Blinding Solar Radiance
        gemCenterColor = '#ffffff';
        gemMidColor = '#fef08a';
        gemEdgeColor = '#f59e0b';
      }

      const gemGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, gemRadius);
      gemGrad.addColorStop(0, gemCenterColor);
      gemGrad.addColorStop(0.5, gemMidColor);
      gemGrad.addColorStop(1, gemEdgeColor);
      ctx.fillStyle = gemGrad;
      ctx.beginPath();
      ctx.arc(0, 0, gemRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Faceted Gem Facets (Topaz crystal lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * gemRadius, Math.sin(ang) * gemRadius);
        ctx.stroke();
      }

      // Solar Corona Flare in Charge / Pre-fire
      if (isCharging) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 26 + (f - 2) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Blinding Golden Solar Lance Beam in firing frames
      if (isFiring) {
        // Intense forward ray beam
        const rayGrad = ctx.createLinearGradient(0, 0, 0, -70);
        rayGrad.addColorStop(0, '#ffffff');
        rayGrad.addColorStop(0.3, '#fef08a');
        rayGrad.addColorStop(0.7, '#f59e0b');
        rayGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(10, -20);
        ctx.lineTo(16, -70);
        ctx.lineTo(-16, -70);
        ctx.closePath();
        ctx.fill();

        // Blinding golden starburst
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-20, -50); ctx.lineTo(20, -50);
        ctx.moveTo(0, -70); ctx.lineTo(0, -30);
        ctx.stroke();
      }

      // Steam & thermal dissipation during overheat
      if (isOverheat) {
        const off = (f - 9) * 6;
        ctx.save();
        ctx.translate(20 + off, -10 - off * 0.4);
        ctx.rotate((f - 9) * 0.6);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-3, -6, 6, 12);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.strokeRect(-3, -6, 6, 12);
        ctx.restore();

        // White Steam venting
        ctx.fillStyle = `rgba(254, 243, 199, ${0.45 - (f - 9) * 0.1})`;
        ctx.beginPath();
        ctx.arc(0, -28, 12 + (f - 9) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // end recoil translate
      ctx.restore(); // end center translate

      const tex = Texture.from(canvas);
      if (f <= 2 || f === 15) idleFrames.push(tex);
      if (f >= 2 && f <= 4) chargeFrames.push(tex);
      if (f >= 5 && f <= 8) fireFrames.push(tex);
      fullFireSequence.push(tex);
    }

    this.turretSkins.set('cyber_gold', {
      id: 'cyber_gold',
      name: 'Cyber Gold',
      idleFrames,
      chargeFrames,
      fireFrames,
      fullFireSequence,
      bulletColor: 0xfbbf24,
      strokeColor: 0xfffbeb,
      coreColor: 0xf59e0b,
      drawBase: (g: Graphics) => {
        g.clear();
        // Filigreed antique gold base pedestal
        g.circle(0, 0, 38);
        g.fill({ color: 0x27170b, alpha: 0.96 });
        g.stroke({ width: 3.5, color: 0xfbbf24, alpha: 0.95 });
        // Ruby cabochon accents
        for (let r = 0; r < 6; r++) {
          const ang = (r * Math.PI) / 3;
          g.circle(Math.cos(ang) * 32, Math.sin(ang) * 32, 3);
          g.fill({ color: 0xef4444, alpha: 1.0 });
        }
      }
    });
  }

  /**
   * 4. Tactical Navy Dual-Barrel Skin (Default)
   */
  private buildDefaultSkin(): void {
    const size = 140;
    const idleFrames: Texture[] = [];
    const chargeFrames: Texture[] = [];
    const fireFrames: Texture[] = [];
    const fullFireSequence: Texture[] = [];

    for (let f = 0; f < 15; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      ctx.translate(size / 2, size / 2);

      const isFiring = f >= 5 && f <= 7;
      const isCharging = f >= 3 && f <= 4;
      const isRecoil = f >= 8 && f <= 11;

      let recoilY = 0;
      if (isFiring) recoilY = 8;
      else if (isRecoil) recoilY = Math.max(0, 8 - (f - 7) * 2);

      ctx.save();
      ctx.translate(0, recoilY);

      // Outer Naval Armor
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Twin Plasma Barrels (pointing UP at -Y)
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-14, -54, 8, 38);
      ctx.strokeRect(-14, -54, 8, 38);
      ctx.fillRect(6, -54, 8, 38);
      ctx.strokeRect(6, -54, 8, 38);

      // Core Glow
      const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, isFiring ? '#00f0ff' : '#0284c7');
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Muzzle flashes
      if (isFiring) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-10, -56, 16, 0, Math.PI * 2);
        ctx.arc(10, -56, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // end recoil translate
      ctx.restore(); // end center translate

      const tex = Texture.from(canvas);
      if (f <= 2) idleFrames.push(tex);
      if (f >= 3 && f <= 4) chargeFrames.push(tex);
      if (f >= 5 && f <= 7) fireFrames.push(tex);
      fullFireSequence.push(tex);
    }

    this.turretSkins.set('default', {
      id: 'default',
      name: 'Tactical Navy',
      idleFrames,
      chargeFrames,
      fireFrames,
      fullFireSequence,
      bulletColor: 0x60a5fa,
      strokeColor: 0xffffff,
      coreColor: 0x00f0ff,
      drawBase: (g: Graphics) => {
        g.clear();
        g.circle(0, 0, 34);
        g.fill({ color: 0x0f172a, alpha: 0.95 });
        g.stroke({ width: 3, color: 0x38bdf8, alpha: 0.9 });
      }
    });
  }

  public getFishFrameset(species: 'small' | 'medium' | 'angler', theme: 'light' | 'dark'): FishFrameset {
    if (this.fishFrameSets.size === 0) {
      throw new Error('Authored fish textures were not loaded before rig creation');
    }
    const set = this.fishFrameSets.get(`${species}_${theme}`) || this.fishFrameSets.get('medium_light') || this.fishFrameSets.get('small_light');
    if (!set) {
      throw new Error(`Missing authored fish frameset: ${species}_${theme}`);
    }
    return set;
  }

  /**
   * Creates an animated fish rig with state transitions (swim, turn, hit)
   * tailored to species (small Neon Tetra, medium Armored Lionfish, or angler Abyssal Anglerfish)
   * and responsive to theme (Light tech vs Dark horror).
   */
  public createFishAnimationRig(type: 'small' | 'medium' | 'boss' | 'angler', initialTheme: 'light' | 'dark' = 'light'): FishAnimationRig {
    const container = new Container();
    const species: 'small' | 'medium' | 'angler' = type === 'small' ? 'small' : (type === 'medium' ? 'medium' : 'angler');
    let currentTheme: 'light' | 'dark' = initialTheme;
    let currentSet = this.getFishFrameset(species, currentTheme);

    // Start with swim_right or swim_left
    const sprite = new AnimatedSprite(currentSet.swimRight);
    sprite.anchor.set(0.5, 0.5);
    sprite.animationSpeed = 0.22;
    sprite.play();
    container.addChild(sprite);

    // Lightweight skeletal-style root deformation: the authored cutout remains
    // the only visual source while the root bone bends/squashes the fish.
    let swimClock = Math.random() * Math.PI * 2;
    let swimSpeed = 1;

    // Scaling based on fish type
    const scale = type === 'boss' ? 0.72 : type === 'angler' ? 0.52 : type === 'medium' ? 0.44 : 0.30;
    container.scale.set(scale);

    const rig: FishAnimationRig = {
      container,
      sprite,
      currentState: 'swim_right',
      currentTheme,
      species,
      isTurning: false,
      setTheme: (theme: 'light' | 'dark') => {
        currentTheme = theme;
        rig.currentTheme = theme;
        currentSet = this.getFishFrameset(species, currentTheme);
        const currentFrameIndex = sprite.currentFrame % 8;
        if (rig.currentState === 'swim_left') {
          sprite.textures = currentSet.swimLeft;
        } else if (rig.currentState === 'swim_right') {
          sprite.textures = currentSet.swimRight;
        } else if (rig.currentState === 'turn_left') {
          sprite.textures = currentSet.turnLeft;
        } else {
          sprite.textures = currentSet.turnRight;
        }
        sprite.gotoAndPlay(currentFrameIndex);
      },
      playState: (state: FishAnimState, onComplete?: () => void) => {
        if (rig.currentState === state && !rig.isTurning) return;

        let frames: Texture[];
        let loop = true;
        let speed = 0.22;

        if (state === 'swim_left') {
          frames = currentSet.swimLeft;
          rig.isTurning = false;
        } else if (state === 'swim_right') {
          frames = currentSet.swimRight;
          rig.isTurning = false;
        } else if (state === 'turn_left') {
          frames = currentSet.turnLeft;
          loop = false;
          speed = 0.35;
          rig.isTurning = true;
        } else {
          // turn_right
          frames = currentSet.turnRight;
          loop = false;
          speed = 0.35;
          rig.isTurning = true;
        }

        rig.currentState = state;
        rig.sprite.textures = frames;
        rig.sprite.loop = loop;
        rig.sprite.animationSpeed = speed;
        rig.sprite.gotoAndPlay(0);

        if (!loop) {
          rig.sprite.onComplete = () => {
            rig.isTurning = false;
            rig.sprite.onComplete = undefined;
            if (onComplete) onComplete();
          };
        }
      },
      setSpeed: (mult: number) => {
        swimSpeed = Math.max(0.2, mult);
        if (!rig.isTurning) rig.sprite.animationSpeed = 0.18 * mult;
      },
      updatePose: (dt: number) => {
        swimClock += dt * (5.5 + swimSpeed * 2.5);
        const wave = Math.sin(swimClock);
        const bend = species === 'small' ? 0.055 : species === 'medium' ? 0.04 : 0.028;
        sprite.skew.y = wave * bend;
        sprite.scale.y = 1 + Math.abs(wave) * 0.018;
        sprite.scale.x = 1 - Math.abs(wave) * 0.012;
      },
      tint: (color: number) => {
        rig.sprite.tint = color;
      },
      resetTint: () => {
        rig.sprite.tint = 0xffffff;
      },
      destroy: (options?: { children?: boolean }) => {
        rig.sprite.onComplete = undefined;
        if (!rig.container.destroyed) rig.container.destroy(options);
      }
    };

    return rig;
  }

  /**
   * Creates an animated turret cannon rig with support for all skins
   */
  public createTurretRig(initialSkin: TurretSkinId = 'plasma_neon'): TurretAnimationRig {
    const container = new Container();

    // Base pedestal graphic
    const baseSprite = new Graphics();
    container.addChild(baseSprite);

    // Head container (rotates with aim)
    const headContainer = new Container();
    container.addChild(headContainer);

    // Active skin data
    const skinData = this.turretSkins.get(initialSkin) || this.turretSkins.get('default')!;
    const initialTextures = skinData.idleFrames.length > 0 ? skinData.idleFrames : skinData.fullFireSequence;

    const turretSprite = new AnimatedSprite(initialTextures);
    turretSprite.anchor.set(0.5, 0.78125);
    turretSprite.scale.set(0.68, 0.68);
    turretSprite.animationSpeed = 0.1;
    turretSprite.play();
    headContainer.addChild(turretSprite);

    skinData.drawBase(baseSprite);

    // Active physical particles (spent shell casings & muzzle smoke)
    const shellCasings: { graphic: Graphics; vx: number; vy: number; rot: number; life: number }[] = [];

    const rig: TurretAnimationRig = {
      container,
      baseSprite,
      headContainer,
      turretSprite,
      activeSkin: initialSkin,
      recoilOffset: 0,
      setSkin: (skinId: TurretSkinId) => {
        const data = this.turretSkins.get(skinId) || this.turretSkins.get('default')!;
        rig.activeSkin = skinId;
        turretSprite.textures = data.idleFrames.length > 0 ? data.idleFrames : data.fullFireSequence;
        turretSprite.loop = true;
        turretSprite.animationSpeed = 0.1;
        turretSprite.anchor.set(0.5, 0.78125);
        turretSprite.scale.set(0.68, 0.68);
        turretSprite.play();
        turretSprite.tint = 0xffffff;
        data.drawBase(baseSprite);
      },
      playFire: (onMuzzleFlash?: () => void) => {
        const data = this.turretSkins.get(rig.activeSkin) || this.turretSkins.get('default')!;
        const seq = data.fullFireSequence.length > 0 ? data.fullFireSequence : data.fireFrames;
        turretSprite.textures = seq;
        turretSprite.loop = false;
        turretSprite.animationSpeed = 0.45;
        turretSprite.anchor.set(0.5, 0.78125);
        turretSprite.gotoAndPlay(0);

        if (onMuzzleFlash) onMuzzleFlash();

        // Spawn a physical tumbling spent shell casing
        const shell = new Graphics();
        const casingColor = rig.activeSkin === 'abyssal_dread' ? 0xea580c : (rig.activeSkin === 'cyber_gold' ? 0xfbbf24 : 0x00f0ff);
        shell.rect(-2.5, -5, 5, 10);
        shell.fill({ color: casingColor });
        shell.stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
        shell.x = 16;
        shell.y = -6;
        headContainer.addChild(shell);

        shellCasings.push({
          graphic: shell,
          vx: 2.2 + Math.random() * 2.0,
          vy: 0.5 + Math.random() * 1.5,
          rot: 0.35 + Math.random() * 0.3,
          life: 1.0
        });

        turretSprite.onComplete = () => {
          const curData = this.turretSkins.get(rig.activeSkin) || this.turretSkins.get('default')!;
          turretSprite.textures = curData.idleFrames.length > 0 ? curData.idleFrames : curData.fullFireSequence;
          turretSprite.loop = true;
          turretSprite.animationSpeed = 0.1;
          turretSprite.play();
          turretSprite.onComplete = undefined;
        };
      },
      update: (dt: number) => {
        // Update physical spent shell particles
        for (let i = shellCasings.length - 1; i >= 0; i--) {
          const s = shellCasings[i];
          s.graphic.x += s.vx * dt;
          s.graphic.y += s.vy * dt;
          s.graphic.rotation += s.rot * dt;
          s.life -= 0.05 * dt;
          s.graphic.alpha = Math.max(0, s.life);

          if (s.life <= 0) {
            headContainer.removeChild(s.graphic);
            shellCasings.splice(i, 1);
          }
        }
      }
    };

    return rig;
  }
}
