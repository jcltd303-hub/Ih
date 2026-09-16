import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

export interface DetailedBossTextures {
  torsoMain: Texture;
  headJaw: Texture;
  eyeballLarge: Texture;
  eyeballSmall: Texture;
  brainOrgans: Texture;
  visceraSpine: Texture;
  pectoralFin: Texture;
  dorsalFin: Texture;
  tailFin: Texture;
}

type Theme = 'light' | 'dark';

/**
 * Tetra is the authored boss cutout. The source PNG is treated as a 3x3
 * parts sheet, never as one giant sprite. Each part becomes its own texture
 * and is mounted on a small articulated puppet rig.
 */
export class Tetra extends Container {
  private static prepared: DetailedBossTextures | null = null;

  private readonly bodyRoot = new Container();
  private readonly torsoMain = new Container();
  private readonly headGroup = new Container();
  private readonly jaw = new Container();
  private readonly organCavity = new Container();
  private readonly tailAssembly = new Container();
  private readonly pectoralFinLeft = new Container();

  private sTorsoMain!: Sprite;
  private sHeadJaw!: Sprite;
  private sEyeballLarge!: Sprite;
  private sEyeballSmall!: Sprite;
  private sBrainOrgans!: Sprite;
  private sVisceraSpine!: Sprite;
  private sPectoralFin!: Sprite;
  private sDorsalFin!: Sprite;
  private sTailFin!: Sprite;

  private hp: number;
  private maxHp: number;
  private elapsed = 0;
  private facingSign = 1;
  private theme: Theme;

  public static readonly assetUrl = new URL('../../assets/images/tetra.png', import.meta.url).href;

  /** Pre-slice the authored sheet while the normal asset-loading phase is running. */
  public static async prepare(): Promise<void> {
    if (this.prepared) return;
    const source = await Assets.load(this.assetUrl) as Texture;
    this.prepared = this.sliceSheet(source);
  }

  public static create(maxHp: number, theme: Theme): Tetra {
    if (!this.prepared) {
      throw new Error('[Tetra] tetra.png was not prepared by AssetLoader');
    }
    return new Tetra(this.prepared, maxHp, theme);
  }

  private static sliceSheet(sheet: Texture): DetailedBossTextures {
    const w = sheet.width;
    const h = sheet.height;
    if (w < 3 || h < 3) throw new Error('[Tetra] tetra.png is too small to slice');

    // The authored file is a nine-part cutout sheet. Keep each source region
    // as an independent Pixi texture so the rig can articulate it without
    // ever rendering the full sheet rectangle.
    const cw = Math.floor(w / 3);
    const ch = Math.floor(h / 3);
    const crop = (col: number, row: number): Texture => new Texture({
      source: sheet.source,
      frame: new Rectangle(col * cw, row * ch, col === 2 ? w - col * cw : cw, row === 2 ? h - row * ch : ch)
    });

    return {
      torsoMain: crop(1, 1),
      headJaw: crop(0, 1),
      eyeballLarge: crop(0, 0),
      eyeballSmall: crop(1, 0),
      brainOrgans: crop(2, 0),
      visceraSpine: crop(2, 1),
      pectoralFin: crop(0, 2),
      dorsalFin: crop(1, 2),
      tailFin: crop(2, 2)
    };
  }

  constructor(textures: DetailedBossTextures, maxHp: number, theme: Theme) {
    super();
    this.maxHp = Math.max(1, maxHp);
    this.hp = this.maxHp;
    this.theme = theme;
    this.buildRig(textures);
    this.setTheme(theme);
  }

