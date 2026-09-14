import { ref, set, onValue, push, onDisconnect } from 'firebase/database';
import { rtdb } from './FirebaseClient';

export interface TablePlayer {
  userId: string;
  username: string;
  betTier: number;
  x: number;
  y: number;
  lastActive: number;
}

export class MultiplayerTableManager {
  private activeTableId: string | null = null;
  private localPlayer: TablePlayer | null = null;
  private connectionSub?: () => void;
  private lastShotBroadcastMs = 0;
  private static readonly MIN_SHOT_INTERVAL_MS = 80;

  constructor() {
    this.initConnectionMonitor();
  }

  private initConnectionMonitor(): void {
    try {
      const connectedRef = ref(rtdb, '.info/connected');
      onValue(connectedRef, (snap) => {
        const isConnected = snap.val() === true;
        if (isConnected && this.activeTableId && this.localPlayer) {
          console.log('[MultiplayerTableManager] RTDB connection established/restored. Re-registering presence...');
          this.registerPresence(this.activeTableId, this.localPlayer);
        }
      });
    } catch (e) {
      console.warn('[MultiplayerTableManager] RTDB connection monitor fallback:', e);
    }
  }

  public joinSharedTable(tableId: string, userId: string, username: string): void {
    this.activeTableId = tableId;
    this.localPlayer = {
      userId,
      username,
      betTier: 5,
      x: 400,
      y: 700,
      lastActive: Date.now()
    };

    this.registerPresence(tableId, this.localPlayer);
  }

  private registerPresence(tableId: string, player: TablePlayer): void {
    try {
      const playerRef = ref(rtdb, `tables/${tableId}/players/${player.userId}`);
      set(playerRef, player);
      onDisconnect(playerRef).remove();
    } catch (e) {
      console.warn('[MultiplayerTableManager] Live RTDB connection offline (using client fallback):', e);
    }
  }

  public updateLocalAim(x: number, y: number): void {
    if (!this.activeTableId || !this.localPlayer) return;
    this.localPlayer.x = x;
    this.localPlayer.y = y;
    this.localPlayer.lastActive = Date.now();
    try {
      const playerRef = ref(rtdb, `tables/${this.activeTableId}/players/${this.localPlayer.userId}`);
      set(playerRef, this.localPlayer);
    } catch {
      /* offline */
    }
  }

  public broadcastTableShot(tableId: string, userId: string, targetX: number, targetY: number, bet: number): void {
    const now = Date.now();
    if (now - this.lastShotBroadcastMs < MultiplayerTableManager.MIN_SHOT_INTERVAL_MS) {
      return;
    }
    if (!(bet > 0) || bet > 1000 || !Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return;
    }
    this.lastShotBroadcastMs = now;
    try {
      const shotsRef = ref(rtdb, `tables/${tableId}/shared_shots`);
      push(shotsRef, {
        userId,
        targetX,
        targetY,
        bet,
        timestamp: now
      });
    } catch (e) {
      console.warn('[MultiplayerTableManager] Shot broadcast fallback:', e);
    }
  }

  public subscribeToTableState(tableId: string, onStateUpdate: (state: any) => void): () => void {
    try {
      const tableRef = ref(rtdb, `tables/${tableId}`);
      const unsubscribe = onValue(tableRef, (snapshot) => {
        if (snapshot.exists()) {
          onStateUpdate(snapshot.val());
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('[MultiplayerTableManager] Subscription fallback:', e);
      return () => {};
    }
  }
}
