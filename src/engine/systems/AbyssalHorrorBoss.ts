import { Assets, Container, Sprite, Texture, Rectangle, Graphics } from 'pixi.js';

export interface PuppetPartTextures {
  torso: Texture;
  dorsalFin: Texture;
  jaw: Texture;
  tailFin: Texture;
  armUpperFront: Texture;
  armLowerFront: Texture;
}

interface PartRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Articulated Paper Cutout Rigged Puppet Boss (Abyssal Horror Boss).
 * Implemented with streamlined anatomical parts, aggressive jaw-chomping physics,
 * natural lagging caudal fin wave, and paper-cutout turn-squash.
 */
export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public isEnraged = false;
  public targetSize: number;

  private static cachedTextures: PuppetPartTextures | null = null;
  private static loadingPromise: Promise<PuppetPartTextures> | null = null;

  // Rig container hierarchy
  private readonly bodyRoot = new Container();
  private readonly dorsalFinContainer = new Container();
  private readonly tailContainer = new Container();
  private readonly torsoContainer = new Container();
  private readonly headContainer = new Container();
  private readonly jawContainer = new Container();
  private readonly armFrontRoot = new Container();
  private readonly armFrontLower = new Container();

  // Sprites for parts (only essential, high-impact anatomy)
  private torsoSprite?: Sprite;
  private dorsalSprite?: Sprite;
  private tailSprite?: Sprite;
  private jawSprite?: Sprite;
  private armFrontUpperSprite?: Sprite;
  private armFrontLowerSprite?: Sprite;

  // Damage overlay flash
  private damageFlashTimer = 0;
  private shudderOffset = 0;

  // Animation state
  private elapsed = Math.random() * 10;
  private facingSign = 1;
  private currentScaleX = 1;
  private loaded = false;
  private isDestroyed = false;

  constructor(maxHp = 28, initialTheme: 'light' | 'dark' = 'dark', targetSize = 300) {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;
    // 20% larger default target size
    this.targetSize = targetSize;

    this.addChild(this.bodyRoot);
    void this.initializePuppet();
  }

  private static readonly CANONICAL_REGIONS: Record<keyof PuppetPartTextures, PartRegion> = {
    torso: { x: 22, y: 10, width: 854, height: 1054 },
    dorsalFin: { x: 650, y: 20, width: 234, height: 454 },
    jaw: { x: 922, y: 18, width: 226, height: 222 },
    tailFin: { x: 1186, y: 858, width: 248, height: 162 },
    armUpperFront: { x: 996, y: 614, width: 84, height: 270 },
    armLowerFront: { x: 1164, y: 614, width: 78, height: 268 }
  };

  public static async loadPartTextures(): Promise<PuppetPartTextures> {
    if (AbyssalHorrorBoss.cachedTextures) return AbyssalHorrorBoss.cachedTextures;
    if (AbyssalHorrorBoss.loadingPromise) return AbyssalHorrorBoss.loadingPromise;

    AbyssalHorrorBoss.loadingPromise = (async () => {
      const artworkUrl = new URL('../../assets/images/abyssal_horror_boss_sheet.png', import.meta.url).href;
      const baseTex = await Assets.load(artworkUrl);
      const source = baseTex.source;
      const w = baseTex.width || 1456;
      const h = baseTex.height || 1088;

      const makeSlice = (reg: PartRegion): Texture => {
        const rx = Math.max(0, Math.min(w - 2, reg.x));
        const ry = Math.max(0, Math.min(h - 2, reg.y));
        const rw = Math.max(2, Math.min(w - rx, reg.width));
        const rh = Math.max(2, Math.min(h - ry, reg.height));
        return new Texture({
          source,
          frame: new Rectangle(rx, ry, rw, rh)
        });
      };

      const textures: PuppetPartTextures = {
        torso: makeSlice(AbyssalHorrorBoss.CANONICAL_REGIONS.torso),
        dorsalFin: makeSlice(AbyssalHorrorBoss.CANONICAL_REGIONS.dorsalFin),
        jaw: makeSlice(AbyssalHorrorBoss.CANONICAL_REGIONS.jaw),
        tailFin: makeSlice(AbyssalHorrorBoss.CANONICAL_REGIONS.tailFin),
        armUpperFront: makeSlice(AbyssalHorrorBoss.CANONICAL_REGIONS.armUpperFront),
        armLowerFront: makeSlice(AbyssalHorrorBoss.CANONICAL_REGIONS.armLowerFront)
      };

      AbyssalHorrorBoss.cachedTextures = textures;
      return textures;
    })();

    return AbyssalHorrorBoss.loadingPromise;
  }

  private async initializePuppet(): Promise<void> {
    try {
      const tex = await AbyssalHorrorBoss.loadPartTextures();
      if (this.isDestroyed) return;

      this.buildRig(tex);
      this.applyThemeTint();
      this.loaded = true;
    } catch (err) {
      console.error('[AbyssalHorrorBoss] Puppet rig initialization fallback:', err);
      this.buildFallbackGeometry();
    }
  }

  private buildRig(tex: PuppetPartTextures): void {
    const scale = this.targetSize / 800;

    const createPart = (t: Texture, anchorX = 0.5, anchorY = 0.5): Sprite => {
      const s = new Sprite(t);
      s.anchor.set(anchorX, anchorY);
      return s;
    };

    // Layer 0: Dorsal crest behind torso
    this.dorsalSprite = createPart(tex.dorsalFin, 0.45, 0.88);
    this.dorsalFinContainer.position.set(30 * scale, -130 * scale);
    this.dorsalFinContainer.addChild(this.dorsalSprite);
    this.bodyRoot.addChild(this.dorsalFinContainer);

    // Layer 1: Tail fin behind body with convex joint overlap
    this.tailSprite = createPart(tex.tailFin, 0.12, 0.5);
    this.tailContainer.position.set(-190 * scale, 15 * scale);
    this.tailContainer.addChild(this.tailSprite);
    this.bodyRoot.addChild(this.tailContainer);

    // Layer 2: Main predatory torso & head core
    this.torsoSprite = createPart(tex.torso, 0.52, 0.48);
    this.torsoContainer.position.set(0, 0);
    this.torsoContainer.addChild(this.torsoSprite);
    this.bodyRoot.addChild(this.torsoContainer);

    // Layer 3: Articulated Cranium & Chomping Lower Jaw
    this.headContainer.position.set(165 * scale, -25 * scale);
    this.jawSprite = createPart(tex.jaw, 0.15, 0.3);
    this.jawContainer.position.set(35 * scale, 48 * scale);
    this.jawContainer.addChild(this.jawSprite);
    this.headContainer.addChild(this.jawContainer);
    this.bodyRoot.addChild(this.headContainer);

    // Layer 4: Front Articulated Claws (upper arm & lower claw)
    this.armFrontUpperSprite = createPart(tex.armUpperFront, 0.5, 0.15);
    this.armFrontLowerSprite = createPart(tex.armLowerFront, 0.5, 0.1);
    this.armFrontRoot.position.set(65 * scale, 65 * scale);
    this.armFrontLower.position.set(0, 130 * scale);
    this.armFrontLower.addChild(this.armFrontLowerSprite);
    this.armFrontRoot.addChild(this.armFrontUpperSprite);
    this.armFrontRoot.addChild(this.armFrontLower);
    this.bodyRoot.addChild(this.armFrontRoot);

    // Apply uniform scale
    this.bodyRoot.scale.set(scale, scale);
  }

  private buildFallbackGeometry(): void {
    const g = new Graphics();
    const s = this.targetSize;
    g.ellipse(0, 0, s * 0.5, s * 0.32);
    g.fill({ color: this.theme === 'light' ? 0x06b6d4 : 0x7c3aed, alpha: 0.9 });
    g.poly([
      -s * 0.45, 0,
      -s * 0.72, -s * 0.3,
      -s * 0.65, 0,
      -s * 0.72, s * 0.3
    ]);
    g.fill({ color: this.theme === 'light' ? 0x38bdf8 : 0x4c1d95, alpha: 0.9 });
    this.bodyRoot.addChild(g);
    this.loaded = true;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.applyThemeTint();
  }

  public setFacing(facing: 'left' | 'right'): void {
    this.facingSign = facing === 'left' ? -1 : 1;
  }

  private applyThemeTint(): void {
    const isLight = this.theme === 'light';
    const tintColor = isLight ? 0xe0f2fe : 0xd8b4fe;

    const sprites = [
      this.torsoSprite,
      this.dorsalSprite,
      this.tailSprite,
      this.jawSprite,
      this.armFrontUpperSprite,
      this.armFrontLowerSprite
    ];

    for (const s of sprites) {
      if (s) s.tint = tintColor;
    }
  }

  public takeDamage(damage: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - Math.max(0, damage));
    if (this.currentHp <= this.maxHp * 0.35) {
      this.isEnraged = true;
    }
    this.damageFlashTimer = 0.15;
    this.shudderOffset = (Math.random() - 0.5) * 8;
    return this.currentHp <= 0;
  }

  public update(dtScale = 1, vx = 1, vy = 0): void {
    if (this.isDestroyed) return;

    if (Math.abs(vx) > 0.08) {
      this.facingSign = vx < 0 ? -1 : 1;
    }

    const dt = dtScale / 60;
    this.elapsed += dt * (this.isEnraged ? 1.7 : 1.0);

    const baseScale = this.targetSize / 800;
    // Smooth paper cutout turn-squash
    const targetScaleX = this.facingSign;
    this.currentScaleX += (targetScaleX - this.currentScaleX) * Math.min(1, dt * 14);
    const turnSquash = 1 + Math.abs(targetScaleX - this.currentScaleX) * 0.25;

    this.bodyRoot.scale.x = this.currentScaleX * baseScale;
    this.bodyRoot.scale.y = baseScale * turnSquash;

    if (!this.loaded) return;

    // Swimming undulation & breathing
    const swimFreq = this.isEnraged ? 5.2 : 3.4;
    const breath = Math.sin(this.elapsed * 2.5) * 0.04;

    // Torso breathing & subtle spine sway
    this.torsoContainer.scale.set(1 + breath, 1 - breath * 0.5);
    this.torsoContainer.rotation = Math.sin(this.elapsed * swimFreq) * 0.06 + (vy * 0.04);

    // Fluid, aggressive jaw chomp mechanics
    // Wide predatory gape opening (0.50 - 0.65 rad, ~30-37 deg) followed by crisp clamping snap shut
    const chompCycleSpeed = this.isEnraged ? 6.5 : 4.2;
    const chompPhase = (this.elapsed * chompCycleSpeed) % (Math.PI * 2);
    // Asymmetric wave: slow open (0 to PI), fast clamp (PI to 2*PI)
    let chompProgress = 0;
    if (chompPhase < Math.PI * 1.1) {
      chompProgress = Math.sin((chompPhase / 1.1));
    } else {
      // Rapid snap clamp shut
      const clampT = (chompPhase - Math.PI * 1.1) / (Math.PI * 0.9);
      chompProgress = Math.max(0, 1 - clampT * 2.8);
    }
    const maxChompAngle = this.isEnraged ? 0.64 : 0.48;
    // Frenzy multi-bite jitter when moving fast or enraged
    const frenzyJitter = this.isEnraged ? Math.sin(this.elapsed * 18) * 0.12 : 0;
    this.jawContainer.rotation = chompProgress * maxChompAngle + Math.max(0, frenzyJitter);

    // Cranium recoil kick on bite clamp
    if (chompPhase > Math.PI * 1.05 && chompPhase < Math.PI * 1.3) {
      this.headContainer.rotation = -0.09 * (this.isEnraged ? 1.6 : 1.0);
    } else {
      this.headContainer.rotation = Math.sin(this.elapsed * swimFreq * 0.75) * 0.035;
    }

    // Powerful caudal tail fin wave with natural fluid lag
    this.tailContainer.rotation = Math.sin(this.elapsed * swimFreq - 0.85) * 0.35;

    // Menacing spined dorsal crest undulating
    this.dorsalFinContainer.rotation = Math.sin(this.elapsed * (swimFreq * 0.85)) * 0.16;

    // Claws swimming stroke animation
    this.armFrontRoot.rotation = 0.18 + Math.sin(this.elapsed * 3.8) * 0.22;
    this.armFrontLower.rotation = 0.12 + Math.sin(this.elapsed * 3.8 - 0.7) * 0.28;

    // Damage shudder & hit flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      this.bodyRoot.position.x = (Math.random() - 0.5) * 6;
      this.bodyRoot.position.y = (Math.random() - 0.5) * 6;

      const flashColor = this.currentHp <= 0 ? 0xff2244 : 0xffffff;
      this.setPartTint(flashColor);
    } else {
      this.bodyRoot.position.set(0, 0);
      this.applyThemeTint();
    }
  }

  private setPartTint(color: number): void {
    const sprites = [
      this.torsoSprite,
      this.dorsalSprite,
      this.tailSprite,
      this.jawSprite,
      this.armFrontUpperSprite,
      this.armFrontLowerSprite
    ];
    for (const s of sprites) {
      if (s) s.tint = color;
    }
  }

  public setBiteProgress(progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    this.jawContainer.rotation = p * 0.65;
    this.headContainer.position.x = (165 * (this.targetSize / 800)) + p * 15;
  }

  public override destroy(options?: { children?: boolean }): void {
    this.isDestroyed = true;
    super.destroy(options);
  }
}
