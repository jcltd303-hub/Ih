import { set, get } from 'idb-keyval';

export interface QueuedShot {
  id: string;
  userId: string;
  sessionId: string;
  currencyType: 'GC' | 'SC';
  betAmount: number;
  targetId: string;
  clientHitConfirmed: boolean;
  timestamp: number;
}

export class OfflineTransactionQueue {
  private static STORAGE_KEY = 'fish_frenzy_offline_queue';
  private static instance: OfflineTransactionQueue | null = null;
  private isFlushing: boolean = false;
  private syncCallback?: (shot: QueuedShot) => Promise<boolean>;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineQueue] Network online event received. Triggering auto-sync...');
        if (this.syncCallback) {
          this.flushQueue(this.syncCallback);
        }
      });
    }
  }

  public static getInstance(): OfflineTransactionQueue {
    if (!this.instance) {
      this.instance = new OfflineTransactionQueue();
    }
    return this.instance;
  }

  public setSyncHandler(handler: (shot: QueuedShot) => Promise<boolean>): void {
    this.syncCallback = handler;
  }

  public async enqueueShot(shot: Omit<QueuedShot, 'id' | 'timestamp'>): Promise<string> {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newShot: QueuedShot = {
      ...shot,
      id,
      timestamp: Date.now()
    };

    try {
      const queue: QueuedShot[] = (await get(OfflineTransactionQueue.STORAGE_KEY)) || [];
      queue.push(newShot);
      await set(OfflineTransactionQueue.STORAGE_KEY, queue);
      console.warn(`[OfflineQueue] Transaction cached locally in IndexedDB: ${id} (${queue.length} pending)`);
    } catch (err) {
      console.error('[OfflineQueue] Critical failure writing to IndexedDB storage:', err);
    }
    return id;
  }

  public static async enqueue(shot: Omit<QueuedShot, 'id' | 'timestamp'>): Promise<string> {
    return this.getInstance().enqueueShot(shot);
  }

  public async getPendingCount(): Promise<number> {
    try {
      const queue: QueuedShot[] = (await get(OfflineTransactionQueue.STORAGE_KEY)) || [];
      return queue.length;
    } catch {
      return 0;
    }
  }

  public async getPendingShots(): Promise<QueuedShot[]> {
    try {
      return (await get(OfflineTransactionQueue.STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  public async flushQueue(syncCallback?: (shot: QueuedShot) => Promise<boolean>): Promise<number> {
    if (this.isFlushing) return 0;
    const callback = syncCallback || this.syncCallback;
    if (!callback) return 0;

    this.isFlushing = true;
    let syncedCount = 0;

    try {
      const queue: QueuedShot[] = (await get(OfflineTransactionQueue.STORAGE_KEY)) || [];
      if (queue.length === 0) {
        this.isFlushing = false;
        return 0;
      }

      console.log(`[OfflineQueue] Reconnection established. Flushing ${queue.length} cached transactions...`);
      const remainingQueue: QueuedShot[] = [];

      for (const shot of queue) {
        try {
          const success = await callback(shot);
          if (success) {
            syncedCount++;
          } else {
            remainingQueue.push(shot);
          }
        } catch {
          remainingQueue.push(shot);
        }
      }

      await set(OfflineTransactionQueue.STORAGE_KEY, remainingQueue);
      console.log(`[OfflineQueue] Flush complete. Synced: ${syncedCount}, Remaining: ${remainingQueue.length}`);
    } catch (err) {
      console.error('[OfflineQueue] Error flushing offline transaction queue:', err);
    } finally {
      this.isFlushing = false;
    }

    return syncedCount;
  }

  public static async flush(syncCallback?: (shot: QueuedShot) => Promise<boolean>): Promise<number> {
    return this.getInstance().flushQueue(syncCallback);
  }
}
