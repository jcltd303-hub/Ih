import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { GameTheme } from './ThemeManager';

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  phase: number;
  color: number;
}

interface BubbleParticle {
  x: number;
  y: number;
  vy: number;
  radius: number;
  wobbleSpeed: number;
  wobblePhase: number;
  wobbleAmp: number;
}

interface LightShaft {
  baseX: number;
  width: number;
  angle: number;
  speed: number;
  phase: number;
  alpha: number;
}

export class AnimatedBackground {
  public container: Container;

  private backdropSprite?: Sprite;
  private causticsGraphic: Graphics;
  private godRaysGraphic: Graphics;
  private particleGraphic: Graphics;
  private bubbleGraphic: Graphics;

  private screenWidth: number;
  private screenHeight: number;
  private theme: GameTheme = 'light';

  private time: number = 0;
  private particles: AmbientParticle[] = [];
  private bubbles: BubbleParticle[] = [];
  private lightShafts: LightShaft[] = [];

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.container = new Container();

    // Layer 0: Backdrop image / deep oceanic trench
    this.setupBackdrop();

    // Layer 1: Procedural animated caustics refraction web
    this.causticsGraphic = new Graphics();
    this.container.addChild(this.causticsGraphic);

    // Layer 2: Volumetric light shafts / god rays
    this.godRaysGraphic = new Graphics();
    this.container.addChild(this.godRaysGraphic);

    // Layer 3: Drifting marine snow & bioluminescent plankton
    this.particleGraphic = new Graphics();
    this.container.addChild(this.particleGraphic);

    // Layer 4: Rising hydrothermal bubble columns
    this.bubbleGraphic = new Graphics();
    this.container.addChild(this.bubbleGraphic);

