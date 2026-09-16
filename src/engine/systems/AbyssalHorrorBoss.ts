import { Container, Graphics } from 'pixi.js';

const TOTAL_FRAMES = 60;

function ease(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function sample(keys: { frame: number; value: number }[], frame: number): number {
  const f = ((frame % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f >= a.frame && f <= b.frame) {
      const t = (f - a.frame) / Math.max(1, b.frame - a.frame);
      return a.value + (b.value - a.value) * ease(t);
    }
  }
  return keys[keys.length - 1]?.value ?? 0;
}

const BODY_Y = [{ frame: 0, value: 0 }, { frame: 15, value: 3.5 }, { frame: 30, value: 0 }, { frame: 45, value: -2 }, { frame: 60, value: 0 }];
const BODY_SY = [{ frame: 0, value: 1 }, { frame: 15, value: 1.03 }, { frame: 30, value: 1 }, { frame: 45, value: 0.98 }, { frame: 60, value: 1 }];
const BODY_SX = [{ frame: 0, value: 1 }, { frame: 15, value: 0.98 }, { frame: 30, value: 1 }, { frame: 45, value: 1.02 }, { frame: 60, value: 1 }];
const JAW = [{ frame: 0, value: 0 }, { frame: 20, value: 0.08 }, { frame: 40, value: -0.03 }, { frame: 60, value: 0 }];
const TENTACLE = [{ frame: 0, value: 0 }, { frame: 12, value: 0.105 }, { frame: 25, value: -0.07 }, { frame: 42, value: 0.052 }, { frame: 60, value: 0 }];
const FIN1 = [{ frame: 0, value: 0 }, { frame: 20, value: 0.035 }, { frame: 40, value: -0.017 }, { frame: 60, value: 0 }];
const FIN3 = [{ frame: 0, value: 0 }, { frame: 25, value: 0.07 }, { frame: 45, value: -0.044 }, { frame: 60, value: 0 }];
const FIN5 = [{ frame: 0, value: 0 }, { frame: 30, value: 0.113 }, { frame: 50, value: -0.07 }, { frame: 60, value: 0 }];
const TAIL = [{ frame: 0, value: 0 }, { frame: 18, value: -0.091 }, { frame: 38, value: 0.119 }, { frame: 60, value: 0 }];

export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public isEnraged = false;

  private art: Container;
  private body: Graphics;
  private jaw: Graphics;
  private tentacle: Graphics;
  private fins: Graphics[] = [];
  private tail: Graphics;
  private eye: Graphics;
  private glow: Graphics;
  private frame = 0;
  private facingSign = 1;

  constructor(maxHp = 28, initialTheme: 'light' | 'dark' = 'dark') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;

    this.glow = new Graphics();
    this.addChild(this.glow);
    this.art = new Container();
    this.addChild(this.art);

    this.tail = new Graphics();
    this.art.addChild(this.tail);
    for (let i = 0; i < 5; i++) {
      const fin = new Graphics();
      this.fins.push(fin);
      this.art.addChild(fin);
    }
    this.body = new Graphics();
    this.art.addChild(this.body);
    this.tentacle = new Graphics();
    this.art.addChild(this.tentacle);
    this.jaw = new Graphics();
    this.art.addChild(this.jaw);
    this.eye = new Graphics();
    this.art.addChild(this.eye);

    this.redraw();
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.redraw();
  }

  public takeDamage(damage: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - Math.max(0, damage));
    if (this.currentHp <= this.maxHp * 0.35) this.isEnraged = true;
    this.redraw();
    return this.currentHp <= 0;
  }

  public update(dtScale = 1, vx = 1, _vy = 0): void {
    if (Math.abs(vx) > 0.15) this.facingSign = vx > 0 ? 1 : -1;
    this.frame = (this.frame + dtScale * 1.8 * (this.isEnraged ? 1.35 : 1)) % TOTAL_FRAMES;

    this.art.y = sample(BODY_Y, this.frame);
    this.art.scale.x = this.facingSign * sample(BODY_SX, this.frame);
    this.art.scale.y = sample(BODY_SY, this.frame);
    this.jaw.rotation = sample(JAW, this.frame);
    this.tentacle.rotation = sample(TENTACLE, this.frame);
    this.tail.rotation = sample(TAIL, this.frame);
    this.fins[0].rotation = sample(FIN1, this.frame);
    this.fins[2].rotation = sample(FIN3, this.frame);
    this.fins[4].rotation = sample(FIN5, this.frame);
    this.fins[1].rotation = sample(FIN1, this.frame + 6);
    this.fins[3].rotation = sample(FIN3, this.frame + 6);

    const pulse = 0.9 + Math.sin(this.frame * Math.PI / 30) * 0.1;
    this.glow.alpha = this.isEnraged ? 0.9 : 0.65;
    this.glow.scale.set(pulse);
  }

  private redraw(): void {
    const dark = this.theme === 'dark';
    const body = dark ? 0x090b14 : 0x172033;
    const shell = dark ? 0x171225 : 0x26364a;
    const edge = this.isEnraged ? 0xff3b1f : dark ? 0xff5a2a : 0x38bdf8;
    const energy = this.isEnraged ? 0xffc928 : dark ? 0xd946ef : 0x22d3ee;

    this.glow.clear();
    this.glow.ellipse(0, 0, 145, 92).fill({ color: energy, alpha: 0.12 });
    this.glow.ellipse(0, 0, 112, 70).stroke({ color: edge, width: 3, alpha: 0.3 });

    this.body.clear();
    this.body.ellipse(0, 0, 86, 55).fill({ color: body });
    this.body.ellipse(0, 0, 86, 55).stroke({ color: edge, width: 3 });
    this.body.ellipse(-8, -5, 62, 37).fill({ color: shell, alpha: 0.95 });
    this.body.ellipse(-8, -5, 62, 37).stroke({ color: 0x64748b, width: 1.5, alpha: 0.65 });

    this.tail.clear();
    this.tail.moveTo(-65, 0).lineTo(-128, -34).quadraticCurveTo(-105, 0, -128, 34).closePath().fill({ color: shell });
    this.tail.moveTo(-65, 0).lineTo(-128, -34).quadraticCurveTo(-105, 0, -128, 34).closePath().stroke({ color: edge, width: 3 });

    for (let i = 0; i < this.fins.length; i++) {
      const f = this.fins[i];
      f.clear();
      const x = -48 + i * 23;
      f.moveTo(x, -38).lineTo(x + 13, -82 - (i % 2) * 8).lineTo(x + 27, -38).closePath();
      f.fill({ color: shell, alpha: 0.95 });
      f.stroke({ color: energy, width: 2, alpha: 0.9 });
    }

    this.tentacle.clear();
    this.tentacle.moveTo(42, 16).quadraticCurveTo(64, 30, 58, 48).quadraticCurveTo(54, 60, 69, 67);
    this.tentacle.stroke({ color: edge, width: 7, cap: 'round' });
    this.tentacle.moveTo(48, 18).quadraticCurveTo(69, 33, 62, 50).quadraticCurveTo(58, 62, 73, 69);
    this.tentacle.stroke({ color: energy, width: 2, cap: 'round' });

    this.jaw.clear();
    this.jaw.moveTo(22, 24).quadraticCurveTo(58, 26, 76, 14).quadraticCurveTo(57, 58, 28, 43).closePath().fill({ color: body });
    this.jaw.moveTo(22, 24).quadraticCurveTo(58, 26, 76, 14).quadraticCurveTo(57, 58, 28, 43).closePath().stroke({ color: edge, width: 2.5 });
    for (let i = 0; i < 5; i++) {
      const x = 36 + i * 8;
      this.jaw.moveTo(x, 27).lineTo(x + 3, 38).lineTo(x + 6, 27).closePath().fill({ color: 0xf8fafc });
    }

    this.eye.clear();
    this.eye.ellipse(48, -13, 13, 9).fill({ color: 0x020307 });
    this.eye.ellipse(48, -13, 10, 7).fill({ color: energy });
    this.eye.ellipse(48, -13, 2.5, 7).fill({ color: 0xffffff });
    this.eye.ellipse(48, -13, 16, 12).stroke({ color: edge, width: 2, alpha: 0.8 });
  }
}
