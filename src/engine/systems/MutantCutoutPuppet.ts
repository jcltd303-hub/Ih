import { Assets, Container, Sprite, Texture, Rectangle, Graphics } from 'pixi.js';
import { MUTANT_RIG_PARTS, PartRigDef } from './mutantRigData';
import mutantAtlasPng from '../../assets/images/mutant_cutout_atlas.png';

export interface RigJointControl {
  jawRotation: number;
  tailPeduncleRotation: number;
  tailFinRotation: number;
  frontArmUpperRotation: number;
  frontArmLowerRotation: number;
  rearLegUpperRotation: number;
  rearLegLowerRotation: number;
  dorsalFinRotation: number;
  headRotation: number;
}

/**
 * Procedural Paper Cutout Rigged Puppet for the Mutant Abyssal Fish.
 * Built with convex joint overlap caps for 100% gapless, fluid skeletal rotation.
 */
export class MutantCutoutPuppet extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public targetSize: number;

  private static cachedAtlasTexture: Texture | null = null;
  private static loadingPromise: Promise<Texture> | null = null;

  // Master rig hierarchy
  public readonly rigRoot = new Container();

  // Part containers (for joint rotations)
  private readonly partContainers: Map<string, Container> = new Map();
  private readonly partSprites: Map<string, Sprite> = new Map();

  // Procedural physics & motion state
  private elapsed = Math.random() * 10;
  private facingSign = 1;
  private currentScaleX = 1;
  public isLoaded = false;
  private isDestroyed = false;

  // Bite / snapping animation state
  private biteTimer = 0;
  private isBiting = false;

  // Damage shudder flash
  private damageFlashTimer = 0;
  private shudderOffset = 0;

  // Manual joint overrides (if debugging/inspecting)
  public manualControlEnabled = false;
  public manualJoints: RigJointControl = {
    jawRotation: 0,
    tailPeduncleRotation: 0,
    tailFinRotation: 0,
    frontArmUpperRotation: 0,
    frontArmLowerRotation: 0,
    rearLegUpperRotation: 0,
    rearLegLowerRotation: 0,
    dorsalFinRotation: 0,
    headRotation: 0
  };

  private proxyGraphic?: Graphics;

  constructor(maxHp = 20, theme: 'light' | 'dark' = 'dark', targetSize = 180) {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = theme;
    this.targetSize = targetSize;

    this.addChild(this.rigRoot);
    this.buildProxyGraphic();
    void this.initializeRig();
  }

  private buildProxyGraphic(): void {
    const g = new Graphics();
    const s = this.targetSize;
    // Stylized paper silhouette so creature is visible instantly
    const bodyColor = this.theme === 'light' ? 0x06b6d4 : 0x8b5cf6;
    const finColor = this.theme === 'light' ? 0x38bdf8 : 0xec4899;
    
    // Tail fin
    g.poly([s * 0.1, 0, s * 0.4, -s * 0.2, s * 0.45, 0, s * 0.4, s * 0.2]);
    g.fill({ color: finColor, alpha: 0.8 });

    // Main torso
    g.ellipse(0, 0, s * 0.32, s * 0.2);
    g.fill({ color: bodyColor, alpha: 0.95 });
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.7 });

    // Dorsal spine
    g.poly([-s * 0.1, -s * 0.18, 0, -s * 0.35, s * 0.15, -s * 0.16]);
    g.fill({ color: finColor, alpha: 0.85 });

    // Eye
    g.circle(-s * 0.18, -s * 0.05, 5);
    g.fill({ color: 0xfef08a });
    g.circle(-s * 0.19, -s * 0.05, 2.5);
    g.fill({ color: 0x000000 });

    this.proxyGraphic = g;
    this.rigRoot.addChild(g);
  }

  public static async loadAtlas(): Promise<Texture> {
    if (MutantCutoutPuppet.cachedAtlasTexture) return MutantCutoutPuppet.cachedAtlasTexture;
    if (MutantCutoutPuppet.loadingPromise) return MutantCutoutPuppet.loadingPromise;

    MutantCutoutPuppet.loadingPromise = (async () => {
      try {
        const tex = await Assets.load(mutantAtlasPng);
        MutantCutoutPuppet.cachedAtlasTexture = tex;
        return tex;
      } catch (e) {
        // Fallback to public URL or asset URL
        try {
          const atlasUrl = new URL('/assets/mutant_cutout_atlas.png', window.location.origin).href;
          const tex = await Assets.load(atlasUrl);
          MutantCutoutPuppet.cachedAtlasTexture = tex;
          return tex;
        } catch (err) {
          const tex = Texture.from(mutantAtlasPng);
          MutantCutoutPuppet.cachedAtlasTexture = tex;
          return tex;
        }
      }
    })();

    return MutantCutoutPuppet.loadingPromise;
  }

  private async initializeRig(): Promise<void> {
    try {
      const atlasTex = await MutantCutoutPuppet.loadAtlas();
      if (this.isDestroyed) return;

      if (this.proxyGraphic) {
        this.rigRoot.removeChild(this.proxyGraphic);
        this.proxyGraphic.destroy();
        this.proxyGraphic = undefined;
      }

      this.assembleHierarchy(atlasTex);
      this.applyThemeTint();
      this.isLoaded = true;
    } catch (err) {
      console.error('[MutantCutoutPuppet] Failed to assemble puppet rig:', err);
      // Proxy graphic remains active
      this.isLoaded = true;
    }
  }

  private assembleHierarchy(atlasTex: Texture): void {
    const source = atlasTex.source;

    // First pass: create containers and sprites with textures sliced from atlas
    for (const [partId, def] of Object.entries(MUTANT_RIG_PARTS)) {
      const frame = new Rectangle(def.frame.x, def.frame.y, def.frame.w, def.frame.h);
      const partTex = new Texture({ source, frame });

      const partContainer = new Container();
      const partSprite = new Sprite(partTex);

      // Set calibrated joint pivot anchor
      partSprite.anchor.set(def.anchor.x, def.anchor.y);

      partContainer.addChild(partSprite);
      this.partContainers.set(partId, partContainer);
      this.partSprites.set(partId, partSprite);
    }

    // Second pass: attach into hierarchical bone tree based on parent relationships
    // Sort by zOrder
    const sortedParts = Object.entries(MUTANT_RIG_PARTS).sort((a, b) => a[1].zOrder - b[1].zOrder);

    for (const [partId, def] of sortedParts) {
      const container = this.partContainers.get(partId)!;
      if (!def.parent) {
        // Torso root attached to master rigRoot
        container.position.set(0, 0);
        this.rigRoot.addChild(container);
      } else {
        const parentContainer = this.partContainers.get(def.parent);
        if (parentContainer) {
          container.position.set(def.attachOffset.x, def.attachOffset.y);
          parentContainer.addChild(container);
        } else {
          this.rigRoot.addChild(container);
        }
      }
    }

    // Scale entire rig to target size (source full fish is ~1240px wide)
    const rigScale = this.targetSize / 700;
    this.rigRoot.scale.set(rigScale, rigScale);
  }

  private buildFallbackGraphic(): void {
    const g = new Graphics();
    const s = this.targetSize;
    g.ellipse(0, 0, s * 0.45, s * 0.28);
    g.fill({ color: this.theme === 'light' ? 0x06b6d4 : 0x7c3aed, alpha: 0.9 });
    this.rigRoot.addChild(g);
    this.isLoaded = true;
  }

  /**
   * Procedural animation loop.
   * Produces lifelike, gapless swimming, undulating spine, flexing claws, and snapping jaw.
   */
  public update(deltaMs: number, speedMultiplier = 1.0): void {
    const dt = (deltaMs / 1000) * speedMultiplier;
    this.elapsed += dt;

    // Shudder / damage flash decay
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt * 6.0);
      this.shudderOffset = Math.sin(this.elapsed * 50) * 4.0 * this.damageFlashTimer;
    } else {
      this.shudderOffset = 0;
    }

    // Bite animation timer
    if (this.isBiting) {
      this.biteTimer += dt * 8.0;
      if (this.biteTimer >= Math.PI) {
        this.isBiting = false;
        this.biteTimer = 0;
      }
    }

    // Smooth horizontal turning flip
    if (Math.abs(this.currentScaleX - this.facingSign) > 0.01) {
      this.currentScaleX += (this.facingSign - this.currentScaleX) * Math.min(1.0, dt * 10.0);
      const rigScale = this.targetSize / 700;
      this.rigRoot.scale.x = this.currentScaleX * rigScale;
    }

    if (!this.isLoaded) return;

    if (this.manualControlEnabled) {
      this.applyManualJoints();
      return;
    }

    // --- PROCEDURAL ORGANIC SWIMMING PHYSICS ---
    const swimSpeed = 3.6;
    const t = this.elapsed * swimSpeed;

    // 1. Torso Breathing & Core Roll
    const torso = this.partContainers.get('torso');
    if (torso) {
      torso.position.y = Math.sin(t * 0.7) * 3.0 + this.shudderOffset;
      torso.rotation = Math.sin(t * 0.5) * 0.04;
      const breathScale = 1.0 + Math.sin(t * 0.9) * 0.02;
      torso.scale.set(breathScale, breathScale);
    }

    // 2. Head subtle tracking & bob
    const head = this.partContainers.get('head_upper');
    if (head) {
      head.rotation = Math.sin(t * 0.6 + 0.3) * 0.05;
    }

    // 3. Articulated Lower Jaw (GAPLESS TMJ HINGE)
    // Snaps down when biting or flexes periodically
    const jaw = this.partContainers.get('jaw_lower');
    if (jaw) {
      if (this.isBiting) {
        // Dramatic chomp action: open wide then snap shut
        jaw.rotation = Math.sin(this.biteTimer) * 0.36;
      } else {
        // Subtle organic mouth gasping / breathing rhythm
        const gasping = Math.max(0, Math.sin(t * 0.8 - 0.5));
        jaw.rotation = gasping * 0.12;
      }
    }

    // 4. Dorsal Fin Spiny Undulation (GAPLESS SPINAL RIDGE)
    const dorsal = this.partContainers.get('dorsal_fin');
    if (dorsal) {
      dorsal.rotation = Math.sin(t + 0.6) * 0.12;
    }

    // 5. Tail Peduncle & Caudal Fin Wave (2-BONE LAG WAVE)
    const peduncle = this.partContainers.get('tail_peduncle');
    if (peduncle) {
      peduncle.rotation = Math.sin(t) * 0.18;
    }

    const tailFin = this.partContainers.get('tail_fin');
    if (tailFin) {
      // Secondary trailing phase lag ensures fluid fish-like tail snap
      tailFin.rotation = Math.sin(t - 1.1) * 0.28;
    }

    // 6. Front Arm & Claw Joint Chain (SHOULDER -> ELBOW)
    const armUpper = this.partContainers.get('arm_front_upper');
    const armLower = this.partContainers.get('arm_front_lower');
    if (armUpper) {
      armUpper.rotation = Math.sin(t * 0.9 + 1.2) * 0.14 + 0.05;
    }
    if (armLower) {
      armLower.rotation = Math.sin(t * 0.9 + 0.4) * 0.22 - 0.08;
    }

    // 7. Rear Leg Joint Chain (HIP -> KNEE -> FOOT)
    const legUpper = this.partContainers.get('leg_rear_upper');
    const legLower = this.partContainers.get('leg_rear_lower');
    if (legUpper) {
      legUpper.rotation = Math.sin(t * 0.85 + 2.0) * 0.12 - 0.05;
    }
    if (legLower) {
      legLower.rotation = Math.sin(t * 0.85 + 1.2) * 0.18 + 0.04;
    }

    // 8. Ventral Finlet Flutter
    const ventral = this.partContainers.get('ventral_finlet');
    if (ventral) {
      ventral.rotation = Math.sin(t * 1.4) * 0.16;
    }
  }

  private applyManualJoints(): void {
    const setRot = (id: string, rot: number) => {
      const c = this.partContainers.get(id);
      if (c) c.rotation = rot;
    };

    setRot('jaw_lower', this.manualJoints.jawRotation);
    setRot('tail_peduncle', this.manualJoints.tailPeduncleRotation);
    setRot('tail_fin', this.manualJoints.tailFinRotation);
    setRot('arm_front_upper', this.manualJoints.frontArmUpperRotation);
    setRot('arm_front_lower', this.manualJoints.frontArmLowerRotation);
    setRot('leg_rear_upper', this.manualJoints.rearLegUpperRotation);
    setRot('leg_rear_lower', this.manualJoints.rearLegLowerRotation);
    setRot('dorsal_fin', this.manualJoints.dorsalFinRotation);
    setRot('head_upper', this.manualJoints.headRotation);
  }

  /**
   * Triggers an aggressive snapping chomp action.
   */
  public triggerBite(): void {
    this.isBiting = true;
    this.biteTimer = 0;
  }

  /**
   * Sets facing direction (-1 for left, +1 for right).
   * Note: The source artwork naturally faces LEFT, so facing 'left' is positive scale!
   */
  public setFacing(facing: 'left' | 'right'): void {
    this.facingSign = facing === 'left' ? 1 : -1;
  }

  public takeDamage(amount: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - amount);
    this.damageFlashTimer = 1.0;
    this.triggerBite();
    return this.currentHp <= 0;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.applyThemeTint();
  }

  private applyThemeTint(): void {
    const isLight = this.theme === 'light';
    // Light theme: crisp oceanic glow with vibrant highlights
    // Dark theme: eerie bioluminescent purple/spectral green shade
    const tintColor = isLight ? 0xffffff : 0xd8b4fe;

    for (const sprite of this.partSprites.values()) {
      sprite.tint = tintColor;
    }
  }

  public override destroy(): void {
    this.isDestroyed = true;
    super.destroy();
  }
}
