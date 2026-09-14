import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { SoundManager } from '../../audio/SoundManager';

/**
 * Procedural Master Artwork Cache for the Apex Leviathan Boss
 * Generates crisp, high-DPI vector/canvas textures with anti-aliasing and zero pixelation.
 */
class BossTextureCache {
  private static instance: BossTextureCache;
  private cache: Map<string, Texture> = new Map();

  public static getInstance(): BossTextureCache {
    if (!BossTextureCache.instance) {
      BossTextureCache.instance = new BossTextureCache();
    }
    return BossTextureCache.instance;
  }

  public getTexture(key: string, generator: () => HTMLCanvasElement): Texture {
    if (!this.cache.has(key)) {
      const canvas = generator();
      this.cache.set(key, Texture.from(canvas));
    }
    return this.cache.get(key)!;
  }

  /**
   * 1. Colossal Leviathan Cranium / Head
   */
  public getHeadTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    const key = `boss_head_${theme}_${enraged ? 'enraged' : 'normal'}`;
    return this.getTexture(key, () => {
      const w = 180;
      const h = 130;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      ctx.translate(w / 2 - 10, h / 2);

      const isLight = theme === 'light';

      // Sweeping Dragon / Leviathan Horns
      ctx.save();
      const hornGrad = ctx.createLinearGradient(0, -10, 60, -55);
      if (isLight) {
        hornGrad.addColorStop(0, '#78350f');
        hornGrad.addColorStop(0.5, '#fbbf24');
        hornGrad.addColorStop(1, '#fef08a');
      } else {
        hornGrad.addColorStop(0, '#18181b');
        hornGrad.addColorStop(0.5, enraged ? '#dc2626' : '#991b1b');
        hornGrad.addColorStop(1, enraged ? '#f97316' : '#ea580c');
      }

      // Primary Horn
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.quadraticCurveTo(15, -45, 62, -48);
      ctx.quadraticCurveTo(30, -32, 6, -18);
      ctx.closePath();
      ctx.fillStyle = hornGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#fde68a' : (enraged ? '#ff4444' : '#f97316');
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Horn Runic Channels
      ctx.beginPath();
      ctx.moveTo(5, -24);
      ctx.quadraticCurveTo(24, -38, 52, -44);
      ctx.strokeStyle = isLight ? '#00f0ff' : (enraged ? '#ffff00' : '#f43f5e');
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Secondary Cheek Horn
      ctx.beginPath();
      ctx.moveTo(-24, -14);
      ctx.quadraticCurveTo(0, -32, 38, -32);
      ctx.quadraticCurveTo(12, -22, -12, -10);
      ctx.closePath();
      ctx.fillStyle = hornGrad;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Main Cranial Armor Plating
      ctx.beginPath();
      ctx.moveTo(-45, -12); // Neck junction
      ctx.quadraticCurveTo(-15, -34, 25, -28); // Forehead arch
      ctx.quadraticCurveTo(55, -22, 65, 0); // Snout apex
      ctx.quadraticCurveTo(35, 14, -5, 10); // Upper jaw line
      ctx.quadraticCurveTo(-30, 16, -45, -12);
      ctx.closePath();

      const craniumGrad = ctx.createLinearGradient(-45, -34, 65, 16);
      if (isLight) {
        craniumGrad.addColorStop(0, '#0f172a');
        craniumGrad.addColorStop(0.3, '#1e293b');
        craniumGrad.addColorStop(0.7, '#f8fafc');
        craniumGrad.addColorStop(1, '#e2e8f0');
      } else {
        craniumGrad.addColorStop(0, '#09090b');
        craniumGrad.addColorStop(0.5, '#18181b');
        craniumGrad.addColorStop(1, enraged ? '#450a0a' : '#27272a');
      }
      ctx.fillStyle = craniumGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#38bdf8' : (enraged ? '#dc2626' : '#ea580c');
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Gold / Plasma Trim Filigree
      ctx.beginPath();
      ctx.moveTo(-20, -22);
      ctx.lineTo(20, -18);
      ctx.lineTo(50, -4);
      ctx.strokeStyle = isLight ? '#fbbf24' : (enraged ? '#ff5500' : '#d946ef');
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Venting Gills / Thermal Exhausts
      for (let g = 0; g < 3; g++) {
        const gx = -35 + g * 10;
        ctx.beginPath();
        ctx.moveTo(gx, -18);
        ctx.lineTo(gx + 5, -8);
        ctx.strokeStyle = isLight ? '#00f0ff' : (enraged ? '#ff3300' : '#a855f7');
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      // Upper Jaw Razor Fangs
      ctx.fillStyle = '#ffffff';
      const fangs = [
        { x: 10, y: 10, h: 8 },
        { x: 22, y: 8, h: 10 },
        { x: 35, y: 6, h: 9 },
        { x: 48, y: 3, h: 7 },
        { x: 58, y: 0, h: 6 }
      ];
      for (const f of fangs) {
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + 2, f.y + f.h);
        ctx.lineTo(f.x + 4, f.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = isLight ? '#38bdf8' : '#f97316';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Bio-Optic Predator Eye
      const ex = 24;
      const ey = -10;

      // Outer Eye Orbit Frame
      ctx.beginPath();
      ctx.ellipse(ex, ey, 9, 6, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();
      ctx.strokeStyle = isLight ? '#fbbf24' : (enraged ? '#ff0000' : '#e11d48');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing Iris
      const eyeGrad = ctx.createRadialGradient(ex, ey, 1, ex, ey, 7);
      if (isLight) {
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.4, '#00f0ff');
        eyeGrad.addColorStop(1, '#0284c7');
      } else {
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.3, enraged ? '#facc15' : '#f97316');
        eyeGrad.addColorStop(1, enraged ? '#dc2626' : '#7f1d1d');
      }
      ctx.beginPath();
      ctx.ellipse(ex, ey, 7.5, 4.8, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = eyeGrad;
      ctx.fill();

      // Slit Pupil
      ctx.beginPath();
      ctx.ellipse(ex, ey, 1.8, 5.0, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Specular Glint
      ctx.beginPath();
      ctx.arc(ex + 2, ey - 2, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
      return canvas;
    });
  }

  /**
   * 2. Articulated Lower Mandible (Jaw)
   */
  public getJawTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    const key = `boss_jaw_${theme}_${enraged ? 'enraged' : 'normal'}`;
    return this.getTexture(key, () => {
      const w = 110;
      const h = 50;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const isLight = theme === 'light';

      ctx.beginPath();
      ctx.moveTo(10, 8); // Joint pivot
      ctx.quadraticCurveTo(45, 12, 85, 8); // Chin apex
      ctx.quadraticCurveTo(55, 32, 20, 24); // Throat curve
      ctx.closePath();

      const jawGrad = ctx.createLinearGradient(10, 8, 85, 24);
      if (isLight) {
        jawGrad.addColorStop(0, '#1e293b');
        jawGrad.addColorStop(0.6, '#cbd5e1');
        jawGrad.addColorStop(1, '#f8fafc');
      } else {
        jawGrad.addColorStop(0, '#09090b');
        jawGrad.addColorStop(0.7, '#18181b');
        jawGrad.addColorStop(1, enraged ? '#7f1d1d' : '#27272a');
      }
      ctx.fillStyle = jawGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#38bdf8' : (enraged ? '#dc2626' : '#ea580c');
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Lower Fangs
      ctx.fillStyle = '#ffffff';
      const lowerFangs = [
        { x: 30, y: 10, h: -7 },
        { x: 45, y: 9, h: -9 },
        { x: 62, y: 8, h: -8 },
        { x: 78, y: 7, h: -6 }
      ];
      for (const lf of lowerFangs) {
        ctx.beginPath();
        ctx.moveTo(lf.x, lf.y);
        ctx.lineTo(lf.x + 2, lf.y + lf.h);
        ctx.lineTo(lf.x + 4, lf.y);
        ctx.closePath();
        ctx.fill();
      }

      return canvas;
    });
  }

  /**
   * 3. Articulated Carapace Segments (5 progressive tiers)
   */
  public getCarapaceTexture(index: number, theme: 'light' | 'dark', enraged: boolean): Texture {
    const key = `boss_carapace_${index}_${theme}_${enraged ? 'enraged' : 'normal'}`;
    return this.getTexture(key, () => {
      const scale = 1 - index * 0.12;
      const w = Math.round(110 * scale);
      const h = Math.round(95 * scale);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(30, w);
      canvas.height = Math.max(25, h);
      const ctx = canvas.getContext('2d')!;

      const isLight = theme === 'light';
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.save();
      ctx.translate(cx, cy);

      // Dorsal Armor Ridge Blade
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, -h * 0.35);
      ctx.lineTo(0, -h * 0.55);
      ctx.lineTo(w * 0.25, -h * 0.35);
      ctx.closePath();
      ctx.fillStyle = isLight ? '#fbbf24' : (enraged ? '#ff4400' : '#f97316');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Armored Carapace Body Shell
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.44, h * 0.36, 0, 0, Math.PI * 2);

      const grad = ctx.createLinearGradient(-w * 0.4, -h * 0.3, w * 0.4, h * 0.3);
      if (isLight) {
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.4, '#1e293b');
        grad.addColorStop(0.8, '#f1f5f9');
        grad.addColorStop(1, '#e2e8f0');
      } else {
        grad.addColorStop(0, '#09090b');
        grad.addColorStop(0.6, '#18181b');
        grad.addColorStop(1, enraged ? '#450a0a' : '#27272a');
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#38bdf8' : (enraged ? '#dc2626' : '#ea580c');
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Energy Conduit Band
      ctx.beginPath();
      ctx.moveTo(-w * 0.35, 0);
      ctx.lineTo(w * 0.35, 0);
      ctx.strokeStyle = isLight ? '#00f0ff' : (enraged ? '#ffff00' : '#d946ef');
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Central Spine Hex Bolt / Biometric Node
      ctx.beginPath();
      ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? '#38bdf8' : (enraged ? '#ffffff' : '#f97316');
      ctx.fill();

      ctx.restore();
      return canvas;
    });
  }

