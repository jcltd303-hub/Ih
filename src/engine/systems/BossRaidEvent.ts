import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { FishManager } from './FishManager';
import { ParticleFXManager } from './ParticleFXManager';
import { SoundManager } from '../../audio/SoundManager';
import { GameEventBus, BossStateEvent, BossResultEvent } from '../core/GameEvents';
import { GameConfig } from '../../config/GameConfig';
import { AuthManager } from '../../network/AuthManager';

export interface BossRaidState {
  active: boolean;
  phase: 'approaching' | 'engaged' | 'enraged' | 'defeated' | 'escaped';
  hp: number;
  maxHp: number;
  timeRemaining: number;
  totalDamage: number;
  contributors: Map<string, { damage: number; lastHit: number }>;
}

/**
 * Table-wide boss raid event.
 * The gameplay state is the source of truth; the browser HUD receives
 * explicit lifecycle/state events so the boss can never be active-but-invisible.
 */
export class BossRaidEvent {
  private stage: Container;
  private fishManager: FishManager;
  private particleFX: ParticleFXManager;
  private state: BossRaidState;
  private bossId: string | null = null;
  private uiContainer: Container;
  private timerText: Text;
  private hpBarBg: Graphics;
  private hpBarFill: Graphics;
  private announceText: Text;
  private onComplete?: (result: { defeated: boolean; lastHitUserId: string | null; contributors: Map<string, number>; bountyPayout: number }) => void;
  private currentBountyPayout = 0;
  private readonly RAID_DURATION_MS = GameConfig.bossPacing.battleDurationMs;
  private screenW = 0;
  private screenH = 0;
  private raidStartedAt = 0;
  private resultEmitted = false;
  private stateEmitAccumulatorMs = 0;
  private lastStateSecond = -1;
  private lastStateHp = -1;
  private lastStatePhase: BossRaidState['phase'] | null = null;

