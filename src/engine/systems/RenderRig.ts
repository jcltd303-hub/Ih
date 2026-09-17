
import { Container } from 'pixi.js';

export interface IRenderRig {
  // Standardized visual state management
  setTheme(theme: 'light' | 'dark'): void;
  applyFlash(color: number, duration: number): void;
  applyShudder(intensity: number, duration: number): void;
  playState(state: string, onComplete?: () => void): void;
  destroy(): void;
  // Unified container reference
  container: Container;

  // New arcade responsiveness methods
  setMotion(speed: number, vy: number, panic: boolean): void;
  setHierarchy(hierarchy: 'NORMAL' | 'ELITE' | 'CRITICAL' | 'BOSS'): void;
  playHitReaction(amount: number, theme: 'light' | 'dark'): void;
}
