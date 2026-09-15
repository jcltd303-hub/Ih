import { GameEventBus, BossStateEvent, BossResultEvent } from '../core/GameEvents';
import { SoundManager } from '../../audio/SoundManager';
import { GameConfig } from '../../config/GameConfig';

export type BossStateMachinePhase =
  | 'NORMAL'
  | 'BOSS_TRIGGER'
  | 'WARNING'
  | 'BOSS_INTRO'
  | 'BOSS_ACTIVE'
  | 'BOSS_DEFEATED'
  | 'REWARD';

export class BossSystem {
  private static instance: BossSystem | null = null;

  private config = GameConfig.bossPacing;

  private phase: BossStateMachinePhase = 'NORMAL';
  private totalKillsSinceBoss = 0;
  private remainingPhaseMs = 0;
  private cooldownRemainingMs = 0;

  // Active Boss combat data
  private bossId: string | null = null;
  private bossName = 'APEX LEVIATHAN';
  private currentHp = 200;
  private maxHp = 200;
  private totalDamage = 0;
  private multiplier = 2.5;
  private isEnraged = false;
  private onSpawnBossCallback?: () => { id: string; name?: string; maxHp?: number };
  private onDespawnBossCallback?: (bossId: string) => void;

  public static getInstance(): BossSystem {
    if (!BossSystem.instance) {
      BossSystem.instance = new BossSystem();
    }
    return BossSystem.instance;
  }

  public setCallbacks(callbacks: {
    spawnBoss: () => { id: string; name?: string; maxHp?: number };
    despawnBoss: (bossId: string) => void;
  }): void {
    this.onSpawnBossCallback = callbacks.spawnBoss;
    this.onDespawnBossCallback = callbacks.despawnBoss;
  }

  public onFishKilled(): boolean {
    this.totalKillsSinceBoss++;
    
    console.log(`[AUDIT] BossSystem: Kill registered. TotalSinceBoss=${this.totalKillsSinceBoss}, Phase=${this.phase}, Cooldown=${this.cooldownRemainingMs}ms`);

    if (this.phase !== 'NORMAL') return false;
    if (this.cooldownRemainingMs > 0) return false;

    // Safety net: if player reached maxKills, guarantee boss trigger!
    const hitSafetyNet = this.totalKillsSinceBoss >= this.config.maxKills;
    const hitProbability =
      this.totalKillsSinceBoss >= this.config.minKills &&
      Math.random() < this.config.chancePerKill;

    if (hitSafetyNet || hitProbability) {
      console.log(
        `[BossSystem] Triggering boss! Kills=${this.totalKillsSinceBoss} (guarantee=${hitSafetyNet})`
      );
      this.startBossSequence();
      return true;
    }

    return false;
  }

  public forceTrigger(): void {
    console.log('[BossSystem] Dev manual trigger forced.');
    this.startBossSequence();
  }

  private startBossSequence(): void {
    this.phase = 'BOSS_TRIGGER';
    this.totalKillsSinceBoss = 0;
    this.isEnraged = false;
    this.totalDamage = 0;

    GameEventBus.getInstance().emit('BOSS_TRIGGER');

    // Transition immediately to WARNING
    this.phase = 'WARNING';
    this.remainingPhaseMs = this.config.warningDurationMs;
    SoundManager.playBossWarning();

    GameEventBus.getInstance().emit('BOSS_WARNING', {
      name: this.bossName,
      warningMs: this.config.warningDurationMs
    });
  }