  constructor(stage: Container, fishManager: FishManager, particleFX: ParticleFXManager) {
    this.stage = stage;
    this.fishManager = fishManager;
    this.particleFX = particleFX;
    this.state = {
      active: false,
      phase: 'approaching',
      hp: 0,
      maxHp: 0,
      timeRemaining: 0,
      totalDamage: 0,
      contributors: new Map()
    };

    this.uiContainer = new Container();
    this.uiContainer.visible = false;
    this.stage.addChild(this.uiContainer);

    const style = new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: 0xff0055 });
    this.timerText = new Text({ text: '', style });
    this.timerText.x = 20;
    this.timerText.y = 60;
    this.uiContainer.addChild(this.timerText);

    this.hpBarBg = new Graphics();
    this.hpBarFill = new Graphics();
    this.uiContainer.addChild(this.hpBarBg);
    this.uiContainer.addChild(this.hpBarFill);

    const announceStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0x00f0ff,
      stroke: { color: '#ff0055', width: 3 },
      dropShadow: { color: '#000000', blur: 6, distance: 2 }
    });
    this.announceText = new Text({ text: '', style: announceStyle });
    this.announceText.anchor.set(0.5);
    this.uiContainer.addChild(this.announceText);
  }

  public resize(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
    this.announceText.x = width / 2;
    this.announceText.y = 120;
  }

  private emitState(multiplier = 2.5, force = false): void {
    const hpPercent = this.state.maxHp > 0 ? (this.state.hp / this.state.maxHp) * 100 : 0;
    const second = Math.ceil(this.state.timeRemaining / 1000);
    const hpChanged = this.lastStateHp < 0 || Math.abs(this.state.hp - this.lastStateHp) >= 1;
    const secondChanged = second !== this.lastStateSecond;
    const phaseChanged = this.state.phase !== this.lastStatePhase;
    if (!force && !hpChanged && !secondChanged && !phaseChanged) return;

    const bus = GameEventBus.getInstance();
    const phase: BossStateEvent['phase'] = this.state.phase;
    bus.emit<BossStateEvent>('BOSS_STATE', {
      bossId: this.bossId ?? undefined,
      phase,
      name: 'ABYSSAL HORROR BOSS',
      hp: this.state.hp,
      maxHp: this.state.maxHp,
      hpPercent,
      timeRemainingSec: Math.max(0, second),
      totalDamage: this.state.totalDamage,
      multiplier
    });
    this.lastStateHp = this.state.hp;
    this.lastStateSecond = second;
    this.lastStatePhase = this.state.phase;
  }

  public startRaid(userId: string, onComplete?: typeof this.onComplete): void {
    if (this.state.active) return;

    this.onComplete = onComplete;
    this.currentBountyPayout = 0;
    this.resultEmitted = false;
    this.raidStartedAt = Date.now();
    this.stateEmitAccumulatorMs = 0;
    this.lastStateSecond = -1;
    this.lastStateHp = -1;
    this.lastStatePhase = null;

    const maxHp = 150 + Math.floor(Math.random() * 100);
    this.state = {
      active: true,
      phase: 'engaged',
      hp: maxHp,
      maxHp,
      timeRemaining: this.RAID_DURATION_MS,
      totalDamage: 0,
      contributors: new Map()
    };

    const boss = this.fishManager.spawnFish('boss', maxHp);
    this.bossId = boss.id;

    const bus = GameEventBus.getInstance();
    bus.emit('BOSS_TRIGGER', { name: 'ABYSSAL HORROR BOSS', userId });
    bus.emit('BOSS_WARNING', { name: 'ABYSSAL HORROR BOSS', warningMs: GameConfig.bossPacing.warningDurationMs });
    bus.emit('BOSS_INTRO', { name: 'ABYSSAL HORROR BOSS' });
    bus.emit('BOSS_START', { name: 'ABYSSAL HORROR BOSS', bossId: this.bossId });
    this.emitState(2.5, true);

    SoundManager.playBossWarning();
    this.uiContainer.visible = false; // HUD owns boss chrome.
  }

  public recordDamage(userId: string, damage: number): void {
    if (!this.state.active || this.state.phase === 'defeated' || this.state.phase === 'escaped') return;
    if (!Number.isFinite(damage) || damage <= 0) return;

    this.state.hp = Math.max(0, this.state.hp - damage);
    this.state.totalDamage += damage;

    const contrib = this.state.contributors.get(userId) || { damage: 0, lastHit: 0 };
    contrib.damage += damage;
    contrib.lastHit = Date.now();
    this.state.contributors.set(userId, contrib);

    if (this.state.hp < this.state.maxHp * 0.4 && this.state.phase === 'engaged') {
      this.state.phase = 'enraged';
      GameEventBus.getInstance().emit('BOSS_PHASE_CHANGE', { phase: 'ENRAGED' });
      SoundManager.setBossMusic(true, true);
    }

    this.emitState();

    if (this.state.hp <= 0) this.defeatBoss(userId);
  }

  private defeatBoss(lastHitUserId: string): void {
    if (!this.state.active || this.state.phase === 'defeated') return;
    this.state.phase = 'defeated';
    this.emitState(2.5, true);

    if (this.bossId) {
      this.fishManager.killFish(this.bossId);
      this.bossId = null;
    }

    const myUid = AuthManager.getInstance().getUid() || GameConfig.localPlayerId;
    const myDamage = this.state.contributors.get(myUid)?.damage || 0;
    const killBonus = lastHitUserId === myUid ? (myDamage * 0.10) : 0; // Last hit gets +10% bonus
    // myDamage is strictly 1:1 with betAmount wagered (mean). Pay exactly 65% of wager back as bounty, preserving 85% total RTP.
    const totalBounty = myDamage > 0 ? (myDamage * 0.65) + killBonus : 0;
    this.currentBountyPayout = totalBounty;

    GameEventBus.getInstance().emit<BossResultEvent>('BOSS_DEFEATED', {
      defeated: true,
      totalDamage: this.state.totalDamage,
      bountyPayout: totalBounty,
      currency: 'SC',
      multiplier: 2.5,
      timeElapsedSec: Math.max(0, (Date.now() - this.raidStartedAt) / 1000)
    });

    this.particleFX.emitCoinExplosion(this.screenW / 2, this.screenH / 2, 48);
    setTimeout(() => this.endRaid(true, lastHitUserId), 3000);
  }

  private escapeBoss(): void {
    if (!this.state.active || this.state.phase === 'escaped' || this.state.phase === 'defeated') return;
    this.state.phase = 'escaped';
    this.emitState(2.5, true);

    if (this.bossId) {
      const fish = this.fishManager.getFish(this.bossId);
      if (fish) fish.kill();
      this.bossId = null;
    }

    GameEventBus.getInstance().emit<BossResultEvent>('BOSS_ESCAPED', {
      defeated: false,
      totalDamage: this.state.totalDamage,
      bountyPayout: 0,
      currency: 'SC',
      multiplier: 2.5,
      timeElapsedSec: Math.max(0, (Date.now() - this.raidStartedAt) / 1000)
    });

    setTimeout(() => this.endRaid(false, null), 2000);
  }

  private endRaid(defeated: boolean, lastHitUserId: string | null): void {
    if (this.resultEmitted) return;
    this.resultEmitted = true;

    const contributors = new Map<string, number>();
    for (const [uid, c] of this.state.contributors) contributors.set(uid, c.damage);

    this.state.active = false;
    this.uiContainer.visible = false;
    this.onComplete?.({ defeated, lastHitUserId, contributors, bountyPayout: this.currentBountyPayout });
  }

  public update(deltaTime: number): void {
    if (!this.state.active) return;

    this.state.timeRemaining = Math.max(0, this.state.timeRemaining - deltaTime);
    if (this.state.timeRemaining <= 0 && this.state.phase !== 'defeated' && this.state.phase !== 'escaped') {
      this.escapeBoss();
      return;
    }

    const seconds = Math.ceil(this.state.timeRemaining / 1000);
    this.timerText.text = `RAID: ${seconds}s | HP: ${Math.ceil(this.state.hp)}/${this.state.maxHp}`;

    const hpPct = this.state.maxHp > 0 ? this.state.hp / this.state.maxHp : 0;
    const barWidth = 300;
    const barX = 20;
    const barY = 90;

    this.hpBarBg.clear();
    this.hpBarBg.rect(barX, barY, barWidth, 10);
    this.hpBarBg.fill({ color: 0x111827, alpha: 0.8 });

    this.hpBarFill.clear();
    this.hpBarFill.rect(barX + 1, barY + 1, (barWidth - 2) * hpPct, 8);
    this.hpBarFill.fill({ color: this.state.phase === 'enraged' ? 0xff3300 : 0x00ffcc, alpha: 0.95 });

    this.stateEmitAccumulatorMs += deltaTime;
    if (this.stateEmitAccumulatorMs >= 100) {
      this.stateEmitAccumulatorMs = 0;
      this.emitState();
    }
  }

  public getState(): BossRaidState {
    return { ...this.state, contributors: new Map(this.state.contributors) };
  }

  public isActive(): boolean {
    return this.state.active;
  }

  public getBossId(): string | null {
    return this.bossId;
  }
}
