import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { SoundManager } from '../../audio/SoundManager';
import { BossRaidManager } from './BossRaidManager';

/**
 * Procedural Master Artwork Cache for the Apex Leviathan Boss
 * Generates crisp, high-DPI vector/canvas textures with anti-aliasing and zero pixelation.
 */
class BossTextureCache {
  private static instance: BossTextureCache;
  private cache: Map<string, Texture> = new Map();

  public static getInstance(): BossTextureCache {
    if (!BossTextureCache.instance) BossTextureCache.instance = new BossTextureCache();
    return BossTextureCache.instance;
  }

  private makeTexture(key: string, generator: () => HTMLCanvasElement): Texture {
    if (!this.cache.has(key)) this.cache.set(key, Texture.from(generator()));
    return this.cache.get(key)!;
  }

  private canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    return [c, ctx];
  }

  public getHeadTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    return this.makeTexture(`head_${theme}_${enraged}`, () => {
      const [canvas, ctx] = this.canvas(220, 160);
      const w = canvas.width, h = canvas.height;
      ctx.translate(w * 0.52, h * 0.52);
      ctx.shadowBlur = 18;
      ctx.shadowColor = enraged ? 'rgba(239,68,68,.55)' : 'rgba(34,211,238,.22)';
      const body = ctx.createLinearGradient(-70, -20, 75, 55);
      body.addColorStop(0, theme === 'dark' ? '#020617' : '#082f49');
      body.addColorStop(0.55, enraged ? '#7f1d1d' : theme === 'dark' ? '#1e293b' : '#0f766e');
      body.addColorStop(1, enraged ? '#f97316' : '#38bdf8');
      ctx.beginPath();
      ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-28, -58, 55, -40);
      ctx.quadraticCurveTo(86, -12, 66, 22); ctx.quadraticCurveTo(50, 66, -10, 54);
      ctx.quadraticCurveTo(-68, 42, -70, 0);
      ctx.fillStyle = body; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = enraged ? '#facc15' : '#cbd5e1'; ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(-0.22 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(-10 + i * 9, -20); ctx.lineTo(55 + i * 6, -54 - i * 2); ctx.lineTo(22 + i * 4, -10);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? (enraged ? '#991b1b' : '#0ea5e9') : (theme === 'dark' ? '#334155' : '#7dd3fc');
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(-12, 4, 11, 9, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#020617'; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(22, 4, 11, 9, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#020617'; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-8, 0, 3.3, 3.3, 0, 0, Math.PI * 2);
      ctx.ellipse(26, 0, 3.3, 3.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = enraged ? '#fb7185' : '#67e8f9'; ctx.fill();
      return canvas;
    });
  }

  public getJawTexture(theme: 'light' | 'dark', enraged: boolean): Texture { return this.getHeadTexture(theme, enraged); }
  public getCarapaceTexture(index: number, theme: 'light' | 'dark', enraged: boolean): Texture {
    return this.makeTexture(`car_${index}_${theme}_${enraged}`, () => {
      const [canvas, ctx] = this.canvas(200, 120);
      const w=canvas.width,h=canvas.height;
      ctx.translate(w/2,h/2);
      const g=ctx.createLinearGradient(-60,-40,70,48);
      g.addColorStop(0, theme==='dark' ? '#020617' : '#082f49');
      g.addColorStop(1, enraged ? '#7f1d1d' : (theme==='dark' ? '#111827' : '#0f766e'));
      ctx.beginPath(); ctx.moveTo(-70,0); ctx.quadraticCurveTo(-30,-45,48,-32); ctx.quadraticCurveTo(74,-10,60,20); ctx.quadraticCurveTo(28,52,-28,40); ctx.quadraticCurveTo(-70,28,-70,0);
      ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle=enraged ? '#f87171' : '#38bdf8'; ctx.lineWidth=2; ctx.stroke();
      for(let i=0;i<5;i++){ctx.beginPath(); ctx.moveTo(-45+i*15,-18+i*2); ctx.lineTo(-30+i*15,18-i*1); ctx.strokeStyle='rgba(255,255,255,.16)'; ctx.stroke();}
      return canvas;
    });
  }
  public getDorsalWingTexture(theme: 'light' | 'dark', enraged: boolean): Texture { return this.getCarapaceTexture(99, theme, enraged); }
  public getTailFlukeTexture(theme: 'light' | 'dark', enraged: boolean): Texture {
    return this.makeTexture(`tail_${theme}_${enraged}`, () => {
      const [canvas, ctx] = this.canvas(220, 160);
      ctx.translate(canvas.width*0.5, canvas.height*0.5);
      ctx.beginPath();
      ctx.moveTo(-64,0); ctx.quadraticCurveTo(-8,-72,42,-18); ctx.quadraticCurveTo(74,14,45,48); ctx.quadraticCurveTo(-4,88,-64,0);
      ctx.fillStyle = enraged ? '#7f1d1d' : (theme==='dark' ? '#111827' : '#0f766e'); ctx.fill();
      ctx.strokeStyle = enraged ? '#facc15' : '#22d3ee'; ctx.lineWidth=3; ctx.stroke();
      return canvas;
    });
  }
  public getReactorRingTexture(which: 'outer' | 'inner', theme: 'light' | 'dark'): Texture { return this.getCarapaceTexture(which==='outer'?1:2, theme, false); }
  public getReactorCoreTexture(theme: 'light' | 'dark', enraged: boolean): Texture { return this.getTailFlukeTexture(theme, enraged); }
  public getShieldHexTexture(theme: 'light' | 'dark'): Texture { return this.getTailFlukeTexture(theme, false); }
}

