import { Application, Container, ColorMatrixFilter } from 'pixi.js';

export type GameTheme = 'light' | 'dark';

export class ThemeManager {
  private app: Application;
  private currentTheme: GameTheme = 'light';
  private backgroundContainer: Container;
  private horrorFilter: ColorMatrixFilter;

  constructor(app: Application) {
    this.app = app;
    this.backgroundContainer = new Container();
    this.app.stage.addChildAt(this.backgroundContainer, 0);

    // Lovecraftian grade: crushed blacks, sickly greens, blood reds — not B&W
    this.horrorFilter = new ColorMatrixFilter();
  }

  public async setTheme(theme: GameTheme): Promise<void> {
    this.currentTheme = theme;

    if (theme === 'dark') {
      if (this.app.renderer) {
        // Abyssal void — near-black with green-black undertone
        this.app.renderer.background.color = 0x020508;
      }
      // Matrix tuned for eldritch horror (RGB bias toward bilious green + venous red)
      // R'  G'  B'  A'  offset
      this.horrorFilter.matrix = [
        0.55, 0.15, 0.10, 0, 0.02, // red channel — desaturated, slightly lifted mid
        0.05, 0.70, 0.12, 0, 0.00, // green — dominant sickly cast
        0.08, 0.20, 0.45, 0, 0.03, // blue — crushed, murky
        0, 0, 0, 1, 0,
      ];
      this.horrorFilter.brightness(0.82, false);
      this.horrorFilter.contrast(1.35, true);
      this.app.stage.filters = [this.horrorFilter];
    } else {
      if (this.app.renderer) {
        this.app.renderer.background.color = 0x0a3a5c;
      }
      this.app.stage.filters = [];
    }
  }

  public getTheme(): GameTheme {
    return this.currentTheme;
  }
}
