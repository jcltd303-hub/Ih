import { Container, Graphics, Sprite, Texture } from 'pixi.js';

interface TetraPartTextures {
  torso: Texture;
  head: Texture;
  jaw: Texture;
  tailPeduncle: Texture;
  tailFin: Texture;
  dorsalFin: Texture;
  pectoralFin: Texture;
  ventralFin: Texture;
}

/**
 * Cache for high-resolution vector/canvas cutout textures of the Neon Tetra.
 * Generated with anti-aliasing and convex joint caps for 100% gapless skeletal rotation.
 */
class TetraTextureCache {
  private static instance: TetraTextureCache;
  private cache: Map<string, TetraPartTextures> = new Map();

  public static getInstance(): TetraTextureCache {
    if (!TetraTextureCache.instance) {
      TetraTextureCache.instance = new TetraTextureCache();
    }
    return TetraTextureCache.instance;
  }

  public getTextures(theme: 'light' | 'dark'): TetraPartTextures {
    if (!this.cache.has(theme)) {
      this.cache.set(theme, this.generateTextures(theme));
    }
    return this.cache.get(theme)!;
  }

  private generateTextures(theme: 'light' | 'dark'): TetraPartTextures {
    const isLight = theme === 'light';

    // Helper: create crisp 2D canvas texture
    const makeTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture => {
      const dpr = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      draw(ctx);
      return Texture.from(canvas);
    };

    // 1. Torso (slender torpedo body with radiant lateral stripe)
    const torso = makeTexture(110, 48, (ctx) => {
      ctx.save();
      ctx.translate(55, 24);

      // Base body gradient
      const bodyGrad = ctx.createLinearGradient(0, -20, 0, 20);
      if (isLight) {
        bodyGrad.addColorStop(0, '#0369a1'); // deep cobalt dorsal
        bodyGrad.addColorStop(0.35, '#0284c7');
        bodyGrad.addColorStop(0.55, '#f8fafc'); // silver belly
        bodyGrad.addColorStop(1, '#e11d48'); // crimson red ventral
      } else {
        bodyGrad.addColorStop(0, '#1e1b4b');
        bodyGrad.addColorStop(0.35, '#3b0764');
        bodyGrad.addColorStop(0.6, '#0f172a');
        bodyGrad.addColorStop(1, '#831843');
      }

      // Fuselage silhouette
      ctx.beginPath();
      ctx.moveTo(-50, 0);
      ctx.bezierCurveTo(-35, -20, 25, -20, 50, -4);
      ctx.bezierCurveTo(45, 16, 15, 22, -35, 16);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Overlapping convex joint cap at tail attachment (left side)
      ctx.beginPath();
      ctx.arc(-42, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Overlapping convex joint cap at head attachment (right side)
      ctx.beginPath();
      ctx.arc(42, 0, 15, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Radiant glowing lateral neon stripe (iconic neon tetra band)
      ctx.save();
      ctx.shadowColor = isLight ? '#00f0ff' : '#a855f7';
      ctx.shadowBlur = isLight ? 8 : 10;
      ctx.beginPath();
      ctx.moveTo(-45, -2);
      ctx.bezierCurveTo(-15, -4, 20, -5, 48, -4);
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = isLight ? '#22d3ee' : '#c084fc';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Core bright light band
      ctx.beginPath();
      ctx.moveTo(-44, -2);
      ctx.bezierCurveTo(-15, -4, 20, -5, 47, -4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();

      // Subtle scale shimmer overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let x = -30; x <= 30; x += 12) {
        ctx.beginPath();
        ctx.arc(x, 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // 2. Head (cranium with glowing eye and gill cover)
    const head = makeTexture(48, 44, (ctx) => {
      ctx.save();
      ctx.translate(14, 22);

      const headGrad = ctx.createLinearGradient(0, -18, 0, 18);
      if (isLight) {
        headGrad.addColorStop(0, '#0284c7');
        headGrad.addColorStop(0.5, '#38bdf8');
        headGrad.addColorStop(1, '#94a3b8');
      } else {
        headGrad.addColorStop(0, '#312e81');
        headGrad.addColorStop(0.5, '#4c1d95');
        headGrad.addColorStop(1, '#1e293b');
      }

      // Snout and cranium
      ctx.beginPath();
      ctx.moveTo(-10, -16);
      ctx.bezierCurveTo(12, -15, 28, -8, 30, 2);
      ctx.bezierCurveTo(28, 12, 10, 16, -10, 14);
      ctx.closePath();
      ctx.fillStyle = headGrad;
      ctx.fill();

      // Operculum (gill plate) line
      ctx.beginPath();
      ctx.arc(-2, 0, 12, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.strokeStyle = isLight ? 'rgba(0, 240, 255, 0.4)' : 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Large reflective predatory neon eye
      const eyeX = 14;
      const eyeY = -4;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = isLight ? '#00f0ff' : '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pupil & reflection
      ctx.beginPath();
      ctx.arc(eyeX + 1.5, eyeY - 1.5, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Cyan neon eye reflection arc
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 4.5, -Math.PI * 0.6, 0);
      ctx.strokeStyle = isLight ? '#38bdf8' : '#e0e7ff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    });

    // 3. Articulated Lower Jaw
    const jaw = makeTexture(28, 20, (ctx) => {
      ctx.save();
      ctx.translate(6, 6);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(8, 0, 16, 5, 18, 10);
      ctx.bezierCurveTo(10, 12, 2, 8, -2, 4);
      ctx.closePath();
      ctx.fillStyle = isLight ? '#38bdf8' : '#6b21a8';
      ctx.fill();
      ctx.strokeStyle = isLight ? '#0284c7' : '#9333ea';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Convex joint pivot cap
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? '#0284c7' : '#581c87';
      ctx.fill();

      ctx.restore();
    });

    // 4. Tail Peduncle (middle rear joint)
    const tailPeduncle = makeTexture(42, 32, (ctx) => {
      ctx.save();
      ctx.translate(21, 16);

      const pGrad = ctx.createLinearGradient(0, -12, 0, 12);
      if (isLight) {
        pGrad.addColorStop(0, '#0369a1');
        pGrad.addColorStop(0.5, '#e11d48');
        pGrad.addColorStop(1, '#be123c');
      } else {
        pGrad.addColorStop(0, '#1e1b4b');
        pGrad.addColorStop(0.5, '#701a75');
        pGrad.addColorStop(1, '#4c0519');
      }

      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.bezierCurveTo(-5, -12, 10, -14, 16, -12);
      ctx.lineTo(16, 12);
      ctx.bezierCurveTo(8, 14, -5, 12, -16, 6);
      ctx.closePath();
      ctx.fillStyle = pGrad;
      ctx.fill();

      // Rounded convex overlap caps on both connection sides
      ctx.beginPath();
      ctx.arc(14, 0, 11, 0, Math.PI * 2);
      ctx.arc(-14, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = pGrad;
      ctx.fill();

      ctx.restore();
    });

    // 5. Caudal Fin / Tail Fin (translucent forked fin)
    const tailFin = makeTexture(48, 56, (ctx) => {
      ctx.save();
      ctx.translate(10, 28);

      const finGrad = ctx.createLinearGradient(0, 0, -35, 0);
      if (isLight) {
        finGrad.addColorStop(0, 'rgba(225, 29, 72, 0.85)');
        finGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.55)');
        finGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      } else {
        finGrad.addColorStop(0, 'rgba(168, 85, 247, 0.85)');
        finGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.55)');
        finGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      }

      // Classic forked caudal fin
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-12, -16, -26, -26, -36, -24);
      ctx.bezierCurveTo(-28, -8, -14, -2, -18, 0);
      ctx.bezierCurveTo(-14, 2, -28, 8, -36, 24);
      ctx.bezierCurveTo(-26, 26, -12, 16, 0, 0);
      ctx.closePath();
      ctx.fillStyle = finGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? 'rgba(0, 240, 255, 0.7)' : 'rgba(192, 132, 252, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Fin rays / striations
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 0.8;
      for (const y of [-16, -8, 8, 16]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-30, y);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 6. Dorsal Fin (translucent spined fin)
    const dorsalFin = makeTexture(36, 36, (ctx) => {
      ctx.save();
      ctx.translate(8, 30);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(4, -18, 14, -26, 20, -28);
      ctx.bezierCurveTo(16, -18, 12, -8, 22, 0);
      ctx.closePath();
      ctx.fillStyle = isLight ? 'rgba(56, 189, 248, 0.65)' : 'rgba(168, 85, 247, 0.65)';
      ctx.fill();
      ctx.strokeStyle = isLight ? 'rgba(0, 240, 255, 0.8)' : 'rgba(216, 180, 254, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    });

    // 7. Pectoral Fin (delicate side paddle)
    const pectoralFin = makeTexture(32, 24, (ctx) => {
      ctx.save();
      ctx.translate(6, 6);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(8, 6, 18, 12, 24, 15);
      ctx.bezierCurveTo(16, 12, 8, 6, 4, 2);
      ctx.closePath();
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(192, 132, 252, 0.6)';
      ctx.fill();
      ctx.strokeStyle = isLight ? 'rgba(56, 189, 248, 0.8)' : 'rgba(168, 85, 247, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    });

    // 8. Ventral Fin
    const ventralFin = makeTexture(24, 24, (ctx) => {
      ctx.save();
      ctx.translate(6, 4);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(4, 8, 8, 14, 14, 16);
      ctx.bezierCurveTo(8, 10, 4, 4, 0, 0);
      ctx.closePath();
      ctx.fillStyle = isLight ? 'rgba(225, 29, 72, 0.6)' : 'rgba(147, 51, 234, 0.6)';
      ctx.fill();

      ctx.restore();
    });

    return { torso, head, jaw, tailPeduncle, tailFin, dorsalFin, pectoralFin, ventralFin };
  }
}

/**
 * Articulated Paper Cutout Rigged Puppet for the Small Neon Tetra.
 * Built with convex joint overlap caps for 100% gapless, fluid skeletal rotation.
 */
export class TetraCutoutPuppet extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public targetSize: number;

  // Master rig hierarchy
  public readonly rigRoot = new Container();
  public readonly bodyRoot = new Container();

  // Part containers (hierarchical articulation)
  private readonly dorsalContainer = new Container();
  private readonly ventralContainer = new Container();
  private readonly tailPeduncleContainer = new Container();
  private readonly tailFinContainer = new Container();
  private readonly torsoContainer = new Container();
  private readonly headContainer = new Container();
  private readonly jawContainer = new Container();
  private readonly pectoralContainer = new Container();

  // Sprites
  private torsoSprite?: Sprite;
  private headSprite?: Sprite;
  private jawSprite?: Sprite;
  private tailPeduncleSprite?: Sprite;
  private tailFinSprite?: Sprite;
  private dorsalSprite?: Sprite;
  private pectoralSprite?: Sprite;
  private ventralSprite?: Sprite;

  // Animation & physics state
  private elapsed = Math.random() * 10;
  private facingSign = 1;
  private currentScaleX = 1;
  public isLoaded = false;
  private isDestroyed = false;

  // Damage shudder flash
  private damageFlashTimer = 0;

  constructor(maxHp = 2, theme: 'light' | 'dark' = 'light', targetSize = 64) {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = theme;
    this.targetSize = targetSize;

    this.addChild(this.rigRoot);
    this.rigRoot.addChild(this.bodyRoot);

    this.buildRig();
    this.isLoaded = true;
  }

  private buildRig(): void {
    const textures = TetraTextureCache.getInstance().getTextures(this.theme);
    const scale = this.targetSize / 110;

    const createPart = (t: Texture, ax = 0.5, ay = 0.5): Sprite => {
      const s = new Sprite(t);
      s.anchor.set(ax, ay);
      return s;
    };

    // Layer 0: Dorsal fin behind body
    this.dorsalSprite = createPart(textures.dorsalFin, 0.2, 0.9);
    this.dorsalContainer.position.set(-8 * scale, -16 * scale);
    this.dorsalContainer.addChild(this.dorsalSprite);
    this.bodyRoot.addChild(this.dorsalContainer);

    // Layer 1: Ventral fin below body
    this.ventralSprite = createPart(textures.ventralFin, 0.25, 0.2);
    this.ventralContainer.position.set(2 * scale, 14 * scale);
    this.ventralContainer.addChild(this.ventralSprite);
    this.bodyRoot.addChild(this.ventralContainer);

    // Layer 2: Tail peduncle and caudal fin
    this.tailPeduncleSprite = createPart(textures.tailPeduncle, 0.5, 0.5);
    this.tailPeduncleContainer.position.set(-36 * scale, -1 * scale);
    this.tailPeduncleContainer.addChild(this.tailPeduncleSprite);

    this.tailFinSprite = createPart(textures.tailFin, 0.95, 0.5);
    this.tailFinContainer.position.set(-16 * scale, 0);
    this.tailFinContainer.addChild(this.tailFinSprite);
    this.tailPeduncleContainer.addChild(this.tailFinContainer);
    this.bodyRoot.addChild(this.tailPeduncleContainer);

    // Layer 3: Main torpedo torso
    this.torsoSprite = createPart(textures.torso, 0.5, 0.5);
    this.torsoContainer.position.set(0, 0);
    this.torsoContainer.addChild(this.torsoSprite);
    this.bodyRoot.addChild(this.torsoContainer);

    // Layer 4: Head & Articulated Nibbling Jaw
    this.headSprite = createPart(textures.head, 0.3, 0.5);
    this.headContainer.position.set(38 * scale, -2 * scale);
    this.headContainer.addChild(this.headSprite);

    this.jawSprite = createPart(textures.jaw, 0.2, 0.3);
    this.jawContainer.position.set(16 * scale, 6 * scale);
    this.jawContainer.addChild(this.jawSprite);
    this.headContainer.addChild(this.jawContainer);
    this.bodyRoot.addChild(this.headContainer);

    // Layer 5: Pectoral fluttering fin
    this.pectoralSprite = createPart(textures.pectoralFin, 0.2, 0.3);
    this.pectoralContainer.position.set(18 * scale, 4 * scale);
    this.pectoralContainer.addChild(this.pectoralSprite);
    this.bodyRoot.addChild(this.pectoralContainer);

    this.bodyRoot.scale.set(scale, scale);
  }

  public setTheme(theme: 'light' | 'dark'): void {
    if (this.theme === theme) return;
    this.theme = theme;
    const textures = TetraTextureCache.getInstance().getTextures(theme);
    if (this.torsoSprite) this.torsoSprite.texture = textures.torso;
    if (this.headSprite) this.headSprite.texture = textures.head;
    if (this.jawSprite) this.jawSprite.texture = textures.jaw;
    if (this.tailPeduncleSprite) this.tailPeduncleSprite.texture = textures.tailPeduncle;
    if (this.tailFinSprite) this.tailFinSprite.texture = textures.tailFin;
    if (this.dorsalSprite) this.dorsalSprite.texture = textures.dorsalFin;
    if (this.pectoralSprite) this.pectoralSprite.texture = textures.pectoralFin;
    if (this.ventralSprite) this.ventralSprite.texture = textures.ventralFin;
  }

  public setFacing(facing: 'left' | 'right'): void {
    this.facingSign = facing === 'left' ? -1 : 1;
  }

  public takeDamage(damage: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - Math.max(0, damage));
    this.damageFlashTimer = 0.12;
    return this.currentHp <= 0;
  }

  public update(dtMs: number): void {
    if (this.isDestroyed) return;

    const dt = dtMs / 1000;
    this.elapsed += dt;

    // Smooth turn squash
    const targetScaleX = this.facingSign;
    this.currentScaleX += (targetScaleX - this.currentScaleX) * Math.min(1, dt * 16);
    const turnSquash = 1 + Math.abs(targetScaleX - this.currentScaleX) * 0.22;

    const baseScale = this.targetSize / 110;
    this.bodyRoot.scale.x = this.currentScaleX * baseScale;
    this.bodyRoot.scale.y = baseScale * turnSquash;

    // High frequency schooling tetra undulation
    const swimFreq = 7.5;
    const bodyWave = Math.sin(this.elapsed * swimFreq);

    // Torso gentle heave
    this.torsoContainer.rotation = bodyWave * 0.04;

    // Tail peduncle undulates with sinusoidal phase lag
    this.tailPeduncleContainer.rotation = Math.sin(this.elapsed * swimFreq - 0.7) * 0.24;

    // Caudal fin wags with additional wave lag (creates fluid S-curve fish tail whip)
    this.tailFinContainer.rotation = Math.sin(this.elapsed * swimFreq - 1.4) * 0.38;

    // Head counter-balances tail whip
    this.headContainer.rotation = -bodyWave * 0.05;

    // Rhythmic breathing / nibbling mouth
    this.jawContainer.rotation = Math.max(0, Math.sin(this.elapsed * 4.2)) * 0.32;

    // Dorsal fin undulating flutter
    this.dorsalContainer.rotation = Math.sin(this.elapsed * (swimFreq * 0.8)) * 0.15;

    // Pectoral fin beats rapidly
    this.pectoralContainer.rotation = Math.sin(this.elapsed * 14) * 0.28;

    // Hit flash / damage shudder
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      this.bodyRoot.position.x = (Math.random() - 0.5) * 4;
      this.bodyRoot.position.y = (Math.random() - 0.5) * 4;
      this.setPartTint(0xffffff);
    } else {
      this.bodyRoot.position.set(0, 0);
      this.setPartTint(0xffffff);
    }
  }

  private setPartTint(color: number): void {
    const sprites = [
      this.torsoSprite,
      this.headSprite,
      this.jawSprite,
      this.tailPeduncleSprite,
      this.tailFinSprite,
      this.dorsalSprite,
      this.pectoralSprite,
      this.ventralSprite
    ];
    for (const s of sprites) {
      if (s) s.tint = color;
    }
  }

  public override destroy(options?: { children?: boolean }): void {
    this.isDestroyed = true;
    super.destroy(options);
  }
}