    this.initParticles();
    this.initBubbles();
    this.initLightShafts();
  }

  private async setupBackdrop(): Promise<void> {
    try {
      const tex = await Assets.load('deep_abyss_seabed.jpg');
      if (tex && !this.container.destroyed) {
        this.backdropSprite = new Sprite(tex);
        this.backdropSprite.anchor.set(0.5, 0.5);
        this.backdropSprite.x = this.screenWidth / 2;
        this.backdropSprite.y = this.screenHeight / 2;
        this.resizeBackdrop();
        // Insert at bottom-most layer
        this.container.addChildAt(this.backdropSprite, 0);
        this.applyThemeToBackdrop();
      }
    } catch (e) {
      console.warn('[AnimatedBackground] Backdrop image fallback to procedural gradient.');
    }
  }

  private resizeBackdrop(): void {
    if (!this.backdropSprite) return;
    const texW = this.backdropSprite.texture.width || 1408;
    const texH = this.backdropSprite.texture.height || 768;

    const scale = Math.max(this.screenWidth / texW, this.screenHeight / texH) * 1.05;
    this.backdropSprite.scale.set(scale);
    this.backdropSprite.x = this.screenWidth / 2;
    this.backdropSprite.y = this.screenHeight / 2;
  }

  private initParticles(): void {
    const count = 75;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.screenWidth,
        y: Math.random() * this.screenHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.5 + 0.15), // Slow upward drift
        size: Math.random() * 2.5 + 1.0,
        alpha: Math.random() * 0.6 + 0.2,
        baseAlpha: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.3 ? 0x00ffcc : 0x38bdf8
      });
    }
  }

  private initBubbles(): void {
    const count = 28;
    this.bubbles = [];
    for (let i = 0; i < count; i++) {
      this.bubbles.push({
        x: Math.random() * this.screenWidth,
        y: Math.random() * this.screenHeight,
        vy: -(Math.random() * 1.8 + 0.8),
        radius: Math.random() * 5 + 2.5,
        wobbleSpeed: Math.random() * 0.05 + 0.02,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: Math.random() * 1.8 + 0.6
      });
    }
  }

  private initLightShafts(): void {
    this.lightShafts = [
      { baseX: this.screenWidth * 0.15, width: 90, angle: 0.25, speed: 0.008, phase: 0, alpha: 0.12 },
      { baseX: this.screenWidth * 0.38, width: 140, angle: 0.18, speed: 0.006, phase: 1.5, alpha: 0.15 },
      { baseX: this.screenWidth * 0.62, width: 120, angle: -0.15, speed: 0.009, phase: 3.1, alpha: 0.14 },
      { baseX: this.screenWidth * 0.85, width: 110, angle: -0.22, speed: 0.007, phase: 4.8, alpha: 0.11 }
    ];
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.applyThemeToBackdrop();
  }

  private applyThemeToBackdrop(): void {
    if (!this.backdropSprite) return;
    if (this.theme === 'dark') {
      this.backdropSprite.tint = 0x664477;
      this.backdropSprite.alpha = 0.65;
    } else {
      this.backdropSprite.tint = 0xffffff;
      this.backdropSprite.alpha = 0.85;
    }
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.resizeBackdrop();
    this.initLightShafts();
  }

  public update(deltaTime: number): void {
    this.time += deltaTime * 0.0015;

    // Subtle parallax swell on backdrop
    if (this.backdropSprite) {
      this.backdropSprite.y = (this.screenHeight / 2) + Math.sin(this.time * 0.6) * 6;
      this.backdropSprite.x = (this.screenWidth / 2) + Math.cos(this.time * 0.4) * 4;
    }

    this.renderCaustics();
    this.renderGodRays();
    this.renderParticles(deltaTime);
    this.renderBubbles(deltaTime);
  }

  /**
   * Renders living water caustics reflecting shimmering light onto the ocean depths
   */
  private renderCaustics(): void {
    this.causticsGraphic.clear();

    const isDark = this.theme === 'dark';
    const causticColor = isDark ? 0x9333ea : 0x38bdf8;
    const baseAlpha = isDark ? 0.08 : 0.14;

    const cols = 7;
    const rows = 5;
    const cellW = this.screenWidth / cols;
    const cellH = this.screenHeight / rows;

    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const x = i * cellW;
        const y = j * cellH;

        // Multi-frequency wave calculation for natural fluid caustics
        const wave1 = Math.sin(x * 0.008 + this.time * 2.2 + y * 0.005);
        const wave2 = Math.cos(y * 0.009 - this.time * 1.8 + x * 0.004);
        const intensity = (wave1 * wave2 + 1) * 0.5;

        if (intensity > 0.4) {
          const radius = (cellW * 0.45) * intensity;
          const alpha = baseAlpha * intensity;

          this.causticsGraphic.ellipse(
            x + wave1 * 14,
            y + wave2 * 14,
            radius,
            radius * 0.5
          );
          this.causticsGraphic.fill({ color: causticColor, alpha });
        }
      }
    }
  }

  /**
   * Renders volumetric underwater god rays piercing down from the surface
   */
  private renderGodRays(): void {
    this.godRaysGraphic.clear();

    const isDark = this.theme === 'dark';
    const rayColor = isDark ? 0x7c3aed : 0xbae6fd;
    const maxRayAlpha = isDark ? 0.07 : 0.13;

    for (const shaft of this.lightShafts) {
      const currentPhase = shaft.phase + this.time * shaft.speed * 20;
      const swayAngle = shaft.angle + Math.sin(currentPhase) * 0.06;
      const pulsingAlpha = shaft.alpha * (0.8 + Math.sin(currentPhase * 1.4) * 0.3) * (isDark ? 0.6 : 1.0);

      const topX = shaft.baseX + Math.sin(currentPhase * 0.8) * 40;
      const topY = -20;
      const bottomY = this.screenHeight + 50;
      const bottomX = topX + Math.tan(swayAngle) * (bottomY - topY);

      this.godRaysGraphic.poly([
        { x: topX - shaft.width * 0.3, y: topY },
        { x: topX + shaft.width * 0.3, y: topY },
        { x: bottomX + shaft.width * 0.9, y: bottomY },
        { x: bottomX - shaft.width * 0.9, y: bottomY }
      ]);
      this.godRaysGraphic.fill({ color: rayColor, alpha: Math.min(maxRayAlpha, pulsingAlpha) });
    }
  }

  /**
   * Renders floating marine snow and bioluminescent micro-particles
   */
  private renderParticles(deltaTime: number): void {
    this.particleGraphic.clear();

    const dt = Math.min(deltaTime * 0.06, 2.0);

    for (const p of this.particles) {
      p.x += (p.vx + Math.sin(this.time + p.phase) * 0.3) * dt;
      p.y += p.vy * dt;

      // Wrap around
      if (p.y < -10) {
        p.y = this.screenHeight + 10;
        p.x = Math.random() * this.screenWidth;
      }
      if (p.x < -10) p.x = this.screenWidth + 10;
      if (p.x > this.screenWidth + 10) p.x = -10;

      // Pulse alpha
      const currentAlpha = p.baseAlpha + Math.sin(this.time * 2 + p.phase) * 0.2;

      this.particleGraphic.circle(p.x, p.y, p.size);
      this.particleGraphic.fill({
        color: this.theme === 'dark' ? 0xff007f : p.color,
        alpha: Math.max(0.1, currentAlpha)
      });
    }
  }

  /**
   * Renders ascending buoyant bubbles
   */
  private renderBubbles(deltaTime: number): void {
    this.bubbleGraphic.clear();

    const dt = Math.min(deltaTime * 0.06, 2.0);

    for (const b of this.bubbles) {
      b.wobblePhase += b.wobbleSpeed * dt * 5;
      const wobbleX = Math.sin(b.wobblePhase) * b.wobbleAmp;

      b.x += wobbleX * dt;
      b.y += b.vy * dt;

      // Pop at surface and respawn from floor
      if (b.y < 30) {
        b.y = this.screenHeight + Math.random() * 40;
        b.x = Math.random() * this.screenWidth;
      }

      // Bubble outline
      this.bubbleGraphic.circle(b.x, b.y, b.radius);
      this.bubbleGraphic.fill({ color: 0x38bdf8, alpha: 0.18 });
      this.bubbleGraphic.stroke({ width: 1.2, color: 0xffffff, alpha: 0.55 });

      // Highlight glint
      this.bubbleGraphic.circle(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.25);
      this.bubbleGraphic.fill({ color: 0xffffff, alpha: 0.75 });
    }
  }
}
