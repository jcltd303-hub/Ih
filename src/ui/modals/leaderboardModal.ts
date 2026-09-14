import { TournamentManager } from '../../network/TournamentManager';
import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';

export function showLeaderboardModal(ctx: ModalContext): void {
const details = TournamentManager.getDetails();
    const sorted = TournamentManager.getLeaderboard('player_local');

    ctx.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #7c3aed; border-radius: 16px; padding: 24px; max-width: 480px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #a78bfa; margin: 0;">🏆 ${details.title}</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <div style="background: rgba(124, 58, 237, 0.15); border: 1px solid #7c3aed; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">PRIZE SYNDICATE</div>
            <div style="font-size: 16px; font-weight: bold; color: #fbbf24;">${details.prizePoolSC.toLocaleString()} SC</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">MIN BET</div>
            <div style="font-size: 14px; font-weight: bold; color: #00ffcc;">${details.minBetTier} SC</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          ${sorted.map(entry => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: ${entry.isPlayer ? 'rgba(124, 58, 237, 0.25)' : '#1e293b'}; border: 1px solid ${entry.isPlayer ? '#7c3aed' : '#334155'}; border-radius: 8px; padding: 10px 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 13px; font-weight: bold; color: ${entry.rank === 1 ? '#fbbf24' : entry.rank === 2 ? '#cbd5e1' : entry.rank === 3 ? '#b45309' : '#64748b'}; width: 24px;">#${entry.rank}</span>
                <span style="font-size: 13px; font-weight: 600; color: ${entry.isPlayer ? '#a78bfa' : '#ffffff'};">${entry.username}</span>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: 800; color: #00ffcc;">${entry.score.toLocaleString()} PTS</div>
                ${entry.prizeSC > 0 ? `<div style="font-size: 10px; color: #fbbf24; font-weight: bold;">+${entry.prizeSC} SC PRIZE</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button id="modal-close-btn-bottom" style="width: 100%; background: #7c3aed; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          DISMISS
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    ctx.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => ctx.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => ctx.closeModal());
  
}
