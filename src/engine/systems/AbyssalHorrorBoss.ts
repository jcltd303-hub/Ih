/**
 * Abyssal Horror Boss — Dark Theme Organic Leviathan
 *
 * Full animation set (all cyclic or one-shot with return to idle):
 *  - idle      2.0s seamless breathing / jaw / tentacle / fin / tail (spec keyframes)
 *  - swim      stronger undulation driven by velocity
 *  - hit       brief recoil + red flash + shield pulse
 *  - enrage    phase transition surge (faster, wider gape, bilious glow)
 *  - bite      predatory jaw snap attack wind-up + strike
 *  - death     collapse, desaturate, sink & fade
 *
 * API is BossManager-compatible so Fish.ts can swap by theme.
 */

import { Container, Sprite, Texture, Graphics, Text, TextStyle, Assets } from 'pixi.js';
import { SoundManager } from '../../audio/SoundManager';
import { BossRaidManager } from './BossRaidManager';

// Body art (Vite resolves the import to a URL)
import abyssalBodyUrl from '../../assets/images/abyssal_horror_body.png';

export type AbyssalAnimState = 'idle' | 'swim' | 'hit' | 'enrage' | 'bite' | 'death';

const FPS = 30;
const IDLE_FRAMES = 60;
const IDLE_DURATION = 2.0;

function easeInOut(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function sampleTrack(keys: { frame: number; value: number }[], frame: number, total = IDLE_FRAMES): number {
  const f = ((frame % total) + total) % total;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].frame <= f) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  if (a.frame === b.frame) return a.value;
  return lerp(a.value, b.value, easeInOut((f - a.frame) / (b.frame - a.frame)));
}

// ---- Idle keyframes (exact spec) ----
const BODY_POS_Y = [
  { frame: 0, value: 0 }, { frame: 15, value: 3.5 }, { frame: 30, value: 0 },
  { frame: 45, value: -2 }, { frame: 60, value: 0 },
];
const BODY_SCALE_Y = [
  { frame: 0, value: 1 }, { frame: 15, value: 1.03 }, { frame: 30, value: 1 },
  { frame: 45, value: 0.98 }, { frame: 60, value: 1 },
];
const BODY_SCALE_X = [
  { frame: 0, value: 1 }, { frame: 15, value: 0.98 }, { frame: 30, value: 1 },
  { frame: 45, value: 1.02 }, { frame: 60, value: 1 },
];
const JAW_ROT = [
  { frame: 0, value: 0 }, { frame: 20, value: 4.5 }, { frame: 40, value: -1.5 }, { frame: 60, value: 0 },
];
const TENTACLE_ROT = [
  { frame: 0, value: 0 }, { frame: 12, value: 6 }, { frame: 25, value: -4 },
  { frame: 42, value: 3 }, { frame: 60, value: 0 },
];
const TENTACLE_X = [
  { frame: 0, value: 0 }, { frame: 12, value: 2.1 }, { frame: 25, value: -1.5 },
  { frame: 42, value: 1 }, { frame: 60, value: 0 },
];
const FIN1_ROT = [
  { frame: 0, value: 0 }, { frame: 20, value: 2 }, { frame: 40, value: -1 }, { frame: 60, value: 0 },
];
const FIN3_ROT = [
  { frame: 0, value: 0 }, { frame: 25, value: 4 }, { frame: 45, value: -2.5 }, { frame: 60, value: 0 },
];
const FIN5_ROT = [
  { frame: 0, value: 0 }, { frame: 30, value: 6.5 }, { frame: 50, value: -4 }, { frame: 60, value: 0 },
];
const TAIL_ROT = [
  { frame: 0, value: 0 }, { frame: 18, value: -5.2 }, { frame: 38, value: 6.8 }, { frame: 60, value: 0 },
];

