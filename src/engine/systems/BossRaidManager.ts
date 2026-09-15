import { TableSelectionManager, TableConfig } from '../../network/TableSelectionManager';
import { WalletService } from '../../network/WalletService';
import { TournamentManager } from '../../network/TournamentManager';
import { SoundManager } from '../../audio/SoundManager';
import { AuthManager } from '../../network/AuthManager';
import { PlayerProgressionManager } from './PlayerProgressionManager';

export interface BossRaidState {
  active: boolean;
  tableId: string;
  tableMode: 'practice' | 'public' | 'tournament';
  timeRemainingSec: number;
  totalDurationSec: number;
  sharedBossHp: number;
  sharedBossMaxHp: number;
  playerDamage: number;
  totalDamage: number;
  bountyGc: number;
  bountySc: number;
  enraged: boolean;
  status: 'idle' | 'in_progress' | 'enraged' | 'victory' | 'failed';
  victoryBountyAwarded?: { gc: number; sc: number; score?: number };
}

type RaidListener = (state: BossRaidState) => void;

export class BossRaidManager {
  private static instance: BossRaidManager | null = null;

  private state: BossRaidState = {
    active: false,
    tableId: 'table_practice',
    tableMode: 'practice',
    timeRemainingSec: 30,
    totalDurationSec: 30,
    sharedBossHp: 60000,
    sharedBossMaxHp: 60000,
    playerDamage: 0,
    totalDamage: 0,
    bountyGc: 35000,
    bountySc: 120,
    enraged: false,
    status: 'idle',
  };

  private listeners: RaidListener[] = [];
  private timerInterval: number | null = null;

  private constructor() {
    // Listen for table switching
    TableSelectionManager.getInstance().onTableChange((table) => {
      this.handleTableChange(table);
    });
  }

  public static getInstance(): BossRaidManager {
    if (!BossRaidManager.instance) {
      BossRaidManager.instance = new BossRaidManager();
    }
    return BossRaidManager.instance;
  }

  public getState(): BossRaidState {
    return { ...this.state };
  }

  public isRaidActive(): boolean {
    return this.state.active && this.state.status !== 'victory' && this.state.status !== 'failed';
  }

  private handleTableChange(table: TableConfig): void {
    this.state.tableId = table.id;
    this.state.tableMode = table.mode;

    if (table.mode === 'practice') {
      // Practice table does not auto-start timed boss raid
      this.stopRaid();
      this.state.active = false;
      this.state.status = 'idle';
      this.emit();
    } else {
      // Boss starts from combat progress (kills/score) — not on table entry
      this.stopRaid();
      this.state.active = false;
      this.state.status = 'idle';
      this.emit();
    }
  }

  public startTimedRaid(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const isTournament = this.state.tableMode === 'tournament';
    const maxHp = isTournament ? 80000 : 50000;
    const bountyGc = isTournament ? 60000 : 35000;
    const bountySc = isTournament ? 250 : 100;

    this.state = {
      active: true,
      tableId: this.state.tableId,
      tableMode: this.state.tableMode,
      timeRemainingSec: 30,
      totalDurationSec: 30,
      sharedBossHp: maxHp,
      sharedBossMaxHp: maxHp,
      playerDamage: 0,
      totalDamage: 0,
      bountyGc,
      bountySc,
      enraged: false,
      status: 'in_progress',
    };

    SoundManager.playBossWarning();
    SoundManager.setBossMusic(true, false);
    PlayerProgressionManager.getInstance().setBossUpgrade(true);
    this.emit();

    this.timerInterval = window.setInterval(() => {
      this.tickSecond();
    }, 1000);
  }

  private tickSecond(): void {
    if (!this.state.active) return;

    if (this.state.timeRemainingSec > 0) {
      this.state.timeRemainingSec--;

      // Simulated simulated co-op players damage on public/tournament tables
      if (this.state.status === 'in_progress' || this.state.status === 'enraged') {
        const coOpDmg = Math.floor(Math.random() * 220 + 80);
        this.applyDamage(coOpDmg, false);
      }

      this.emit();

      if (this.state.timeRemainingSec === 0) {
        this.handleTimeout();
      }
    }
  }