  /**
   * 4. Colossal Dorsal Energy Wings / Fins
   */
  public getDorsalWingTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    const key = `boss_dorsal_wing_${theme}_${enraged ? 'enraged' : 'normal'}`;
    return this.getTexture(key, () => {
      const w = 160;
      const h = 120;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const isLight = theme === 'light';

      ctx.save();
      ctx.translate(15, h - 15); // Anchor at base

      // Translucent Energy Webbing
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(20, -50, 45, -95); // Spine 1
      ctx.quadraticCurveTo(65, -75, 80, -85); // Spine 2
      ctx.quadraticCurveTo(95, -60, 115, -65); // Spine 3
      ctx.quadraticCurveTo(110, -35, 125, -35); // Spine 4
      ctx.quadraticCurveTo(60, -10, 0, 0);
      ctx.closePath();

      const webGrad = ctx.createLinearGradient(0, 0, 80, -85);
      if (isLight) {
        webGrad.addColorStop(0, 'rgba(6, 182, 212, 0.65)');
        webGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.4)');
        webGrad.addColorStop(1, 'rgba(254, 240, 138, 0.25)');
      } else {
        webGrad.addColorStop(0, enraged ? 'rgba(220, 38, 38, 0.75)' : 'rgba(234, 88, 12, 0.65)');
        webGrad.addColorStop(0.6, enraged ? 'rgba(249, 115, 22, 0.45)' : 'rgba(168, 85, 247, 0.35)');
        webGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      }
      ctx.fillStyle = webGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#38bdf8' : (enraged ? '#ff4444' : '#f97316');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Main Wing Spine Bones
      const spines = [
        { x: 45, y: -95 },
        { x: 80, y: -85 },
        { x: 115, y: -65 },
        { x: 125, y: -35 }
      ];
      for (const sp of spines) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sp.x * 0.4, sp.y * 0.7, sp.x, sp.y);
        ctx.strokeStyle = isLight ? '#fbbf24' : (enraged ? '#ffaa00' : '#cbd5e1');
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Luminescent Claw Tip
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.restore();
      return canvas;
    });
  }

  /**
   * 5. Triple-Fluke Thruster Caudal Tail
   */
  public getTailFlukeTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    const key = `boss_tail_fluke_${theme}_${enraged ? 'enraged' : 'normal'}`;
    return this.getTexture(key, () => {
      const w = 130;
      const h = 100;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const isLight = theme === 'light';

      ctx.save();
      ctx.translate(15, h / 2); // Anchor at tail joint

      // Triple Crescent Fluke Blades
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(45, -35, 95, -42); // Upper fluke
      ctx.quadraticCurveTo(65, -15, 105, 0); // Middle fluke
      ctx.quadraticCurveTo(65, 15, 95, 42); // Lower fluke
      ctx.quadraticCurveTo(45, 35, 0, 0);
      ctx.closePath();

      const tailGrad = ctx.createLinearGradient(0, -42, 105, 42);
      if (isLight) {
        tailGrad.addColorStop(0, '#1e293b');
        tailGrad.addColorStop(0.5, '#0284c7');
        tailGrad.addColorStop(1, '#00f0ff');
      } else {
        tailGrad.addColorStop(0, '#09090b');
        tailGrad.addColorStop(0.5, enraged ? '#dc2626' : '#991b1b');
        tailGrad.addColorStop(1, enraged ? '#f97316' : '#ea580c');
      }
      ctx.fillStyle = tailGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#fbbf24' : (enraged ? '#ffdd00' : '#f97316');
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Central Plasma Thruster Nozzle
      ctx.beginPath();
      ctx.ellipse(35, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? '#00f0ff' : (enraged ? '#ffff00' : '#f43f5e');
      ctx.fill();

      ctx.restore();
      return canvas;
    });
  }

  /**
   * 6. Arc Reactor Gyro Rings & Pulsating Fusion Singularity
   */
  public getReactorRingTexture(type: 'outer' | 'inner', theme: 'light' | 'dark'): Texture {
    const key = `boss_reactor_ring_${type}_${theme}`;
    return this.getTexture(key, () => {
      const size = type === 'outer' ? 84 : 56;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const c = size / 2;

      ctx.save();
      ctx.translate(c, c);

      const isLight = theme === 'light';
      const r = c - 4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = type === 'outer'
        ? (isLight ? '#fbbf24' : '#ea580c')
        : (isLight ? '#38bdf8' : '#d946ef');
      ctx.lineWidth = type === 'outer' ? 2.5 : 1.8;
      ctx.stroke();

      // Capacitors / apertures
      const nodes = type === 'outer' ? 4 : 6;
      for (let i = 0; i < nodes; i++) {
        const angle = (i / nodes) * Math.PI * 2;
        const nx = Math.cos(angle) * r;
        const ny = Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(nx, ny, type === 'outer' ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.restore();
      return canvas;
    });
  }

  public getReactorCoreTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    const key = `boss_reactor_core_${theme}_${enraged ? 'enraged' : 'normal'}`;
    return this.getTexture(key, () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const c = size / 2;

      const grad = ctx.createRadialGradient(c, c, 2, c, c, c - 2);
      if (theme === 'light') {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, '#00f0ff');
        grad.addColorStop(0.65, '#0284c7');
        grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, enraged ? '#facc15' : '#f97316');
        grad.addColorStop(0.65, enraged ? '#dc2626' : '#991b1b');
        grad.addColorStop(1, 'rgba(153, 27, 27, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c, c, c - 2, 0, Math.PI * 2);
      ctx.fill();

      return canvas;
    });
  }

  /**
   * 7. Hexagonal Forcefield Barrier (Hit Reaction Shield)
   */
  public getShieldHexTexture(theme: 'light' | 'dark'): Texture {
    const key = `boss_shield_hex_${theme}`;
    return this.getTexture(key, () => {
      const w = 240;
      const h = 170;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const isLight = theme === 'light';

      ctx.save();
      ctx.translate(w / 2, h / 2);

      // Outer forcefield dome
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.46, h * 0.44, 0, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? 'rgba(6, 182, 212, 0.22)' : 'rgba(220, 38, 38, 0.22)';
      ctx.fill();
      ctx.strokeStyle = isLight ? '#00f0ff' : '#ff4444';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Honeycomb hex grid lines
      const hexSize = 16;
      ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(254, 240, 138, 0.45)';
      ctx.lineWidth = 1.0;

      for (let r = -3; r <= 3; r++) {
        for (let q = -4; q <= 4; q++) {
          const hx = q * hexSize * 1.5;
          const hy = (r * hexSize * Math.sqrt(3)) + ((Math.abs(q) % 2) * (hexSize * Math.sqrt(3) / 2));
          if (Math.hypot(hx, hy) < w * 0.42) {
            ctx.beginPath();
            for (let a = 0; a < 6; a++) {
              const ang = (a / 6) * Math.PI * 2;
              const px = hx + Math.cos(ang) * (hexSize * 0.52);
              const py = hy + Math.sin(ang) * (hexSize * 0.52);
              if (a === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
      }

      ctx.restore();
      return canvas;
    });
  }
}

/**
 * APEX MECHA-LEVIATHAN / ABYSSAL WORLD-EATER BOSS CONTROLLER
 * Full 10-point articulated spine physics, counter-rotating plasma reactor,
 * dynamic theme switching, hexagonal hit reaction forcefield, and elite HUD.
 */
export class BossManager extends Container {
  public maxHp: number;
  public currentHp: number;
  public isEnraged: boolean = false;
  /** 1 armored, 2 cracked core, 3 overdrive */
  public phase: 1 | 2 | 3 = 1;
  public theme: 'light' | 'dark' = 'light';
  private phaseAnnounceTimer = 0;
  private dashCooldown = 0;
  private invulnFrames = 0;

  // Articulated Spine Hierarchy
  private spineContainer: Container;
  private headContainer: Container;
  private headSprite: Sprite;
  private jawSprite: Sprite;
  private carapaceSprites: Sprite[] = [];
  private dorsalWingSprite: Sprite;
  private pelvicFinSprite: Sprite;
  private tailFlukeSprite: Sprite;

  // Arc Reactor Core Components
  private reactorContainer: Container;
  private reactorOuterRing: Sprite;
  private reactorInnerRing: Sprite;
  private reactorCoreSprite: Sprite;

  // FX & Overdrive Overlays
  private ambientGlow: Graphics;
  private lightningGraphics: Graphics;
  private shieldSprite: Sprite;
  private shieldTimer: number = 0;

  // Boss Status HUD (Always oriented upright regardless of fish facing)
  public hudContainer: Container;
  private hudBg: Graphics;
  private hudHealthPips: Graphics;
  private bossTitleText: Text;
  private hpPercentText: Text;

  // Serpentine Harmonic Simulation State
  private swimPhase: number = 0;
  private facingSign: number = 1;

  constructor(maxHp: number = 28, initialTheme: 'light' | 'dark' = 'light') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;

    const textures = BossTextureCache.getInstance();

    // 0. Ambient Hydrodynamic Water Halo
    this.ambientGlow = new Graphics();
    this.renderAmbientGlow();
    this.addChild(this.ambientGlow);

    // 1. Spine & Articulated Body Container
    this.spineContainer = new Container();
    this.addChild(this.spineContainer);

    // Caudal Fluke Tail
    this.tailFlukeSprite = new Sprite(textures.getTailFlukeTexture(this.theme, false));
    this.tailFlukeSprite.anchor.set(0.12, 0.5);
    this.spineContainer.addChild(this.tailFlukeSprite);

    // Carapace Segments (5 overlapping body plates, back to front)
    for (let i = 4; i >= 0; i--) {
      const segSprite = new Sprite(textures.getCarapaceTexture(i, this.theme, false));
      segSprite.anchor.set(0.5, 0.5);
      this.carapaceSprites[i] = segSprite;
      this.spineContainer.addChild(segSprite);
    }

    // Dorsal Energy Wings
    this.dorsalWingSprite = new Sprite(textures.getDorsalWingTexture(this.theme, false));
    this.dorsalWingSprite.anchor.set(0.1, 0.88);
    this.dorsalWingSprite.x = -16;
    this.dorsalWingSprite.y = -18;
    this.spineContainer.addChild(this.dorsalWingSprite);

    // Pelvic Ventral Fin
    this.pelvicFinSprite = new Sprite(textures.getDorsalWingTexture(this.theme, false));
    this.pelvicFinSprite.anchor.set(0.1, 0.12);
    this.pelvicFinSprite.scale.y = -0.55;
    this.pelvicFinSprite.scale.x = 0.65;
    this.pelvicFinSprite.x = -24;
    this.pelvicFinSprite.y = 16;
    this.spineContainer.addChild(this.pelvicFinSprite);

    // Arc Reactor Core Container (Anchored on Thoracic Segment 0)
    this.reactorContainer = new Container();
    this.reactorContainer.x = -12;
    this.reactorContainer.y = -2;

    this.reactorOuterRing = new Sprite(textures.getReactorRingTexture('outer', this.theme));
    this.reactorOuterRing.anchor.set(0.5, 0.5);
    this.reactorContainer.addChild(this.reactorOuterRing);

    this.reactorInnerRing = new Sprite(textures.getReactorRingTexture('inner', this.theme));
    this.reactorInnerRing.anchor.set(0.5, 0.5);
    this.reactorContainer.addChild(this.reactorInnerRing);

    this.reactorCoreSprite = new Sprite(textures.getReactorCoreTexture(this.theme, false));
    this.reactorCoreSprite.anchor.set(0.5, 0.5);
    this.reactorContainer.addChild(this.reactorCoreSprite);

    this.spineContainer.addChild(this.reactorContainer);

    // Head Container (Cranium + Articulated Jaw)
    this.headContainer = new Container();
    this.headContainer.x = 42;
    this.headContainer.y = 0;

    // Jaw (drawn below head for correct layering)
    this.jawSprite = new Sprite(textures.getJawTexture(this.theme, false));
    this.jawSprite.anchor.set(0.15, 0.35);
    this.jawSprite.x = -15;
    this.jawSprite.y = 6;
    this.headContainer.addChild(this.jawSprite);

    // Cranium
    this.headSprite = new Sprite(textures.getHeadTexture(this.theme, false));
    this.headSprite.anchor.set(0.42, 0.52);
    this.headContainer.addChild(this.headSprite);

    this.spineContainer.addChild(this.headContainer);

    // Lightning Arcs Graphics (Active during Enraged Overdrive)
    this.lightningGraphics = new Graphics();
    this.spineContainer.addChild(this.lightningGraphics);

    // Hexagonal Forcefield Shield (Hit Flash)
    this.shieldSprite = new Sprite(textures.getShieldHexTexture(this.theme));
    this.shieldSprite.anchor.set(0.5, 0.5);
    this.shieldSprite.visible = false;
    this.shieldSprite.alpha = 0;
    this.addChild(this.shieldSprite);

    // 2. High-Tech Floating Boss Status HUD
    this.hudContainer = new Container();
    this.hudContainer.y = -98;
    this.addChild(this.hudContainer);

    this.hudBg = new Graphics();
    this.renderHudBackground();
    this.hudContainer.addChild(this.hudBg);

    this.hudHealthPips = new Graphics();
    this.updateHealthBar();
    this.hudContainer.addChild(this.hudHealthPips);

    const titleStyle = new TextStyle({
      fontFamily: '"Space Grotesk", "Orbitron", monospace, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: this.theme === 'light' ? 0x00f0ff : 0xff3300,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 1
      }
    });
    this.bossTitleText = new Text({
      text: this.theme === 'light' ? '⚡ APEX CYBER-LEVIATHAN [MK-VIII] ⚡' : '☠️ ABYSSAL VOID-EATER [TITAN] ☠️',
      style: titleStyle
    });
    this.bossTitleText.anchor.set(0.5, 1);
    this.bossTitleText.y = -10;
    this.hudContainer.addChild(this.bossTitleText);

    const percentStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff
    });
    this.hpPercentText = new Text({ text: '100%', style: percentStyle });
    this.hpPercentText.anchor.set(0.5, 0);
    this.hpPercentText.y = 8;
    this.hudContainer.addChild(this.hpPercentText);
  }

  /**
   * Updates the theme textures and color scheme in real-time
   */
  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    const textures = BossTextureCache.getInstance();

    this.headSprite.texture = textures.getHeadTexture(this.theme, this.isEnraged);
    this.jawSprite.texture = textures.getJawTexture(this.theme, this.isEnraged);
    for (let i = 0; i < 5; i++) {
      this.carapaceSprites[i].texture = textures.getCarapaceTexture(i, this.theme, this.isEnraged);
    }
    this.dorsalWingSprite.texture = textures.getDorsalWingTexture(this.theme, this.isEnraged);
    this.pelvicFinSprite.texture = textures.getDorsalWingTexture(this.theme, this.isEnraged);
    this.tailFlukeSprite.texture = textures.getTailFlukeTexture(this.theme, this.isEnraged);
    this.reactorOuterRing.texture = textures.getReactorRingTexture('outer', this.theme);
    this.reactorInnerRing.texture = textures.getReactorRingTexture('inner', this.theme);
    this.reactorCoreSprite.texture = textures.getReactorCoreTexture(this.theme, this.isEnraged);
    this.shieldSprite.texture = textures.getShieldHexTexture(this.theme);

    this.renderAmbientGlow();
    this.renderHudBackground();
    this.updateHealthBar();

    if (!this.isEnraged) {
      this.bossTitleText.text = this.theme === 'light'
        ? '⚡ APEX CYBER-LEVIATHAN [MK-VIII] ⚡'
        : '☠️ ABYSSAL VOID-EATER [TITAN] ☠️';
      this.bossTitleText.style.fill = this.theme === 'light' ? 0x00f0ff : 0xff3300;
    }
  }

  /**
   * Serpentine Spine Physics & Kinetic Animation Update
   */
  public update(dtScale: number = 1.0, vx: number = 1.0, vy: number = 0.0): void {
    if (this.invulnFrames > 0) this.invulnFrames = Math.max(0, this.invulnFrames - dtScale);
    if (this.phaseAnnounceTimer > 0) this.phaseAnnounceTimer = Math.max(0, this.phaseAnnounceTimer - dtScale);
    // Phase 3: pulse ambient glow harder
    if (this.phase === 3 && this.ambientGlow) {
      this.ambientGlow.alpha = 0.55 + 0.35 * Math.sin(this.swimPhase * 3);
    }

    const speedMult = this.isEnraged ? 1.6 : 1.0;
    this.swimPhase += 0.075 * dtScale * speedMult;

    // Detect swimming heading and orient spine container smoothly
    if (Math.abs(vx) > 0.15) {
      this.facingSign = vx > 0 ? 1 : -1;
      this.spineContainer.scale.x = this.facingSign;
      // Guarantee HUD text is always upright and never inverted
      this.hudContainer.scale.x = 1;
    }

    // 1. Head undulation & breathing jaw flex
    this.headContainer.y = Math.sin(this.swimPhase) * 4;
    this.headContainer.rotation = Math.cos(this.swimPhase) * 0.07;
    const jawGape = this.isEnraged
      ? 0.28 + Math.sin(this.swimPhase * 2.2) * 0.12
      : Math.sin(this.swimPhase * 1.1) * 0.06;
    this.jawSprite.rotation = jawGape;

    // 2. Articulated Carapace Wave Propagation
    for (let i = 0; i < 5; i++) {
      const seg = this.carapaceSprites[i];
      const lag = (i + 1) * 0.62;
      const wave = Math.sin(this.swimPhase - lag) * (5 + i * 2.6);
      seg.x = -i * 26 + 18;
      seg.y = wave;
      seg.rotation = Math.cos(this.swimPhase - lag) * 0.14;
    }

    // 3. Wing & Fin Fluidity
    this.dorsalWingSprite.rotation = Math.sin(this.swimPhase * 1.3) * 0.22;
    this.pelvicFinSprite.rotation = -Math.sin(this.swimPhase * 1.3 + 0.4) * 0.18;

    // 4. Tail Fluke Harmonic Swish
    const tailLag = 4.2;
    this.tailFlukeSprite.x = -122;
    this.tailFlukeSprite.y = Math.sin(this.swimPhase - tailLag) * 20;
    this.tailFlukeSprite.rotation = Math.cos(this.swimPhase - tailLag) * 0.38;

    // 5. Arc Reactor Gyro Rotation & Singularity Pulse
    const rotSpeed = this.isEnraged ? 0.09 : 0.03;
    this.reactorOuterRing.rotation += rotSpeed * dtScale;
    this.reactorInnerRing.rotation -= rotSpeed * 1.4 * dtScale;
    const corePulse = 1.0 + Math.sin(this.swimPhase * 3.5) * (this.isEnraged ? 0.25 : 0.12);
    this.reactorCoreSprite.scale.set(corePulse);
    this.reactorContainer.y = this.carapaceSprites[0].y;

    // 6. Enraged Overdrive Lightning Discharges
    this.lightningGraphics.clear();
    if (this.isEnraged && Math.random() > 0.4) {
      this.drawPlasmaArcs();
    }

    // 7. Shield Impact Dissipation
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dtScale * 0.06;
      this.shieldSprite.alpha = Math.max(0, this.shieldTimer);
      const shieldScale = 1.0 + (1 - this.shieldTimer) * 0.15;
      this.shieldSprite.scale.set(shieldScale);
      if (this.shieldTimer <= 0) {
        this.shieldSprite.visible = false;
      }
    }
  }

  /**
   * Flashes the hexagonal energy barrier upon bullet strike
   */
  public triggerShieldHit(): void {
    this.shieldSprite.visible = true;
    this.shieldSprite.alpha = 0.95;
    this.shieldTimer = 1.0;
    this.shieldSprite.scale.set(1.0);
  }

  /**
   * Phase 1 (100–60%): armored — reduced damage, shield flashes.
   * Phase 2 (60–35%): cracked core — full damage, title update.
   * Phase 3 (<35%): overdrive — enraged textures, faster swim, brief i-frames on transition.
   */
  public takeDamage(amount: number): boolean {
    if (this.invulnFrames > 0) {
      this.triggerShieldHit();
      return false;
    }

    let incoming = amount;
    if (this.phase === 1) {
      incoming *= 0.55; // armored plating
    } else if (this.phase === 3) {
      incoming *= 1.15; // exposed reactor, takes more
    }

    this.currentHp = Math.max(0, this.currentHp - incoming);
    this.updateHealthBar();
    this.triggerShieldHit();
    this.evaluatePhaseTransition();

    if (this.currentHp <= 0) {
      this.visible = false;
      SoundManager.playBossDefeat();
      return true;
    }
    return false;
  }

  private evaluatePhaseTransition(): void {
    const pct = this.currentHp / this.maxHp;
    if (pct <= 0.35 && this.phase < 3) {
      this.phase = 3;
      this.isEnraged = true;
      this.invulnFrames = 45;
      this.phaseAnnounceTimer = 90;
      this.setTheme(this.theme);
      this.bossTitleText.text = '⚠️ PHASE 3 — CRITICAL OVERDRIVE ⚠️';
      this.bossTitleText.style.fill = 0xff0033;
      SoundManager.playBossEnraged();
    } else if (pct <= 0.6 && this.phase < 2) {
      this.phase = 2;
      this.invulnFrames = 20;
      this.phaseAnnounceTimer = 70;
      this.bossTitleText.text = '⚡ PHASE 2 — CORE EXPOSED';
      this.bossTitleText.style.fill = 0xfbbf24;
      SoundManager.playBossWarning();
    }
  }

  public getPhaseDamageTakenMultiplier(): number {
    if (this.phase === 1) return 0.55;
    if (this.phase === 3) return 1.15;
    return 1.0;
  }

  public getPhaseSpeedMultiplier(): number {
    if (this.phase === 1) return 0.9;
    if (this.phase === 2) return 1.15;
    return 1.45;
  }

  private updateHealthBar(): void {
    const pct = Math.max(0, Math.min(1, this.currentHp / this.maxHp));
    this.hudHealthPips.clear();

    const barW = 150;
    const barH = 7;
    const startX = -barW / 2;
    const pips = 20;
    const filledPips = Math.ceil(pct * pips);

    const pipColor = this.isEnraged
      ? 0xff0033
      : (pct > 0.6 ? 0x00f0ff : (pct > 0.3 ? 0xfbbf24 : 0xf97316));

    for (let i = 0; i < pips; i++) {
      const px = startX + i * (barW / pips) + 1;
      const pw = (barW / pips) - 2;
      if (i < filledPips) {
        this.hudHealthPips.rect(px, -3.5, pw, barH);
        this.hudHealthPips.fill({ color: pipColor, alpha: 0.95 });
      } else {
        this.hudHealthPips.rect(px, -3.5, pw, barH);
        this.hudHealthPips.fill({ color: 0x1f2937, alpha: 0.4 });
      }
    }

    if (this.hpPercentText) {
      const percentVal = Math.round(pct * 100);
      this.hpPercentText.text = this.isEnraged ? `${percentVal}% [OVERDRIVE]` : `${percentVal}% HP`;
      this.hpPercentText.style.fill = this.isEnraged ? 0xff3300 : (this.theme === 'light' ? 0x38bdf8 : 0xfbbf24);
    }
  }

  private renderHudBackground(): void {
    this.hudBg.clear();
    const w = 176;
    const h = 42;

    // Outer Dark Glass Beveled Container
    this.hudBg.roundRect(-w / 2, -h / 2, w, h, 6);
    this.hudBg.fill({ color: 0x090d16, alpha: 0.88 });
    this.hudBg.stroke({
      width: 1.5,
      color: this.isEnraged ? 0xff0033 : (this.theme === 'light' ? 0x0284c7 : 0xd97706),
      alpha: 0.9
    });

    // Tech Corner Accent Brackets
    this.hudBg.moveTo(-w / 2 + 8, -h / 2);
    this.hudBg.lineTo(-w / 2, -h / 2 + 8);
    this.hudBg.moveTo(w / 2 - 8, -h / 2);
    this.hudBg.lineTo(w / 2, -h / 2 + 8);
    this.hudBg.stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
  }

  private renderAmbientGlow(): void {
    this.ambientGlow.clear();
    const haloColor = this.theme === 'light' ? 0x00f0ff : (this.isEnraged ? 0xff0033 : 0xea580c);
    this.ambientGlow.ellipse(0, 0, 160, 90);
    this.ambientGlow.fill({ color: haloColor, alpha: 0.14 });
  }

  private drawPlasmaArcs(): void {
    const isLight = this.theme === 'light';
    const boltColor = isLight ? 0x00f0ff : 0xff3300;
    this.lightningGraphics.stroke({ width: 1.8, color: boltColor, alpha: 0.9 });

    // Emit 2 electric lightning arcs along the spine
    for (let a = 0; a < 2; a++) {
      const startSeg = this.carapaceSprites[Math.floor(Math.random() * 3)];
      const endSeg = this.carapaceSprites[3 + Math.floor(Math.random() * 2)];
      if (!startSeg || !endSeg) continue;

      let cx = startSeg.x;
      let cy = startSeg.y;
      this.lightningGraphics.moveTo(cx, cy);

      const segments = 4;
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const targetX = startSeg.x + (endSeg.x - startSeg.x) * t + (Math.random() - 0.5) * 18;
        const targetY = startSeg.y + (endSeg.y - startSeg.y) * t + (Math.random() - 0.5) * 18;
        this.lightningGraphics.lineTo(targetX, targetY);
      }
    }
  }
}
