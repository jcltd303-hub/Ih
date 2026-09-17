import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineTransactionQueue, QueuedShot } from './OfflineTransactionQueue';
import * as idbKeyval from 'idb-keyval';

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

describe('OfflineTransactionQueue', () => {
  let queue: OfflineTransactionQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = OfflineTransactionQueue.getInstance();
  });

  it('should enqueue a shot successfully', async () => {
    const mockShot = {
      userId: 'testUser',
      sessionId: 'session1',
      currencyType: 'GC' as const,
      betAmount: 10,
      targetId: 'fish1',
      clientHitConfirmed: true,
    };

    (idbKeyval.get as any).mockResolvedValue([]);
    (idbKeyval.set as any).mockResolvedValue(undefined);

    const shotId = await queue.enqueueShot(mockShot);
    expect(shotId).toContain('offline_');
    expect(idbKeyval.set).toHaveBeenCalledTimes(1);
    const setArgs = (idbKeyval.set as any).mock.calls[0];
    expect(setArgs[1]).toHaveLength(1);
    expect(setArgs[1][0].userId).toBe('testUser');
  });

  it('should flush queue correctly', async () => {
    const mockShot: QueuedShot = {
      id: 'offline_123',
      userId: 'testUser',
      sessionId: 'session1',
      currencyType: 'GC' as const,
      betAmount: 10,
      targetId: 'fish1',
      clientHitConfirmed: true,
      timestamp: Date.now(),
    };

    (idbKeyval.get as any).mockResolvedValue([mockShot]);
    (idbKeyval.set as any).mockResolvedValue(undefined);

    const mockSyncHandler = vi.fn().mockResolvedValue(true);
    const syncedCount = await queue.flushQueue(mockSyncHandler);

    expect(syncedCount).toBe(1);
    expect(mockSyncHandler).toHaveBeenCalledWith(mockShot);
    expect(idbKeyval.set).toHaveBeenCalledWith('fish_frenzy_offline_queue', []);
  });
});