export class BossManager extends Container {
  private maxHp: number;
  private currentHp: number;
  private theme: 'light' | 'dark';
  private isEnraged = false;
  private spineContainer: Container;
  private headSprite: Sprite;
  private jawSprite: Sprite;
  private carapaceSprites: Sprite[] = [];
  private dorsalWingSprite: Sprite;
  private pelvicFinSprite: Sprite;
  private tailFlukeSprite: Sprite;
  private reactorContainer: Container;
  private reactorOuterRing: Sprite;
  private reactorInnerRing: Sprite;
  private reactorCoreSprite: Sprite;
  private shieldSprite: Sprite;
  private hudContainer: Container;
  private hudBg: Graphics;
  private hudHealthPips: Graphics;
  private bossTitleText: Text;
  private hpPercentText: Text;
  private ambientGlow: Graphics;

  constructor(maxHp: number = 28, initialTheme: 'light' | 'dark' = 'light') {
    super();
    this.maxHp = maxHp; this.currentHp = maxHp; this.theme = initialTheme;
    const textures = BossTextureCache.getInstance();
    this.ambientGlow = new Graphics(); this.renderAmbientGlow(); this.addChild(this.ambientGlow);
    this.spineContainer = new Container(); this.addChild(this.spineContainer);
    this.tailFlukeSprite = new Sprite(textures.getTailFlukeTexture(this.theme, false)); this.tailFlukeSprite.anchor.set(0.08,0.5); this.tailFlukeSprite.scale.set(1.1); this.spineContainer.addChild(this.tailFlukeSprite);
    for (let i = 4; i >= 0; i--) { const seg = new Sprite(textures.getCarapaceTexture(i, this.theme, false)); seg.anchor.set(0.5); this.carapaceSprites[i] = seg; this.spineContainer.addChild(seg); }
    this.dorsalWingSprite = new Sprite(textures.getDorsalWingTexture(this.theme, false)); this.dorsalWingSprite.anchor.set(0.12,0.86); this.dorsalWingSprite.x=-18; this.dorsalWingSprite.y=-18; this.spineContainer.addChild(this.dorsalWingSprite);
    this.pelvicFinSprite = new Sprite(textures.getDorsalWingTexture(this.theme, false)); this.pelvicFinSprite.anchor.set(0.12,0.14); this.pelvicFinSprite.scale.y=-0.62; this.pelvicFinSprite.scale.x=0.72; this.pelvicFinSprite.x=-22; this.pelvicFinSprite.y=18; this.spineContainer.addChild(this.pelvicFinSprite);
    this.reactorContainer = new Container(); this.reactorContainer.x=-10; this.reactorContainer.y=-2;
    this.reactorOuterRing = new Sprite(textures.getReactorRingTexture('outer', this.theme)); this.reactorOuterRing.anchor.set(0.5); this.reactorContainer.addChild(this.reactorOuterRing);
    this.reactorInnerRing = new Sprite(textures.getReactorRingTexture('inner', this.theme)); this.reactorInnerRing.anchor.set(0.5); this.reactorContainer.addChild(this.reactorInnerRing);
    this.reactorCoreSprite = new Sprite(textures.getReactorCoreTexture(this.theme, false)); this.reactorCoreSprite.anchor.set(0.5); this.reactorContainer.addChild(this.reactorCoreSprite);
    this.spineContainer.addChild(this.reactorContainer);
    this.headSprite = new Sprite(textures.getHeadTexture(this.theme, false)); this.headSprite.anchor.set(0.55,0.5); this.headSprite.x=50; this.headSprite.y=0; this.spineContainer.addChild(this.headSprite);
    this.jawSprite = new Sprite(textures.getJawTexture(this.theme, false)); this.jawSprite.anchor.set(0.38,0.2); this.jawSprite.x=58; this.jawSprite.y=22; this.spineContainer.addChild(this.jawSprite);
    this.shieldSprite = new Sprite(textures.getShieldHexTexture(this.theme)); this.shieldSprite.visible=false; this.shieldSprite.alpha=0; this.addChild(this.shieldSprite);
    this.hudContainer = new Container(); this.hudContainer.y=-98; this.addChild(this.hudContainer);
    this.hudBg = new Graphics(); this.renderHudBackground(); this.hudContainer.addChild(this.hudBg);
    this.hudHealthPips = new Graphics(); this.updateHealthBar(); this.hudContainer.addChild(this.hudHealthPips);
    const titleStyle = new TextStyle({ fontFamily: '"Space Grotesk", "Orbitron", monospace, sans-serif', fontSize: 12, fontWeight: 'bold', fill: this.theme === 'light' ? 0x00f0ff : 0xff4fd8, dropShadow: { color: 0x000000, blur: 4, distance: 1 } });
    this.bossTitleText = new Text({ text: '', style: titleStyle }); this.bossTitleText.anchor.set(0.5, 1); this.bossTitleText.y=-10; this.hudContainer.addChild(this.bossTitleText);
    const percentStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: 0xffffff });
    this.hpPercentText = new Text({ text: '100%', style: percentStyle }); this.hpPercentText.anchor.set(0.5, 0); this.hpPercentText.y=8; this.hudContainer.addChild(this.hpPercentText);
    this.hudContainer.visible = false;
  }

  private renderAmbientGlow(): void {
    this.ambientGlow.clear();
    this.ambientGlow.ellipse(-10, 0, 160, 74);
    this.ambientGlow.fill({ color: this.theme === 'dark' ? 0x4c1d95 : 0x0ea5e9, alpha: this.isEnraged ? 0.18 : 0.12 });
    this.ambientGlow.stroke({ width: 2, color: this.isEnraged ? 0xf43f5e : 0x22d3ee, alpha: 0.45 });
  }

  private renderHudBackground(): void {
    this.hudBg.clear();
    this.hudBg.roundRect(-84, -20, 170, 34, 10);
    this.hudBg.fill({ color: this.theme === 'dark' ? 0x020617 : 0x091522, alpha: 0.92 });
    this.hudBg.stroke({ width: 1.5, color: this.isEnraged ? 0xf43f5e : (this.theme === 'dark' ? 0xd946ef : 0x38bdf8), alpha: 0.8 });
  }

  private updateHealthBar(): void {
    const pct = Math.max(0, this.currentHp / this.maxHp);
    this.hudHealthPips.clear();
    this.hudHealthPips.roundRect(-76, -10, 152, 12, 6);
    this.hudHealthPips.fill({ color: 0x111827, alpha: 0.9 });
    this.hudHealthPips.roundRect(-75, -9, 150 * pct, 10, 5);
    this.hudHealthPips.fill({ color: this.isEnraged ? 0xef4444 : 0x22d3ee, alpha: 0.95 });
    this.hpPercentText.text = `${Math.ceil(pct * 100)}%`;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    const textures = BossTextureCache.getInstance();
    this.headSprite.texture = textures.getHeadTexture(this.theme, this.isEnraged);
    this.jawSprite.texture = textures.getJawTexture(this.theme, this.isEnraged);
    for (let i = 0; i < 5; i++) this.carapaceSprites[i].texture = textures.getCarapaceTexture(i, this.theme, this.isEnraged);
    this.dorsalWingSprite.texture = textures.getDorsalWingTexture(this.theme, this.isEnraged);
    this.pelvicFinSprite.texture = textures.getDorsalWingTexture(this.theme, this.isEnraged);
    this.tailFlukeSprite.texture = textures.getTailFlukeTexture(this.theme, this.isEnraged);
    this.reactorOuterRing.texture = textures.getReactorRingTexture('outer', this.theme);
    this.reactorInnerRing.texture = textures.getReactorRingTexture('inner', this.theme);
    this.reactorCoreSprite.texture = textures.getReactorCoreTexture(this.theme, this.isEnraged);
    this.shieldSprite.texture = textures.getShieldHexTexture(this.theme);
    this.renderAmbientGlow();
    this.renderHudBackground();
    this.updateHealthBar();
  }

  public update(dtScale: number = 1.0, vx: number = 1.0, vy: number = 0.0): void {
    const textures = BossTextureCache.getInstance();
    const pulse = Math.max(0, this.currentHp / this.maxHp);
    this.isEnraged = pulse < 0.35;
    this.headSprite.texture = textures.getHeadTexture(this.theme, this.isEnraged);
    this.jawSprite.texture = textures.getJawTexture(this.theme, this.isEnraged);
    for (let i = 0; i < 5; i++) this.carapaceSprites[i].texture = textures.getCarapaceTexture(i, this.theme, this.isEnraged);
    this.dorsalWingSprite.texture = textures.getDorsalWingTexture(this.theme, this.isEnraged);
    this.pelvicFinSprite.texture = textures.getDorsalWingTexture(this.theme, this.isEnraged);
    this.tailFlukeSprite.texture = textures.getTailFlukeTexture(this.theme, this.isEnraged);
    this.reactorCoreSprite.texture = textures.getReactorCoreTexture(this.theme, this.isEnraged);
    this.hudContainer.visible = false;
    this.spineContainer.rotation = Math.sin(Date.now() * 0.0012) * 0.015;
    this.headSprite.rotation = Math.sin(Date.now() * 0.0018) * 0.04;
    this.tailFlukeSprite.rotation = Math.cos(Date.now() * 0.0015) * 0.08;
    this.reactorOuterRing.rotation += 0.03 * dtScale;
    this.reactorInnerRing.rotation -= 0.05 * dtScale;
    this.reactorCoreSprite.scale.set(1 + Math.sin(Date.now() * 0.0022) * (this.isEnraged ? 0.16 : 0.08));
    this.renderAmbientGlow();
    this.renderHudBackground();
    this.updateHealthBar();
  }
}
