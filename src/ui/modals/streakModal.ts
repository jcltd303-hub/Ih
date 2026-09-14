import { StreakManager } from '../../network/StreakManager';
import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';

export async function showStreakModal(ctx: ModalContext): Promise<void> {
const streakManager = new StreakManager();
    const status = await streakManager.getStreakStatus('player_local');
    const rewards = [1, 2, 3, 5, 7, 10, 15];

    ctx.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; max-width: 440px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #fbbf24; margin: 0;">⚡ 7-DAY STREAK PROTOCOL</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 18px; line-height: 1.5;">
          Current Streak: <strong style="color: #fbbf24;">Day ${status.currentStreak} / 7</strong>. Active daily check-in unlocks up to 15 SC on Day 7.
        </p>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 20px;">
          ${rewards.map((sc, i) => {
            const isCurrentDay = i + 1 === status.currentStreak;
            const isCompleted = i + 1 < status.currentStreak;
            const bg = isCurrentDay ? 'rgba(245, 158, 11, 0.3)' : isCompleted ? 'rgba(16, 185, 129, 0.2)' : '#1e293b';
            const border = isCurrentDay ? '#f59e0b' : isCompleted ? '#10b981' : '#334155';
            return `
              <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 8px 4px; text-align: center;">
                <div style="font-size: 10px; color: ${isCompleted ? '#34d399' : '#94a3b8'};">${isCompleted ? '✓' : `D${i + 1}`}</div>
                <div style="font-size: 12px; font-weight: bold; color: #fbbf24; margin-top: 2px;">+${sc}</div>
              </div>
            `;
          }).join('')}
        </div>
        <button id="modal-claim-streak-btn" ${status.canClaim ? '' : 'disabled'} style="width: 100%; background: ${status.canClaim ? '#f59e0b' : '#334155'}; color: ${status.canClaim ? '#000000' : '#64748b'}; font-weight: 800; padding: 12px; border-radius: 8px; border: none; cursor: ${status.canClaim ? 'pointer' : 'not-allowed'}; font-size: 14px; transition: all 0.2s;">
          ${status.canClaim ? `CLAIM TODAY'S REWARD (+${status.nextRewardSC} SC)` : `TODAY'S REWARD CLAIMED (DAY ${status.currentStreak})`}
        </button>
        <div id="modal-streak-status" style="font-size: 12px; color: #34d399; margin-top: 12px; text-align: center;"></div>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    ctx.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => ctx.closeModal());
    document.getElementById('modal-claim-streak-btn')?.addEventListener('click', async () => {
      if (!status.canClaim) return;
      try {
        const res = await streakManager.claimDailyLoginReward('player_local');
        ctx.addBalance(0, res.rewardSC);
        SoundManager.playCoinDrop('medium', res.rewardSC);
        const statusEl = document.getElementById('modal-streak-status');
        if (statusEl) statusEl.textContent = `✓ Successfully claimed ${res.rewardSC} SC! Day ${res.streak} active.`;
        const claimBtn = document.getElementById('modal-claim-streak-btn') as HTMLButtonElement;
        if (claimBtn) {
          claimBtn.disabled = true;
          claimBtn.style.background = '#334155';
          claimBtn.style.color = '#64748b';
          claimBtn.textContent = `TODAY'S REWARD CLAIMED (DAY ${res.streak})`;
        }
      } catch (e: any) {
        const statusEl = document.getElementById('modal-streak-status');
        if (statusEl) statusEl.textContent = `⚠️ ${e?.message || 'Reward already claimed.'}`;
      }
    });
  
}
