export interface TournamentEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  prizeSC: number;
  isPlayer?: boolean;
}

export interface TournamentDetails {
  id: string;
  title: string;
  prizePoolSC: number;
  timeRemainingSeconds: number;
  minBetTier: number;
}

export class TournamentManager {
  private static STORAGE_KEY = 'fish_frenzy_tournament_state';

  private static defaultEntries: { userId: string; username: string; score: number }[] = [
    { userId: 'bot_neon_apex', username: 'NeonApex', score: 14250 },
    { userId: 'bot_deepsea_whale', username: 'DeepSeaWhale', score: 9820 },
    { userId: 'bot_abyssal_hunter', username: 'AbyssalHunter', score: 7640 },
    { userId: 'bot_trench_raider', username: 'TrenchRaider', score: 5410 },
    { userId: 'player_local', username: 'You (NeonStriker)', score: 3820 },
    { userId: 'bot_cyber_shark', username: 'CyberShark', score: 2190 }
  ];

  public static getDetails(): TournamentDetails {
    return {
      id: 'abyssal_grand_prix_w37',
      title: 'Weekly Abyssal Trench Grand Prix',
      prizePoolSC: 1000,
      timeRemainingSeconds: 18420, // Live countdown
      minBetTier: 1
    };
  }

  public static getLeaderboard(currentUserId: string = 'player_local'): TournamentEntry[] {
    let entries = this.loadEntries();

    // Sort descending by score
    entries.sort((a, b) => b.score - a.score);

    const prizeTable: Record<number, number> = {
      1: 500,
      2: 300,
      3: 200
    };

    return entries.map((e, index) => {
      const rank = index + 1;
      return {
        userId: e.userId,
        username: e.username,
        score: e.score,
        rank,
        prizeSC: prizeTable[rank] || 0,
        isPlayer: e.userId === currentUserId
      };
    });
  }

  public static addScore(userId: string, points: number): void {
    const entries = this.loadEntries();
    const entry = entries.find(e => e.userId === userId);
    if (entry) {
      entry.score += Math.round(points);
    } else {
      entries.push({
        userId,
        username: userId === 'player_local' ? 'You (NeonStriker)' : userId,
        score: Math.round(points)
      });
    }
    this.saveEntries(entries);
  }

  private static loadEntries(): { userId: string; username: string; score: number }[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return JSON.parse(JSON.stringify(this.defaultEntries));
  }

  private static saveEntries(entries: { userId: string; username: string; score: number }[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('[TournamentManager] Failed to persist tournament state:', e);
    }
  }

  public static sortLeaderboard(entries: { userId: string; score: number }[]): { userId: string; score: number; rank: number }[] {
    return entries
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}
