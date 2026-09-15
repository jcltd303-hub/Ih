import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { FishManager } from './FishManager';
import { ParticleFXManager } from './ParticleFXManager';
import { SoundManager } from '../../audio/SoundManager';

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
 * - Timed window (30s)
 * - Shared HP across all players at the table
 * - Last-hit vanity bounty + damage-contribution payout
 * - Escapes if not defeated in time
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
  private onComplete?: (result: { defeated: boolean; lastHitUserId: string | null; contributors: Map<string, number> }) => void;
  private readonly RAID_DURATION_MS = 90000;
  private readonly ESCAPE_COUNTDOWN_MS = 70000;
  private screenW = 0;
  private screenH = 0;

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
      fill: 0xffd700,
      dropShadow: {
        color: '#000000',
        blur: 4,
        distance: 2
      }
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

  public startRaid(userId: string, onComplete?: typeof this.onComplete): void {
    if (this.state.active) {
      console.warn('[BossRaidEvent] startRaid ignored - already active');
      return;
    }
    console.log('[BossRaidEvent] Starting raid for user:', userId);
    this.onComplete = onComplete;

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

    console.log('[BossRaidEvent] Spawning boss fish with HP:', maxHp);
    const boss = this.fishManager.spawnFish('boss', maxHp);
    this.bossId = boss.id;
    console.log('[BossRaidEvent] Boss spawned with ID:', this.bossId);

    /* title handled by HUD */
    SoundManager.playBossWarning();

    this.uiContainer.visible = false; // HUD owns boss chrome
  }

  public recordDamage(userId: string, damage: number): void {
    if (!this.state.active || this.state.phase === 'approaching' || this.state.phase === 'defeated') return;

    this.state.hp = Math.max(0, this.state.hp - damage);
    this.state.totalDamage += damage;

    const contrib = this.state.contributors.get(userId) || { damage: 0, lastHit: 0 };
    contrib.damage += damage;
    contrib.lastHit = Date.now();
    this.state.contributors.set(userId, contrib);

    if (this.state.hp < this.state.maxHp * 0.4 && this.state.phase === 'engaged') {
      this.state.phase = 'enraged';
      
    }

    if (this.state.hp <= 0) {
      this.defeatBoss(userId);
    }
  }

  private defeatBoss(lastHitUserId: string): void {
    console.log('[BossRaidEvent] Boss DEFEATED by:', lastHitUserId);
    this.state.phase = 'defeated';
    

    if (this.bossId) {
      this.fishManager.killFish(this.bossId);
      this.bossId = null;
    }

    this.particleFX.emitCoinExplosion(this.screenW / 2, this.screenH / 2, 48);
    setTimeout(() => this.endRaid(true, lastHitUserId), 3000);
  }

  private escapeBoss(): void {
    console.log('[BossRaidEvent] Boss ESCAPED (Time Out)');
    this.state.phase = 'escaped';
    

    if (this.bossId) {
      const fish = this.fishManager.getFish(this.bossId);
      if (fish) fish.kill();
      this.bossId = null;
    }

    setTimeout(() => this.endRaid(false, null), 2000);
  }

  private endRaid(defeated: boolean, lastHitUserId: string | null): void {
    console.log('[BossRaidEvent] Ending raid. Defeated:', defeated);
    const contributors = new Map<string, number>();
    for (const [uid, c] of this.state.contributors) {
      contributors.set(uid, c.damage);
    }

    this.state.active = false;
    this.uiContainer.visible = false;
    this.onComplete?.({ defeated, lastHitUserId, contributors });
  }

  public update(deltaTime: number): void {
    if (!this.state.active) return;

    // Guard against uninitialized timeRemaining if active is flipped incorrectly
    if (this.state.timeRemaining <= 0 && this.state.active && this.state.phase === 'engaged') {
       this.state.timeRemaining = this.RAID_DURATION_MS;
    }

    this.state.timeRemaining -= deltaTime;
    if (this.state.timeRemaining <= 0 && this.state.phase !== 'defeated') {
      this.escapeBoss();
      return;
    }

    const seconds = Math.ceil(this.state.timeRemaining / 1000);
    this.timerText.text = `RAID: ${seconds}s | HP: ${Math.ceil(this.state.hp)}/${this.state.maxHp}`;

    const hpPct = this.state.hp / this.state.maxHp;
    const barWidth = 300;
    const barX = 20;
    const barY = 90;

    this.hpBarBg.clear();
    this.hpBarBg.rect(barX, barY, barWidth, 10);
    this.hpBarBg.fill({ color: 0x111827, alpha: 0.8 });

    this.hpBarFill.clear();
    this.hpBarFill.rect(barX + 1, barY + 1, (barWidth - 2) * hpPct, 8);
    const hpColor = this.state.phase === 'enraged' ? 0xff3300 : 0x00ffcc;
    this.hpBarFill.fill({ color: hpColor, alpha: 0.95 });

    if (this.announceText.alpha > 0) {
      this.announceText.alpha -= deltaTime * 0.0005;
    }
  }

  private showAnnouncement(_text: string): void {
    // HUD owns boss title/timer — no pixi banner spam
    this.announceText.text = '';
    this.announceText.alpha = 0;
  }

  public getState(): BossRaidState {
    return {
      ...this.state,
      contributors: new Map(this.state.contributors)
    };
  }

  public isActive(): boolean {
    return this.state.active;
  }

  public getBossId(): string | null {
    return this.bossId;
  }
}
