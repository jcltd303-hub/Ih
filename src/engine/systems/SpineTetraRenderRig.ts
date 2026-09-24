import { Assets, Container } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { IRenderRig } from './RenderRig';

type Theme = 'light' | 'dark';
type Hierarchy = 'NORMAL' | 'ELITE' | 'CRITICAL' | 'BOSS';

export class SpineTetraRenderRig implements IRenderRig {
  private static ready = false;
  private static preparing: Promise<void> | null = null;
  private static readonly skeletonAlias = 'tetra-spine-skeleton';
  private static readonly atlasAlias = 'tetra-spine-atlas';

  public readonly container = new Container();
  private readonly spine: Spine;
  private facingSign = 1;
  private shudderTimer: ReturnType<typeof setTimeout> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  private static assetUrl(path: string): string {
    const base = import.meta.env.BASE_URL || '/';
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  public static async prepare(): Promise<void> {
    if (this.ready) return;
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      Assets.add({ alias: this.skeletonAlias, src: this.assetUrl('spine/tetra/rig.json') });
      Assets.add({ alias: this.atlasAlias, src: this.assetUrl('spine/tetra/rig.atlas') });
      await Assets.load([this.skeletonAlias, this.atlasAlias]);
      this.ready = true;
      console.log('[SpineTetraRenderRig] Native Spine tetra assets loaded.');
    })();
    try {
      await this.preparing;
    } finally {
      this.preparing = null;
    }
  }

  public static isReady(): boolean {
    return this.ready;
  }

  constructor(theme: Theme = 'light') {
    if (!SpineTetraRenderRig.ready) {
      throw new Error('Spine tetra rig created before assets were prepared');
    }
    this.spine = Spine.from({
      skeleton: SpineTetraRenderRig.skeletonAlias,
      atlas: SpineTetraRenderRig.atlasAlias,
      autoUpdate: true
    });
    this.container.addChild(this.spine);
    this.setTheme(theme);
    this.playState('swim_right');
  }

  private animationNames(): string[] {
    return this.spine.skeleton.data.animations.map((animation) => animation.name);
  }

  private resolveAnimation(state: string): string | null {
    const names = this.animationNames();
    if (names.length === 0) return null;
    const normalized = state.toLowerCase();
    const tokens = normalized.split(/[_\s-]+/);
    const exact = names.find((name) => name.toLowerCase() === normalized);
    if (exact) return exact;
    const allTokens = names.find((name) => {
      const lower = name.toLowerCase();
      return tokens.every((token) => lower.includes(token));
    });
    if (allTokens) return allTokens;
    const swim = names.find((name) => /swim|idle|loop/i.test(name));
    return swim ?? names[0];
  }

  setTheme(_theme: Theme): void {
    // Preserve authored Spine colors. Theme lighting/post-processing is applied globally.
  }

  applyFlash(_color: number, durationSeconds: number): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.spine.alpha = 0.45;
    this.flashTimer = setTimeout(() => {
      if (!this.spine.destroyed) this.spine.alpha = 1;
      this.flashTimer = null;
    }, Math.max(0, durationSeconds) * 1000);
  }

  applyShudder(intensity: number, durationSeconds: number): void {
    if (this.shudderTimer) clearTimeout(this.shudderTimer);
    const startX = this.spine.x;
    const startY = this.spine.y;
    const interval = setInterval(() => {
      if (this.spine.destroyed) return;
      this.spine.position.set(
        startX + (Math.random() - 0.5) * intensity,
        startY + (Math.random() - 0.5) * intensity
      );
    }, 30);
    this.shudderTimer = setTimeout(() => {
      clearInterval(interval);
      if (!this.spine.destroyed) this.spine.position.set(startX, startY);
      this.shudderTimer = null;
    }, Math.max(0, durationSeconds) * 1000);
  }

  playState(state: string, onComplete?: () => void): void {
    const animation = this.resolveAnimation(state);
    if (!animation) {
      onComplete?.();
      return;
    }
    const turning = state.startsWith('turn_');
    const entry = this.spine.state.setAnimation(0, animation, !turning);
    if (turning && onComplete) {
      const listener = {
        complete: (completed: unknown) => {
          if (completed !== entry) return;
          this.spine.state.removeListener(listener);
          onComplete();
        }
      };
      this.spine.state.addListener(listener);
    }
    if (state.endsWith('_left')) this.facingSign = -1;
    if (state.endsWith('_right')) this.facingSign = 1;
    this.spine.scale.x = Math.abs(this.spine.scale.x || 1) * this.facingSign;
  }

  setMotion(speed: number, vy: number, panic: boolean): void {
    this.spine.state.timeScale = Math.max(0.35, Math.min(2.5, speed * (panic ? 1.5 : 1)));
    this.container.rotation = vy * 0.05;
  }

  setHierarchy(_hierarchy: Hierarchy): void {
    // Fish.resizeForViewport owns final size so hierarchy never compounds scale.
  }

  playHitReaction(_amount: number, _theme: Theme): void {
    this.applyFlash(0xffffff, 0.1);
  }

  destroy(): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.shudderTimer) clearTimeout(this.shudderTimer);
    if (!this.container.destroyed) this.container.destroy({ children: true });
  }
}