  private buildRig(tex: DetailedBossTextures): void {
    this.sTorsoMain = new Sprite(tex.torsoMain);
    this.sTorsoMain.anchor.set(0.5);

    this.sHeadJaw = new Sprite(tex.headJaw);
    this.sHeadJaw.anchor.set(0.8, 0.4);

    this.sEyeballLarge = new Sprite(tex.eyeballLarge);
    this.sEyeballLarge.anchor.set(0.5);
    this.sEyeballSmall = new Sprite(tex.eyeballSmall);
    this.sEyeballSmall.anchor.set(0.5);

    this.sBrainOrgans = new Sprite(tex.brainOrgans);
    this.sBrainOrgans.anchor.set(0.5);

    this.sVisceraSpine = new Sprite(tex.visceraSpine);
    this.sVisceraSpine.anchor.set(0.1, 0.5);

    this.sPectoralFin = new Sprite(tex.pectoralFin);
    this.sPectoralFin.anchor.set(0.2, 0.2);

    this.sDorsalFin = new Sprite(tex.dorsalFin);
    this.sDorsalFin.anchor.set(0.5, 1);

    this.sTailFin = new Sprite(tex.tailFin);
    this.sTailFin.anchor.set(0.1, 0.5);

    this.addChild(this.bodyRoot);
    this.bodyRoot.addChild(this.torsoMain);
    this.torsoMain.addChild(this.sTorsoMain);
    this.torsoMain.addChild(this.sDorsalFin);
    this.torsoMain.addChild(this.headGroup);
    this.headGroup.addChild(this.sHeadJaw);
    this.headGroup.addChild(this.sEyeballLarge);
    this.headGroup.addChild(this.sEyeballSmall);
    this.torsoMain.addChild(this.organCavity);
    this.organCavity.addChild(this.sBrainOrgans);
    this.torsoMain.addChild(this.pectoralFinLeft);
    this.pectoralFinLeft.addChild(this.sPectoralFin);
    this.torsoMain.addChild(this.sVisceraSpine);
    this.torsoMain.addChild(this.tailAssembly);
    this.tailAssembly.addChild(this.sTailFin);

    // Joint layout follows the authored cutout puppet design.
    this.bodyRoot.position.set(0, 0);
    this.headGroup.position.set(-180, -40);
    this.sEyeballLarge.position.set(-65, -35);
    this.sEyeballSmall.position.set(25, -20);
    this.organCavity.position.set(20, -10);
    this.sDorsalFin.position.set(-50, -140);
    this.pectoralFinLeft.position.set(10, 50);
    this.sVisceraSpine.position.set(140, 20);
    this.tailAssembly.position.set(220, -10);

    this.bodyRoot.scale.set(0.9);
  }

  public setTheme(theme: Theme): void {
    this.theme = theme;
    // Preserve authored colors in light mode; dark mode adds a restrained
    // cool treatment so the same rig reads clearly against deep-sea scenery.
    const tint = theme === 'dark' ? 0xe8f7ff : 0xffffff;
    for (const sprite of [
      this.sTorsoMain, this.sHeadJaw, this.sEyeballLarge, this.sEyeballSmall,
      this.sBrainOrgans, this.sVisceraSpine, this.sPectoralFin, this.sDorsalFin, this.sTailFin
    ]) sprite.tint = tint;
  }

  public update(dtScale = 1, vx = 1): void {
    this.elapsed += Math.max(0, dtScale) / 60;
    this.facingSign = vx < -0.05 ? -1 : vx > 0.05 ? 1 : this.facingSign;
    this.bodyRoot.scale.x = 0.9 * this.facingSign;

    const breath = Math.sin(this.elapsed * 3.5) * 0.015;
    this.torsoMain.scale.set(1 + breath, 1 + breath);
    this.jaw.rotation = Math.sin(this.elapsed * 2) * 0.04;
    this.tailAssembly.rotation = Math.sin(this.elapsed * 3) * 0.07;
    this.pectoralFinLeft.rotation = 0.2 + Math.sin(this.elapsed * 4) * 0.1;
    this.sBrainOrgans.scale.set(1 + Math.sin(this.elapsed * 5) * 0.03);
  }

  public takeDamage(damage: number): boolean {
    this.hp = Math.max(0, this.hp - Math.max(0, damage));
    const progress = this.maxHp > 0 ? 1 - this.hp / this.maxHp : 1;
    this.setBiteProgress(progress);
    this.sBrainOrgans.visible = progress > 0.55;
    return this.hp <= 0;
  }

  public setBiteProgress(progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    this.jaw.rotation = -0.1 + p * 0.5;
    this.torsoMain.position.x = -30 - p * 25;
  }

  public destroy(options?: { children?: boolean; texture?: boolean; baseTexture?: boolean }): void {
    super.destroy({ children: options?.children ?? true });
  }
}
