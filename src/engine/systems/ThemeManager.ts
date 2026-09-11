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

    // Setup horror color grading filter for Dark Mode
    this.horrorFilter = new ColorMatrixFilter();
    this.horrorFilter.contrast(1.4, false);
    this.horrorFilter.sepia(false);
  }

  public async setTheme(theme: GameTheme): Promise<void> {
    this.currentTheme = theme;

    if (theme === 'dark') {
      // Apply horror Abyssal/Rust styling
      if (this.app.renderer) {
        this.app.renderer.background.color = 0x05050a;
      }
      this.app.stage.filters = [this.horrorFilter];
    } else {
      // Apply Can-Tech Metallic/Fun styling
      if (this.app.renderer) {
        this.app.renderer.background.color = 0x08182b;
      }
      this.app.stage.filters = [];
    }
  }

  public getTheme(): GameTheme {
    return this.currentTheme;
  }
}
