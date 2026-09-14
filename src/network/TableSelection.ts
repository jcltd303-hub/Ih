import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { rtdb, isFirebaseConfigured } from './FirebaseClient';
import { AuthManager } from './AuthManager';

export type TableType = 'public' | 'practice' | 'tournament';

export interface TableInfo {
  id: string;
  name: string;
  type: TableType;
  playerCount: number;
  minBet: number;
  maxBet: number;
  isPractice: boolean;
  requiresAuth: boolean;
}

/**
 * Table registry and selection.
 * - Public: real SC/GC, server-authoritative, requires auth
 * - Practice: free chips, client-local, no auth needed
 * - Tournament: scheduled events, entry fee, leaderboard
 */
export class TableSelection {
  private static instance: TableSelection | null = null;
  private tables: TableInfo[] = [
    {
      id: 'abyssal_trench_public',
      name: 'Abyssal Trench',
      type: 'public',
      playerCount: 0,
      minBet: 0.05,
      maxBet: 10,
      isPractice: false,
      requiresAuth: true
    },
    {
      id: 'coral_reef_practice',
      name: 'Coral Reef (Practice)',
      type: 'practice',
      playerCount: 0,
      minBet: 0,
      maxBet: 0,
      isPractice: true,
      requiresAuth: false
    },
    {
      id: 'deep_sea_tournament',
      name: 'Deep Sea Tournament',
      type: 'tournament',
      playerCount: 0,
      minBet: 1,
      maxBet: 5,
      isPractice: false,
      requiresAuth: true
    }
  ];
  private currentTableId: string = 'coral_reef_practice';
  private unsubPlayerCounts?: () => void;

  public static getInstance(): TableSelection {
    if (!this.instance) this.instance = new TableSelection();
    return this.instance;
  }

  public getTables(): TableInfo[] {
    return this.tables.map(t => ({ ...t }));
  }

  public getCurrentTable(): TableInfo {
    return this.tables.find(t => t.id === this.currentTableId) || this.tables[0];
  }

  public isPractice(): boolean {
    return this.getCurrentTable().isPractice;
  }

  public requiresAuth(): boolean {
    return this.getCurrentTable().requiresAuth;
  }

  public async selectTable(tableId: string): Promise<boolean> {
    const table = this.tables.find(t => t.id === tableId);
    if (!table) return false;

    if (table.requiresAuth) {
      const auth = AuthManager.getInstance().getState();
      if (!auth.user) {
        console.warn('[TableSelection] Auth required for', tableId);
        return false;
      }
    }

    this.currentTableId = tableId;
    this.startListeningPlayerCounts();
    return true;
  }

  private startListeningPlayerCounts(): void {
    if (!isFirebaseConfigured) return;
    this.unsubPlayerCounts?.();

    try {
      const tablesRef = ref(rtdb, 'tables');
      this.unsubPlayerCounts = onValue(tablesRef, (snap) => {
        const data = snap.val() || {};
        for (const table of this.tables) {
          const players = data[table.id]?.players;
          table.playerCount = players ? Object.keys(players).length : 0;
        }
      });
    } catch (e) {
      console.warn('[TableSelection] Player count listener failed', e);
    }
  }

  public joinPresence(userId: string, username: string): void {
    if (!isFirebaseConfigured) return;
    const table = this.getCurrentTable();
    try {
      const playerRef = ref(rtdb, `tables/${table.id}/players/${userId}`);
      set(playerRef, { userId, username, joinedAt: Date.now() });
      onDisconnect(playerRef).remove();
    } catch (e) {
      console.warn('[TableSelection] Presence join failed', e);
    }
  }

  public dispose(): void {
    this.unsubPlayerCounts?.();
  }
}
