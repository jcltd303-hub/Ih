import { Application, Container } from 'pixi.js';
import { GameEventBus } from '../core/GameEvents';
import { SoundManager } from '../../audio/SoundManager';

export type GameTheme = 'light' | 'dark';

export interface ThemeConfig {
  id: GameTheme;
  name: string;
  waterColor: number;
  waterHex: string;
  hudBg: string;
  hudBorder: string;
  primaryAccent: string;
  secondaryAccent: string;
  dangerAccent: string;
  goldAccent: string;
  textColor: string;
  textMuted: string;
  particleColors: number[];
  fishPaletteStyle: 'tropical_vibrant' | 'bioluminescent_abyss';
  soundscapeStyle: 'sunlit_arcade' | 'deepsea_sonar';
}

export const THEME_CONFIGS: Record<GameTheme, ThemeConfig> = {
  light: {
    id: 'light',
    name: 'Sunlit Tropical Arcade',
    waterColor: 0x064e6b,
    waterHex: '#064e6b',
    hudBg: '#091522',
    hudBorder: '#38bdf8',
    primaryAccent: '#0ea5e9',
    secondaryAccent: '#f59e0b',
    dangerAccent: '#ef4444',
    goldAccent: '#fbbf24',
    textColor: '#f8fafc',
    textMuted: '#94a3b8',
    particleColors: [0x38bdf8, 0xfacc15, 0x34d399, 0xffffff],
    fishPaletteStyle: 'tropical_vibrant',
    soundscapeStyle: 'sunlit_arcade'
  },
  dark: {
    id: 'dark',
    name: 'Deep-Sea Combat Abyss',
    waterColor: 0x020617,
    waterHex: '#020617',
    hudBg: '#030712',
    hudBorder: '#d946ef',
    primaryAccent: '#22d3ee',
    secondaryAccent: '#a855f7',
    dangerAccent: '#dc2626',
    goldAccent: '#f59e0b',
    textColor: '#f1f5f9',
    textMuted: '#64748b',
    particleColors: [0x22d3ee, 0xd946ef, 0xef4444, 0x10b981],
    fishPaletteStyle: 'bioluminescent_abyss',
    soundscapeStyle: 'deepsea_sonar'
  }
};

export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private app: Application;
  private currentTheme: GameTheme = 'light';
  private backgroundContainer: Container;

  constructor(app: Application) {
    ThemeManager.instance = this;
    this.app = app;
    this.backgroundContainer = new Container();
    this.app.stage.addChildAt(this.backgroundContainer, 0);

    let saved: string | null = null;
    try {
      saved = localStorage.getItem('fish_frenzy_theme');
    } catch {
      // ignore
    }
    if (saved === 'dark' || saved === 'light') {
      this.currentTheme = saved;
    }

    // Apply the persisted theme immediately so DOM HUD/modals and Pixi
    // background never spend a frame in the wrong visual language.
    this.applyDomTheme(this.currentTheme);
    this.applyRendererTheme(this.currentTheme);
    SoundManager.setTheme(this.currentTheme);
  }

  public static getInstance(): ThemeManager | null {
    return ThemeManager.instance;
  }

  public async setTheme(theme: GameTheme): Promise<void> {
    this.currentTheme = theme;
    try {
      localStorage.setItem('fish_frenzy_theme', theme);
    } catch {
      // ignore
    }

    this.applyDomTheme(theme);
    this.applyRendererTheme(theme);

    // One authoritative theme transition: audio follows the same state as
    // the renderer and DOM instead of being driven by individual widgets.
    SoundManager.setTheme(theme);

    GameEventBus.getInstance().emit('THEME_CHANGED', THEME_CONFIGS[theme]);
  }

  private applyDomTheme(theme: GameTheme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.ffTheme = theme;
    document.body?.setAttribute('data-ff-theme', theme);
  }

  private applyRendererTheme(theme: GameTheme): void {
    const cfg = THEME_CONFIGS[theme];
    if (this.app.renderer) {
      this.app.renderer.background.color = cfg.waterColor;
    }
    this.app.stage.filters = [];
  }

  public getTheme(): GameTheme {
    return this.currentTheme;
  }

  public getConfig(): ThemeConfig {
    return THEME_CONFIGS[this.currentTheme];
  }
}