export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public isEnraged = false;
  public phase: 1 | 2 | 3 = 1;
  public theme: 'light' | 'dark' = 'dark';

  private phaseAnnounceTimer = 0;
  private invulnFrames = 0;
  private shieldTimer = 0;

  // Hierarchy
  private bodyRoot: Container;
  private bodySprite: Sprite;
  private jawProxy: Container;
  private tentacleProxy: Container;
  private dorsalFin1: Graphics;
  private dorsalFin3: Graphics;
  private dorsalFin5: Graphics;
  private tailFin: Container;
  private ambientGlow: Graphics;
  private slimeDrips: Graphics;
  private shieldSprite: Graphics;
  private hitFlash: Graphics;

  public hudContainer: Container;
  private hudBg: Graphics;
  private hudHealthPips: Graphics;
  private bossTitleText: Text;
  private hpPercentText: Text;

  // Animation
  private animState: AbyssalAnimState = 'idle';
  private stateTime = 0;
  private idleElapsed = 0;
  private facingSign = 1;
  private swimPhase = 0;
  private deathProgress = 0;
  private biteProgress = 0;
  private hitRecoil = 0;

  private static bodyTexture: Texture | null = null;
  private static textureLoading: Promise<Texture> | null = null;

  constructor(maxHp = 28, _initialTheme: 'light' | 'dark' = 'dark') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = 'dark';

    this.ambientGlow = new Graphics();
    this.drawGlow(false);
    this.addChild(this.ambientGlow);

    this.bodyRoot = new Container();
    this.addChild(this.bodyRoot);

    this.bodySprite = new Sprite(Texture.WHITE);
    this.bodySprite.anchor.set(0.42, 0.48);
    this.bodySprite.tint = 0x1a2a2e;
    this.bodySprite.width = 300;
    this.bodySprite.height = 410;
    this.bodyRoot.addChild(this.bodySprite);
    this.loadBodyTexture();

    this.jawProxy = new Container();
    this.jawProxy.position.set(-90, -40);
    this.bodyRoot.addChild(this.jawProxy);

    this.tentacleProxy = new Container();
    this.tentacleProxy.position.set(-70, 10);
    this.bodyRoot.addChild(this.tentacleProxy);

    this.dorsalFin1 = this.makeFin(0x4a1a4a, 28, 18);
    this.dorsalFin1.position.set(20, -110);
    this.bodyRoot.addChild(this.dorsalFin1);

    this.dorsalFin3 = this.makeFin(0x5c1e5c, 34, 22);
    this.dorsalFin3.position.set(55, -95);
    this.bodyRoot.addChild(this.dorsalFin3);

    this.dorsalFin5 = this.makeFin(0x6e226e, 40, 26);
    this.dorsalFin5.position.set(95, -70);
    this.bodyRoot.addChild(this.dorsalFin5);

    this.tailFin = new Container();
    this.tailFin.position.set(130, 80);
    const tailGfx = this.makeFin(0x3d0f3d, 70, 48);
    tailGfx.rotation = -0.4;
    this.tailFin.addChild(tailGfx);
    this.bodyRoot.addChild(this.tailFin);

    this.slimeDrips = new Graphics();
    this.bodyRoot.addChild(this.slimeDrips);

    this.hitFlash = new Graphics();
    this.hitFlash.ellipse(0, 0, 180, 220);
    this.hitFlash.fill({ color: 0xff2244, alpha: 0.35 });
    this.hitFlash.visible = false;
    this.bodyRoot.addChild(this.hitFlash);

    this.shieldSprite = new Graphics();
    this.drawShield();
    this.shieldSprite.alpha = 0;
    this.shieldSprite.visible = false;
    this.addChild(this.shieldSprite);

    this.hudContainer = new Container();
    this.hudContainer.y = -98;
    this.addChild(this.hudContainer);
    this.buildHud();
    this.hudContainer.visible = false; // DOM HUD owns chrome (same as BossManager)
  }

  private async loadBodyTexture(): Promise<void> {
    try {
      if (!AbyssalHorrorBoss.bodyTexture) {
        if (!AbyssalHorrorBoss.textureLoading) {
          AbyssalHorrorBoss.textureLoading = Assets.load(abyssalBodyUrl).then((t) => {
            AbyssalHorrorBoss.bodyTexture = t as Texture;
            return AbyssalHorrorBoss.bodyTexture;
          });
        }
        await AbyssalHorrorBoss.textureLoading;
      }
      if (AbyssalHorrorBoss.bodyTexture && !this.destroyed) {
        this.bodySprite.texture = AbyssalHorrorBoss.bodyTexture;
        this.bodySprite.tint = 0xffffff;
        this.bodySprite.width = 0;
        this.bodySprite.height = 0;
        this.bodySprite.scale.set(0.52);
        this.bodySprite.anchor.set(0.42, 0.48);
      }
    } catch (e) {
      console.warn('[AbyssalHorrorBoss] body texture load failed', e);
    }
  }

  private makeFin(color: number, w: number, h: number): Graphics {
    const g = new Graphics();
    g.moveTo(0, 0);
    g.quadraticCurveTo(w * 0.6, -h * 0.7, w, -h * 0.15);
    g.quadraticCurveTo(w * 0.55, h * 0.25, 0, 0);
    g.closePath();
    g.fill({ color, alpha: 0.85 });
    g.moveTo(0, 0);
    g.quadraticCurveTo(w * 0.6, -h * 0.7, w, -h * 0.15);
    g.stroke({ width: 1.5, color: 0xaa44aa, alpha: 0.55 });
    return g;
  }

  private drawGlow(enraged: boolean): void {
    this.ambientGlow.clear();
    const c = enraged ? 0x880022 : 0x220033;
    this.ambientGlow.ellipse(0, 20, 220, 280);
    this.ambientGlow.fill({ color: c, alpha: enraged ? 0.38 : 0.22 });
    this.ambientGlow.ellipse(0, 10, 160, 200);
    this.ambientGlow.fill({ color: enraged ? 0xaa2244 : 0x440066, alpha: enraged ? 0.2 : 0.12 });
  }

  private drawShield(): void {
    this.shieldSprite.clear();
    this.shieldSprite.ellipse(0, 10, 200, 240);
    this.shieldSprite.fill({ color: 0x661144, alpha: 0.18 });
    this.shieldSprite.stroke({ width: 2.5, color: 0xaa44aa, alpha: 0.85 });
  }

  private buildHud(): void {
    this.hudBg = new Graphics();
    this.hudContainer.addChild(this.hudBg);
    this.renderHudBackground();

    this.hudHealthPips = new Graphics();
    this.hudContainer.addChild(this.hudHealthPips);

    const titleStyle = new TextStyle({
      fontFamily: '"Space Grotesk", "Orbitron", monospace, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xff4466,
      dropShadow: { color: 0x000000, blur: 4, distance: 1 },
    });
    this.bossTitleText = new Text({ text: 'ABYSSAL HORROR', style: titleStyle });
    this.bossTitleText.anchor.set(0.5, 1);
    this.bossTitleText.y = -10;
    this.hudContainer.addChild(this.bossTitleText);

    const percentStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    this.hpPercentText = new Text({ text: '100%', style: percentStyle });
    this.hpPercentText.anchor.set(0.5, 0);
    this.hpPercentText.y = 8;
    this.hudContainer.addChild(this.hpPercentText);
    this.updateHealthBar();
  }

  private renderHudBackground(): void {
    this.hudBg.clear();
    const w = 176;
    const h = 42;
    this.hudBg.roundRect(-w / 2, -h / 2, w, h, 6);
    this.hudBg.fill({ color: 0x090d16, alpha: 0.88 });
    this.hudBg.stroke({
      width: 1.5,
      color: this.isEnraged ? 0xff0033 : 0xaa3366,
      alpha: 0.9,
    });
  }

  // ---------------------------------------------------------------------------
  // Public API (BossManager-compatible)
  // ---------------------------------------------------------------------------

  public setTheme(_theme: 'light' | 'dark'): void {
    this.theme = 'dark';
    this.drawGlow(this.isEnraged);
    this.renderHudBackground();
    this.updateHealthBar();
  }

  public playState(state: AbyssalAnimState): void {
    if (this.animState === 'death') return;
    this.animState = state;
    this.stateTime = 0;
    if (state === 'bite') this.biteProgress = 0;
    if (state === 'hit') this.hitRecoil = 1;
    if (state === 'enrage') {
      this.isEnraged = true;
      this.drawGlow(true);
    }
    if (state === 'death') this.deathProgress = 0;
  }

  /**
   * dtScale ≈ frames at 60fps (same convention as BossManager).
   * vx/vy drive swim amplitude and facing.
   */
  public update(dtScale: number = 1.0, vx: number = 0, _vy: number = 0): void {
    if (this.invulnFrames > 0) this.invulnFrames = Math.max(0, this.invulnFrames - dtScale);
    if (this.phaseAnnounceTimer > 0) this.phaseAnnounceTimer = Math.max(0, this.phaseAnnounceTimer - dtScale);

    const dt = dtScale / 60;
    this.stateTime += dt;
    this.swimPhase += 0.075 * dtScale * (this.isEnraged ? 1.6 : 1.0);

    if (Math.abs(vx) > 0.15) {
      this.facingSign = vx > 0 ? 1 : -1;
    }

    if (this.animState === 'idle' || this.animState === 'swim') {
      const speed = Math.abs(vx);
      this.animState = speed > 0.9 ? 'swim' : 'idle';
    }

    switch (this.animState) {
      case 'death':
        this.updateDeath(dt);
        break;
      case 'bite':
        this.updateBite(dt);
        break;
      case 'hit':
        this.updateHit(dt);
        break;
      case 'enrage':
        this.updateEnrage(dt);
        break;
      case 'swim':
        this.updateSwim(dt, vx);
        break;
      default:
        this.updateIdle(dt);
        break;
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer -= dtScale * 0.06;
      this.shieldSprite.alpha = Math.max(0, this.shieldTimer);
      const s = 1.0 + (1 - this.shieldTimer) * 0.15;
      this.shieldSprite.scale.set(s);
      if (this.shieldTimer <= 0) this.shieldSprite.visible = false;
    }

    this.hudContainer.scale.x = 1;
    this.bodyRoot.scale.x = Math.abs(this.bodyRoot.scale.x) * this.facingSign;
  }

  private updateIdle(dt: number): void {
    this.idleElapsed += dt;
    const t = this.idleElapsed % IDLE_DURATION;
    const frame = t * FPS;
    this.applyIdlePose(frame, 1.0);
    this.updateSlime(t);
  }

  private updateSwim(dt: number, vx: number): void {
    this.idleElapsed += dt;
    const t = this.idleElapsed % IDLE_DURATION;
    const frame = t * FPS;
    const amp = 1.35 + Math.min(1.2, Math.abs(vx) * 0.35);
    this.applyIdlePose(frame, amp);
    this.bodyRoot.rotation = Math.sin(this.swimPhase * 0.9) * 0.06 * amp;
    this.updateSlime(t);
  }

  private applyIdlePose(frame: number, amp: number): void {
    const posY = sampleTrack(BODY_POS_Y, frame) * amp;
    const scaleY = 1 + (sampleTrack(BODY_SCALE_Y, frame) - 1) * amp;
    const scaleX = 1 + (sampleTrack(BODY_SCALE_X, frame) - 1) * amp;

    this.bodyRoot.y = posY + this.hitRecoil * -8;
    this.bodyRoot.scale.set(scaleX, scaleY);
    this.bodyRoot.rotation = this.hitRecoil * 0.08 * -this.facingSign;

    this.jawProxy.rotation = (sampleTrack(JAW_ROT, frame) * Math.PI) / 180 * amp;
    this.tentacleProxy.rotation = (sampleTrack(TENTACLE_ROT, frame) * Math.PI) / 180 * amp;
    this.tentacleProxy.x = -70 + sampleTrack(TENTACLE_X, frame) * amp;

    this.dorsalFin1.rotation = (sampleTrack(FIN1_ROT, frame) * Math.PI) / 180 * amp;
    this.dorsalFin3.rotation = (sampleTrack(FIN3_ROT, frame) * Math.PI) / 180 * amp;
    this.dorsalFin5.rotation = (sampleTrack(FIN5_ROT, frame) * Math.PI) / 180 * amp;
    this.tailFin.rotation = (sampleTrack(TAIL_ROT, frame) * Math.PI) / 180 * amp;
  }

  private updateHit(dt: number): void {
    this.hitRecoil = Math.max(0, this.hitRecoil - dt * 4);
    this.hitFlash.visible = this.hitRecoil > 0.35;
    this.hitFlash.alpha = this.hitRecoil * 0.5;

    this.idleElapsed += dt;
    const frame = (this.idleElapsed % IDLE_DURATION) * FPS;
    this.applyIdlePose(frame, 1.0);

    if (this.stateTime > 0.35) {
      this.hitFlash.visible = false;
      this.animState = 'idle';
      this.hitRecoil = 0;
    }
  }

  private updateEnrage(dt: number): void {
    const p = Math.min(1, this.stateTime / 0.9);
    const surge = Math.sin(p * Math.PI);
    this.idleElapsed += dt * (1 + surge * 1.5);
    const frame = (this.idleElapsed % IDLE_DURATION) * FPS;
    this.applyIdlePose(frame, 1.2 + surge * 0.5);
    this.bodyRoot.scale.set(
      this.bodyRoot.scale.x * (1 + surge * 0.08),
      this.bodyRoot.scale.y * (1 + surge * 0.08)
    );
    this.jawProxy.rotation += surge * 0.25;
    if (this.stateTime > 0.9) {
      this.animState = 'idle';
    }
  }

  private updateBite(dt: number): void {
    this.biteProgress = Math.min(1, this.stateTime / 0.55);
    this.idleElapsed += dt;
    const frame = (this.idleElapsed % IDLE_DURATION) * FPS;
    this.applyIdlePose(frame, 1.1);

    if (this.biteProgress < 0.55) {
      const open = easeInOut(this.biteProgress / 0.55);
      this.jawProxy.rotation = open * 0.55;
      this.bodyRoot.x = this.facingSign * open * 18;
    } else {
      const snap = easeInOut((this.biteProgress - 0.55) / 0.45);
      this.jawProxy.rotation = 0.55 * (1 - snap);
      this.bodyRoot.x = this.facingSign * 18 * (1 - snap);
    }

    if (this.stateTime > 0.55) {
      this.bodyRoot.x = 0;
      this.animState = 'idle';
    }
  }

  private updateDeath(dt: number): void {
    this.deathProgress = Math.min(1, this.stateTime / 1.8);
    const p = this.deathProgress;
    this.bodyRoot.y = p * 40;
    this.bodyRoot.rotation = p * 0.35 * this.facingSign;
    this.bodyRoot.scale.set(1 - p * 0.15, 1 - p * 0.25);
    this.alpha = 1 - p * 0.85;
    this.jawProxy.rotation = p * 0.4;
    this.tailFin.rotation = p * 0.6;
    if (p >= 1) {
      this.visible = false;
    }
  }

  private updateSlime(t: number): void {
    this.slimeDrips.clear();
    const dripPhase = t * 1.4;
    for (let i = 0; i < 4; i++) {
      const x = -85 + i * 18 + Math.sin(dripPhase + i) * 3;
      const y0 = 30 + i * 8;
      const len = 12 + Math.sin(dripPhase * 0.7 + i * 1.3) * 6;
      this.slimeDrips.moveTo(x, y0);
      this.slimeDrips.lineTo(x + Math.sin(dripPhase + i * 0.5) * 2, y0 + len);
      this.slimeDrips.stroke({ width: 1.5, color: 0x66aa44, alpha: 0.3 + Math.sin(dripPhase + i) * 0.15 });
    }
  }

  public triggerShieldHit(): void {
    this.shieldSprite.visible = true;
    this.shieldSprite.alpha = 0.95;
    this.shieldTimer = 1.0;
    this.shieldSprite.scale.set(1.0);
  }

  public takeDamage(amount: number): boolean {
    if (this.invulnFrames > 0) {
      this.triggerShieldHit();
      return false;
    }
    if (this.animState === 'death') return false;

    let incoming = amount;
    if (this.phase === 1) incoming *= 0.55;
    else if (this.phase === 3) incoming *= 1.15;

    this.currentHp = Math.max(0, this.currentHp - incoming);
    BossRaidManager.getInstance().recordPlayerDamage(incoming);
    this.updateHealthBar();
    this.triggerShieldHit();
    this.playState('hit');
    this.evaluatePhaseTransition();

    if (this.currentHp <= 0) {
      this.playState('death');
      SoundManager.playBossDefeat();
      return true;
    }
    return false;
  }

  private evaluatePhaseTransition(): void {
    const pct = this.currentHp / this.maxHp;
    if (pct <= 0.4 && this.phase < 3) {
      this.phase = 3;
      this.isEnraged = true;
      this.invulnFrames = 45;
      this.phaseAnnounceTimer = 90;
      this.playState('enrage');
      this.bossTitleText.style.fill = 0xff0033;
      SoundManager.playBossEnraged();
      this.drawGlow(true);
      this.renderHudBackground();
    } else if (pct <= 0.65 && this.phase < 2) {
      this.phase = 2;
      this.invulnFrames = 20;
      this.phaseAnnounceTimer = 70;
      this.bossTitleText.style.fill = 0xfbbf24;
      SoundManager.playBossWarning();
    }
  }

  public getPhaseDamageTakenMultiplier(): number {
    if (this.phase === 1) return 0.55;
    if (this.phase === 3) return 1.15;
    return 1.0;
  }

  public getPhaseSpeedMultiplier(): number {
    if (this.phase === 1) return 0.9;
    if (this.phase === 2) return 1.15;
    return 1.45;
  }

  /** Optional: trigger a bite attack from combat AI */
  public triggerBite(): void {
    if (this.animState === 'death' || this.animState === 'bite') return;
    this.playState('bite');
  }

  private updateHealthBar(): void {
    const pct = Math.max(0, Math.min(1, this.currentHp / this.maxHp));
    this.hudHealthPips.clear();
    const barW = 150;
    const barH = 7;
    const startX = -barW / 2;
    const pips = 20;
    const filled = Math.ceil(pct * pips);
    const pipColor = this.isEnraged
      ? 0xff0033
      : pct > 0.6
        ? 0xaa44aa
        : pct > 0.3
          ? 0xfbbf24
          : 0xf97316;

    for (let i = 0; i < pips; i++) {
      const px = startX + i * (barW / pips) + 1;
      const pw = barW / pips - 2;
      this.hudHealthPips.rect(px, -3.5, pw, barH);
      this.hudHealthPips.fill({
        color: i < filled ? pipColor : 0x1f2937,
        alpha: i < filled ? 0.95 : 0.4,
      });
    }
    if (this.hpPercentText) {
      const percentVal = Math.round(pct * 100);
      this.hpPercentText.text = this.isEnraged ? `${percentVal}% [OVERDRIVE]` : `${percentVal}% HP`;
      this.hpPercentText.style.fill = this.isEnraged ? 0xff3300 : 0xfbbf24;
    }
  }
}
