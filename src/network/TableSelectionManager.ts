import { AuthManager } from './AuthManager';

export type TableMode = 'practice' | 'public' | 'tournament';

export interface TableConfig {
  id: string;
  name: string;
  mode: TableMode;
  tagline: string;
  description: string;
  badge: string;
  badgeColor: string;
  allowedCurrencies: ('GC' | 'SC')[];
  minStake: number;
  bossRaidEnabled: boolean;
  bossRaidDurationSec: number;
  requiresAuth: boolean;
  maxPlayers: number;
  activePlayersCount: number;
}

export const AVAILABLE_TABLES: TableConfig[] = [
  {
    id: 'table_practice',
    name: 'Practice Trench',
    mode: 'practice',
    tagline: 'Solo Sandbox & Trajectory Training',
    description: 'Zero-risk practice sandbox. Test ricochet angles, turret skins, and fish speeds without wagering real balance.',
    badge: 'PRACTICE',
    badgeColor: '#10b981',
    allowedCurrencies: ['GC'],
    minStake: 1,
    bossRaidEnabled: true,
    bossRaidDurationSec: 90,
    requiresAuth: false,
    maxPlayers: 1,
    activePlayersCount: 1,
  },
  {
    id: 'table_public',
    name: 'Abyssal Trench 01',
    mode: 'public',
    tagline: 'Live Multiplayer & Co-op Raids',
    description: 'Real-time multiplayer trench with shared player presence, ricochet tracers, and automated 90s Leviathan Boss Raids.',
    badge: 'PUBLIC LIVE',
    badgeColor: '#00ffcc',
    allowedCurrencies: ['GC', 'SC'],
    minStake: 0.1,
    bossRaidEnabled: true,
    bossRaidDurationSec: 90,
    requiresAuth: true,
    maxPlayers: 8,
    activePlayersCount: 4,
  },
  {
    id: 'table_tournament',
    name: 'Grand Prix Arena',
    mode: 'tournament',
    tagline: 'Competitive Sweepstakes Arena',
    description: 'High-roller leaderboard competition for the 1,000 SC prize pool. Boss raids yield 2x tournament score points.',
    badge: 'TOURNAMENT',
    badgeColor: '#f59e0b',
    allowedCurrencies: ['SC'],
    minStake: 1.0,
    bossRaidEnabled: true,
    bossRaidDurationSec: 90,
    requiresAuth: true,
    maxPlayers: 12,
    activePlayersCount: 9,
  },
];

type TableChangeListener = (table: TableConfig) => void;

export class TableSelectionManager {
  private static instance: TableSelectionManager | null = null;
  private static readonly STORAGE_KEY = 'fish_frenzy_selected_table_id';

  // Default to practice table as specified
  private currentTableId: string = 'table_practice';
  private listeners: TableChangeListener[] = [];

  private constructor() {
    try {
      const saved = localStorage.getItem(TableSelectionManager.STORAGE_KEY);
      if (saved && AVAILABLE_TABLES.some((t) => t.id === saved)) {
        this.currentTableId = saved;
      }
    } catch {
      this.currentTableId = 'table_practice';
    }
  }

  public static getInstance(): TableSelectionManager {
    if (!this.instance) {
      this.instance = new TableSelectionManager();
    }
    return this.instance;
  }

  public getTables(): TableConfig[] {
    return [...AVAILABLE_TABLES];
  }

  public getActiveTable(): TableConfig {
    const found = AVAILABLE_TABLES.find((t) => t.id === this.currentTableId);
    return found || AVAILABLE_TABLES[0];
  }

  public isBossRaidAllowed(): boolean {
    const active = this.getActiveTable();
    return active.bossRaidEnabled && active.mode !== 'practice';
  }

  public async switchTable(tableId: string): Promise<{ success: boolean; reason?: string }> {
    const target = AVAILABLE_TABLES.find((t) => t.id === tableId);
    if (!target) {
      return { success: false, reason: 'Invalid table ID.' };
    }

    if (target.requiresAuth) {
      const authState = AuthManager.getInstance().getState();
      const hasAuth = authState.user !== null || authState.ready;
      if (!hasAuth) {
        try {
          await AuthManager.getInstance().ensureSignedIn();
        } catch {
          return {
            success: false,
            reason: 'Authentication required to join live public/tournament tables.',
          };
        }
      }
    }

    this.currentTableId = tableId;
    try {
      localStorage.setItem(TableSelectionManager.STORAGE_KEY, tableId);
    } catch {
      /* ignore */
    }

    const current = this.getActiveTable();
    this.listeners.forEach((l) => l(current));
    return { success: true };
  }

  public onTableChange(listener: TableChangeListener): () => void {
    this.listeners.push(listener);
    listener(this.getActiveTable());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