  public update(deltaMs: number): void {
    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - deltaMs);
    }

    switch (this.phase) {
      case 'WARNING':
        this.remainingPhaseMs -= deltaMs;
        if (this.remainingPhaseMs <= 0) {
          this.enterIntroPhase();
        }
        break;

      case 'BOSS_INTRO':
        this.remainingPhaseMs -= deltaMs;
        if (this.remainingPhaseMs <= 0) {
          this.enterActiveCombatPhase();
        }
        break;

      case 'BOSS_ACTIVE':
        this.remainingPhaseMs -= deltaMs;
        // Check enrage threshold (< 35% HP)
        if (!this.isEnraged && this.currentHp <= this.maxHp * 0.35) {
          this.isEnraged = true;
          SoundManager.setBossMusic(true, true);
        }

        this.emitState();

        if (this.remainingPhaseMs <= 0) {
          this.handleBossEscaped();
        }
        break;

      case 'BOSS_DEFEATED':
        this.remainingPhaseMs -= deltaMs;
        if (this.remainingPhaseMs <= 0) {
          this.enterRewardPhase();
        }
        break;

      case 'REWARD':
        this.remainingPhaseMs -= deltaMs;
        if (this.remainingPhaseMs <= 0) {
          this.returnToNormal();
        }
        break;

      default:
        break;
    }
  }

  private enterIntroPhase(): void {
    this.phase = 'BOSS_INTRO';
    this.remainingPhaseMs = this.config.introDurationMs;

    // Spawn the boss in the engine world
    if (this.onSpawnBossCallback) {
      const spawnData = this.onSpawnBossCallback();
      this.bossId = spawnData.id;
      if (spawnData.name) this.bossName = spawnData.name;
      this.maxHp = spawnData.maxHp || 220;
      this.currentHp = this.maxHp;
    } else {
      this.bossId = 'boss_entity_1';
      this.maxHp = 220;
      this.currentHp = this.maxHp;
    }

    // Start boss battle music
    SoundManager.setBossMusic(true, false);

    GameEventBus.getInstance().emit('BOSS_INTRO', {
      name: this.bossName,
      maxHp: this.maxHp,
      multiplier: this.multiplier
    });
  }

  private enterActiveCombatPhase(): void {
    this.phase = 'BOSS_ACTIVE';
    this.remainingPhaseMs = this.config.battleDurationMs;

    GameEventBus.getInstance().emit('BOSS_START', {
      bossId: this.bossId,
      name: this.bossName,
      hp: this.currentHp,
      maxHp: this.maxHp,
      multiplier: this.multiplier
    });
    this.emitState();
  }

  public recordDamage(damage: number): { defeated: boolean; hpRemaining: number } {
    if (this.phase !== 'BOSS_ACTIVE') {
      return { defeated: false, hpRemaining: this.currentHp };
    }

    this.totalDamage += damage;
    this.currentHp = Math.max(0, this.currentHp - damage);

    GameEventBus.getInstance().emit('BOSS_HIT', {
      damage,
      hpRemaining: this.currentHp,
      maxHp: this.maxHp,
      totalDamage: this.totalDamage
    });

    if (this.currentHp <= 0) {
      this.handleBossDefeated();
      return { defeated: true, hpRemaining: 0 };
    }

    this.emitState();
    return { defeated: false, hpRemaining: this.currentHp };
  }

  private handleBossDefeated(): void {
    this.phase = 'BOSS_DEFEATED';
    this.remainingPhaseMs = 2000;

    SoundManager.playUiSound('jackpot_fanfare');

    const result: BossResultEvent = {
      defeated: true,
      totalDamage: this.totalDamage,
      bountyPayout: this.totalDamage * 0.15 * this.multiplier,
      currency: 'SC',
      multiplier: this.multiplier,
      timeElapsedSec: Math.round(
        (this.config.battleDurationMs - this.remainingPhaseMs) / 1000
      )
    };

    GameEventBus.getInstance().emit('BOSS_DEFEATED', result);
  }

  private handleBossEscaped(): void {
    this.phase = 'BOSS_DEFEATED';
    this.remainingPhaseMs = 2000;

    const result: BossResultEvent = {
      defeated: false,
      totalDamage: this.totalDamage,
      bountyPayout: this.totalDamage * 0.05,
      currency: 'SC',
      multiplier: 1.0,
      timeElapsedSec: Math.round(this.config.battleDurationMs / 1000)
    };

    GameEventBus.getInstance().emit('BOSS_ESCAPED', result);
  }

  private enterRewardPhase(): void {
    this.phase = 'REWARD';
    this.remainingPhaseMs = 3500;
  }

  public returnToNormal(): void {
    if (this.bossId && this.onDespawnBossCallback) {
      this.onDespawnBossCallback(this.bossId);
      this.bossId = null;
    }

    this.phase = 'NORMAL';
    this.cooldownRemainingMs = this.config.cooldownMs;
    this.remainingPhaseMs = 0;
    this.currentHp = 0;
    this.isEnraged = false;

    // Transition music back to gameplay
    SoundManager.setBossMusic(false, false);

    GameEventBus.getInstance().emit('ROUND_END');
  }

  private emitState(): void {
    const hpPct = this.maxHp > 0 ? (this.currentHp / this.maxHp) * 100 : 0;
    const eventData: BossStateEvent = {
      phase:
        this.phase === 'BOSS_ACTIVE'
          ? (this.isEnraged ? 'enraged' : 'engaged')
          : this.phase === 'WARNING'
          ? 'warning'
          : this.phase === 'BOSS_INTRO'
          ? 'intro'
          : this.phase === 'BOSS_DEFEATED'
          ? 'defeated'
          : 'idle',
      name: this.bossName,
      hp: this.currentHp,
      maxHp: this.maxHp,
      hpPercent: Math.max(0, Math.min(100, hpPct)),
      timeRemainingSec: Math.max(0, Math.ceil(this.remainingPhaseMs / 1000)),
      totalDamage: this.totalDamage,
      multiplier: this.multiplier
    };
    GameEventBus.getInstance().emit('BOSS_STATE', eventData);
  }

  public getPhase(): BossStateMachinePhase {
    return this.phase;
  }

  public isActive(): boolean {
    return (
      this.phase === 'WARNING' ||
      this.phase === 'BOSS_INTRO' ||
      this.phase === 'BOSS_ACTIVE'
    );
  }

  public getBossId(): string | null {
    return this.bossId;
  }

  public getKillsSinceBoss(): number {
    return this.totalKillsSinceBoss;
  }

  public getKillsUntilGuarantee(): number {
    return Math.max(0, this.config.maxKills - this.totalKillsSinceBoss);
  }

  public isEligible(): boolean {
    return (
      this.phase === 'NORMAL' &&
      this.cooldownRemainingMs <= 0 &&
      this.totalKillsSinceBoss >= this.config.minKills
    );
  }

  public getCooldownRemainingSec(): number {
    return Math.max(0, Math.ceil(this.cooldownRemainingMs / 1000));
  }

  public reset(): void {
    this.phase = 'NORMAL';
    this.totalKillsSinceBoss = 0;
    this.remainingPhaseMs = 0;
    this.cooldownRemainingMs = 0;
    this.currentHp = 0;
    this.bossId = null;
    SoundManager.setBossMusic(false, false);
  }
}