  public recordPlayerDamage(damage: number): void {
    if (!this.state.active || this.state.status === 'victory' || this.state.status === 'failed') return;
    this.applyDamage(damage, true);
  }

  private applyDamage(damage: number, isPlayer: boolean): void {
    if (isPlayer) {
      this.state.playerDamage += damage;
    }
    this.state.totalDamage += damage;
    this.state.sharedBossHp = Math.max(0, this.state.sharedBossHp - damage);

    const hpPct = this.state.sharedBossHp / this.state.sharedBossMaxHp;

    // Spec requirement: Enrage at 40% HP
    if (hpPct <= 0.40 && !this.state.enraged) {
      this.state.enraged = true;
      this.state.status = 'enraged';
      SoundManager.playBossEnraged();
      SoundManager.setBossMusic(true, true);
    }

    // Boss Defeated!
    if (this.state.sharedBossHp <= 0) {
      this.handleVictory();
    } else {
      this.emit();
    }
  }

  private handleVictory(): void {
    this.stopTimer();
    this.state.status = 'victory';
    SoundManager.playBossDefeat();
    SoundManager.setBossMusic(false);
    PlayerProgressionManager.getInstance().setBossUpgrade(false);

    // Calculate player's share of bounty (minimum 10% for participating, up to proportional damage)
    const share = this.state.totalDamage > 0
      ? Math.max(0.12, Math.min(1.0, this.state.playerDamage / this.state.totalDamage))
      : 0.25;

    const payoutGc = Math.round(this.state.bountyGc * share);
    const payoutSc = Math.round(this.state.bountySc * share);

    // Call WalletService.applyServerBalances / creditRaidReward as required
    WalletService.creditRaidReward(payoutGc, payoutSc);

    // Tournament bonus points
    let tournamentScore = 0;
    if (this.state.tableMode === 'tournament') {
      tournamentScore = Math.round(this.state.playerDamage * 2 + payoutSc * 10);
      const uid = AuthManager.getInstance().getUid() || 'player_local';
      TournamentManager.addScore(uid, tournamentScore);
    }

    this.state.victoryBountyAwarded = {
      gc: payoutGc,
      sc: payoutSc,
      score: tournamentScore,
    };

    SoundManager.playCoinDrop('jackpot', payoutSc > 0 ? payoutSc : payoutGc);
    this.emit();

    // Schedule next boss raid in 20 seconds
    setTimeout(() => {
      if (TableSelectionManager.getInstance().isBossRaidAllowed()) {
        this.startTimedRaid();
      }
    }, 20000);
  }

  private handleTimeout(): void {
    this.stopTimer();
    this.state.status = 'failed';
    SoundManager.setBossMusic(false);
    PlayerProgressionManager.getInstance().setBossUpgrade(false);

    // Consolation reward if player dealt substantial damage
    if (this.state.playerDamage > 500) {
      const consolationGc = Math.round(this.state.bountyGc * 0.05);
      const consolationSc = Math.round(this.state.bountySc * 0.05);
      WalletService.creditRaidReward(consolationGc, consolationSc);
      this.state.victoryBountyAwarded = {
        gc: consolationGc,
        sc: consolationSc,
      };
    }

    this.emit();

    // Schedule next raid attempt in 25 seconds
    setTimeout(() => {
      if (TableSelectionManager.getInstance().isBossRaidAllowed()) {
        this.startTimedRaid();
      }
    }, 25000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public stopRaid(): void {
    this.stopTimer();
    this.state.active = false;
    this.state.status = 'idle';
    SoundManager.setBossMusic(false);
    PlayerProgressionManager.getInstance().setBossUpgrade(false);
  }

  public subscribe(listener: RaidListener): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const snap = this.getState();
    this.listeners.forEach((l) => l(snap));
  }
}
