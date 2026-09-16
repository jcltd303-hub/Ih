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

/** Authored Tetra cutout, assembled as a small articulated swimming puppet. */
export class Tetra extends Container {
  private static prepared: DetailedBossTextures | null = null;
  private readonly bodyRoot = new Container();
  private readonly torsoMain = new Container();
  private readonly headGroup = new Container();
  private readonly jaw = new Container();
  private readonly organCavity = new Container();
  private readonly tailAssembly = new Container();
  private readonly pectoralFinLeft = new Container();
  private sTorsoMain!: Sprite; private sHeadJaw!: Sprite; private sEyeballLarge!: Sprite;
  private sEyeballSmall!: Sprite; private sBrainOrgans!: Sprite; private sVisceraSpine!: Sprite;
  private sPectoralFin!: Sprite; private sDorsalFin!: Sprite; private sTailFin!: Sprite;
  private hp: number; private maxHp: number; private elapsed = 0; private facingSign = 1; private theme: Theme;
  public static readonly assetUrl = new URL('../../assets/images/tetra.png', import.meta.url).href;

  public static async prepare(): Promise<void> {
    if (this.prepared) return;
    const source = await Assets.load(this.assetUrl) as Texture;
    this.prepared = this.sliceSheet(source);
  }
  public static create(maxHp: number, theme: Theme): Tetra {
    if (!this.prepared) throw new Error('[Tetra] tetra.png was not prepared by AssetLoader');
    return new Tetra(this.prepared, maxHp, theme);
  }
  private static sliceSheet(sheet: Texture): DetailedBossTextures {
    const w = sheet.width, h = sheet.height, cw = Math.floor(w / 3), ch = Math.floor(h / 3);
    if (w < 3 || h < 3) throw new Error('[Tetra] tetra.png is too small to slice');
    const crop = (col: number, row: number): Texture => new Texture({ source: sheet.source, frame: new Rectangle(col * cw, row * ch, col === 2 ? w - col * cw : cw, row === 2 ? h - row * ch : ch) });
    return { torsoMain: crop(1,1), headJaw: crop(0,1), eyeballLarge: crop(0,0), eyeballSmall: crop(1,0), brainOrgans: crop(2,0), visceraSpine: crop(2,1), pectoralFin: crop(0,2), dorsalFin: crop(1,2), tailFin: crop(2,2) };
  }
  constructor(textures: DetailedBossTextures, maxHp: number, theme: Theme) {
    super(); this.maxHp = Math.max(1,maxHp); this.hp=this.maxHp; this.theme=theme; this.buildRig(textures); this.setTheme(theme);
  }
  private buildRig(tex: DetailedBossTextures): void {
    this.sTorsoMain=new Sprite(tex.torsoMain); this.sTorsoMain.anchor.set(.5);
    this.sHeadJaw=new Sprite(tex.headJaw); this.sHeadJaw.anchor.set(.8,.4);
    this.sEyeballLarge=new Sprite(tex.eyeballLarge); this.sEyeballLarge.anchor.set(.5);
    this.sEyeballSmall=new Sprite(tex.eyeballSmall); this.sEyeballSmall.anchor.set(.5);
    this.sBrainOrgans=new Sprite(tex.brainOrgans); this.sBrainOrgans.anchor.set(.5);
    this.sVisceraSpine=new Sprite(tex.visceraSpine); this.sVisceraSpine.anchor.set(.1,.5);
    this.sPectoralFin=new Sprite(tex.pectoralFin); this.sPectoralFin.anchor.set(.2,.2);
    this.sDorsalFin=new Sprite(tex.dorsalFin); this.sDorsalFin.anchor.set(.5,1);
    this.sTailFin=new Sprite(tex.tailFin); this.sTailFin.anchor.set(.1,.5);
    this.addChild(this.bodyRoot); this.bodyRoot.addChild(this.torsoMain); this.torsoMain.addChild(this.sTorsoMain);
    this.torsoMain.addChild(this.sDorsalFin); this.torsoMain.addChild(this.headGroup); this.headGroup.addChild(this.sHeadJaw);
    this.headGroup.addChild(this.sEyeballLarge); this.headGroup.addChild(this.sEyeballSmall); this.torsoMain.addChild(this.organCavity);
    this.organCavity.addChild(this.sBrainOrgans); this.torsoMain.addChild(this.pectoralFinLeft); this.pectoralFinLeft.addChild(this.sPectoralFin);
    this.torsoMain.addChild(this.sVisceraSpine); this.torsoMain.addChild(this.tailAssembly); this.tailAssembly.addChild(this.sTailFin);
    this.headGroup.position.set(-48,-8); this.sEyeballLarge.position.set(-18,-10); this.sEyeballSmall.position.set(8,-6);
    this.organCavity.position.set(8,-2); this.sDorsalFin.position.set(-12,-30); this.pectoralFinLeft.position.set(5,12);
    this.sVisceraSpine.position.set(35,4); this.tailAssembly.position.set(48,-2);
    // Fish.ts already sizes the gameplay entity; the authored art must fit that footprint.
    this.bodyRoot.scale.set(0.16);
  }
  public setTheme(theme: Theme): void {
    this.theme=theme; const tint=theme==='dark'?0xe8f7ff:0xffffff;
    for(const sprite of [this.sTorsoMain,this.sHeadJaw,this.sEyeballLarge,this.sEyeballSmall,this.sBrainOrgans,this.sVisceraSpine,this.sPectoralFin,this.sDorsalFin,this.sTailFin]) sprite.tint=tint;
  }
  public setFacing(facing:'left'|'right'): void { this.facingSign=facing==='left'?-1:1; this.bodyRoot.scale.x=0.16*this.facingSign; }
  public applyTheme(theme: Theme): void { this.setTheme(theme); }
  public update(dtScale=1,vx=1): void {
    this.elapsed += Math.max(0,dtScale)/60;
    if(vx<-.05)this.setFacing('left'); else if(vx>.05)this.setFacing('right');
    const phase=this.elapsed*7;
    const swim=Math.sin(phase), swim2=Math.sin(phase+0.9);
    this.torsoMain.rotation=swim*0.025;
    this.torsoMain.scale.y=1+swim2*0.035;
    this.headGroup.rotation=swim*0.035;
    this.jaw.rotation=0.08+Math.sin(phase*1.7)*0.07;
    this.tailAssembly.rotation=swim*0.20;
    this.sTailFin.rotation=swim2*0.12;
    this.pectoralFinLeft.rotation=0.18+Math.sin(phase*1.15)*0.20;
    this.sDorsalFin.rotation=swim*0.08;
    this.organCavity.rotation=Math.sin(phase*0.8)*0.015;
    this.sBrainOrgans.scale.set(1+Math.sin(phase*1.3)*0.035);
  }
  public takeDamage(damage:number):boolean { this.hp=Math.max(0,this.hp-Math.max(0,damage)); const p=this.maxHp?1-this.hp/this.maxHp:1; this.setBiteProgress(p); this.sBrainOrgans.visible=p>.55; return this.hp<=0; }
  public setBiteProgress(progress:number):void { const p=Math.max(0,Math.min(1,progress)); this.jaw.rotation=.08+p*.5; this.torsoMain.position.x=-p*4; }
  public destroy(options?:{children?:boolean;texture?:boolean;baseTexture?:boolean}):void { super.destroy({children:options?.children??true}); }
}
