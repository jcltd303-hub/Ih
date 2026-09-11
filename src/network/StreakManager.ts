import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './FirebaseClient';

export interface StreakStatus {
  currentStreak: number;
  lastClaimTimestamp: number;
  canClaim: boolean;
  nextRewardSC: number;
  timeRemainingMs: number;
}

export class StreakManager {
  private static LOCAL_KEY_PREFIX = 'fish_frenzy_streak_';
  private rewardTable = [1, 2, 3, 5, 7, 10, 15];

  private getLocalData(userId: string): { currentStreak: number; lastClaimTimestamp: number } {
    try {
      const raw = localStorage.getItem(StreakManager.LOCAL_KEY_PREFIX + userId);
      return raw ? JSON.parse(raw) : { currentStreak: 0, lastClaimTimestamp: 0 };
    } catch {
      return { currentStreak: 0, lastClaimTimestamp: 0 };
    }
  }

  private setLocalData(userId: string, data: { currentStreak: number; lastClaimTimestamp: number }): void {
    try {
      localStorage.setItem(StreakManager.LOCAL_KEY_PREFIX + userId, JSON.stringify(data));
    } catch (e) {
      console.error('[StreakManager] Failed to persist local streak data:', e);
    }
  }

  public async getStreakStatus(userId: string): Promise<StreakStatus> {
    const now = Date.now();
    const oneDayMs = 86400000;
    let currentStreak = 0;
    let lastClaim = 0;

    // Try Firestore first, fallback to localStorage
    try {
      const userRef = doc(db, 'users', userId, 'rewards', 'streak_protocol');
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        currentStreak = data.currentStreak || 0;
        lastClaim = data.lastClaimTimestamp || 0;
      } else {
        const local = this.getLocalData(userId);
        currentStreak = local.currentStreak;
        lastClaim = local.lastClaimTimestamp;
      }
    } catch {
      const local = this.getLocalData(userId);
      currentStreak = local.currentStreak;
      lastClaim = local.lastClaimTimestamp;
    }

    const timeDiff = now - lastClaim;
    const canClaim = lastClaim === 0 || timeDiff >= oneDayMs;
    const timeRemainingMs = canClaim ? 0 : Math.max(0, oneDayMs - timeDiff);

    let nextStreak = currentStreak;
    if (canClaim) {
      if (lastClaim === 0 || timeDiff >= oneDayMs * 2) {
        nextStreak = 1;
      } else {
        nextStreak = Math.min(7, currentStreak + 1);
      }
    }

    const nextRewardSC = this.rewardTable[Math.max(0, (nextStreak || 1) - 1)];

    return {
      currentStreak,
      lastClaimTimestamp: lastClaim,
      canClaim,
      nextRewardSC,
      timeRemainingMs
    };
  }

  public async claimDailyLoginReward(userId: string): Promise<{ success: boolean; rewardSC: number; streak: number }> {
    const status = await this.getStreakStatus(userId);
    const now = Date.now();
    const oneDayMs = 86400000;

    if (!status.canClaim) {
      const hoursLeft = Math.ceil(status.timeRemainingMs / 3600000);
      throw new Error(`Daily reward already claimed. Next claim available in ~${hoursLeft}h.`);
    }

    let newStreak = 1;
    if (status.lastClaimTimestamp > 0 && (now - status.lastClaimTimestamp) < oneDayMs * 2) {
      newStreak = Math.min(7, status.currentStreak + 1);
    }

    const rewardSC = this.rewardTable[newStreak - 1];

    // Save locally
    this.setLocalData(userId, { currentStreak: newStreak, lastClaimTimestamp: now });

    // Try cloud sync
    try {
      const userRef = doc(db, 'users', userId, 'rewards', 'streak_protocol');
      await setDoc(userRef, {
        currentStreak: newStreak,
        lastClaimTimestamp: now
      }, { merge: true });
    } catch (e) {
      console.warn('[StreakManager] Cloud sync deferred (local progress saved):', e);
    }

    console.log(`[StreakManager] User ${userId} claimed Day ${newStreak} reward: ${rewardSC} SC`);
    return { success: true, rewardSC, streak: newStreak };
  }
}
