import { Application, Container } from 'pixi.js';

export type GameTheme = 'light' | 'dark';

export class ThemeManager {
  private app: Application;
  private currentTheme: GameTheme = 'light';
  private backgroundContainer: Container;

  constructor(app: Application) {
    this.app = app;
    this.backgroundContainer = new Container();
    this.app.stage.addChildAt(this.backgroundContainer, 0);

  }

  public async setTheme(theme: GameTheme): Promise<void> {
    this.currentTheme = theme;

    if (theme === 'dark') {
      if (this.app.renderer) {
        // Abyssal void — near-black with green-black undertone
        this.app.renderer.background.color = 0x03040a;
      }
      // Dark mode is rendered natively by each system.
      // Do not apply a global color filter: fish, particles, boss FX,
      // and UI each own their Light/Dark palette.
      this.app.stage.filters = [];

    } else {
      if (this.app.renderer) {
        this.app.renderer.background.color = 0x062c3d;
      }
      this.app.stage.filters = [];
    }
  }

  public getTheme(): GameTheme {
    return this.currentTheme;
  }
}
