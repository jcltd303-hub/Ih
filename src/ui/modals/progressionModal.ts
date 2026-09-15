import { PlayerProgressionManager, LEVEL_MILESTONES } from '../../engine/systems/PlayerProgressionManager';
import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';

export function showProgressionModal(ctx: ModalContext): void {
  SoundManager.playUiSound('modal_open');
  const prog = PlayerProgressionManager.getInstance().getState();

  ctx.modalContainer.innerHTML = `
    <div style="background: #0b1224; border: 2px solid #a855f7; border-radius: 0; padding: 22px; max-width: 580px; width: 100%; color: #e2e8f0; box-shadow: 0 20px 50px rgba(0,0,0,0.85); max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 24px; background: rgba(168,85,247,0.2); border: 1.5px solid #a855f7; border-radius: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            ⭐
          </div>
          <div>
            <div style="font-size: 10px; letter-spacing: 2.5px; color: #c084fc; font-weight: 800;">PILOT PROGRESSION</div>
            <h2 style="margin: 2px 0 0; font-size: 20px; font-weight: 900; color: #ffffff;">SKILL LEVEL &amp; TURRET SYSTEM</h2>
          </div>
        </div>
        <button id="prog-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; padding: 4px;">✕</button>
      </div>

      <!-- CURRENT LEVEL HERO CARD -->
      <div style="background: rgba(30,27,75,0.85); border: 1.5px solid #a855f7; border-radius: 0; padding: 16px; margin-bottom: 16px; box-shadow: 3px 3px 0 #020617;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <span style="font-size: 11px; font-weight: 900; padding: 3px 8px; border-radius: 6px; background: #a855f7; color: #ffffff; letter-spacing: 0.5px;">
              LEVEL ${prog.level}
            </span>
            <span style="font-size: 14px; font-weight: 900; color: #ffffff; margin-left: 8px;">${prog.title.toUpperCase()}</span>
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #c084fc;">
            ${prog.xp.toLocaleString()} TOTAL XP
          </div>
        </div>

        <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 8px;">
          Equipped Turret: <strong style="color: #38bdf8;">${prog.turretName}</strong>
        </div>

        <!-- Progress Bar -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-bottom: 4px; font-weight: 700;">
            <span>PROGRESSION TO NEXT TIER</span>
            <span>${prog.currentLevelXp} / ${prog.nextLevelXp} XP (${prog.progressPct}%)</span>
          </div>
          <div style="width: 100%; height: 8px; background: #1e293b; border-radius: 0; overflow: hidden; border: 1px solid #334155;">
            <div style="width: ${prog.progressPct}%; height: 100%; background: #a855f7; border-radius: 0; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Overcharge / Lucky Shot Feature Info -->
        <div style="margin-top: 12px; padding: 10px 12px; background: rgba(15,23,42,0.8); border: 1px solid #475569; border-radius: 0; font-size: 11px; line-height: 1.45;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px; font-weight: 800; color: #fbbf24;">
            <span>⚡ LUCKY SHOT OVERCHARGE &amp; BOSS OVERDRIVE</span>
          </div>
          <p style="margin: 0; color: #94a3b8;">
            Every shot and fish kill has a lucky chance to overcharge your turret for 4.5 seconds (2x firing rate, +40% damage, Sovereign chassis). During boss events, your cannon receives automatic Overdrive!
          </p>
        </div>
      </div>

      <!-- LEVEL MILESTONES LADDER -->
      <div style="font-size: 11px; letter-spacing: 1.5px; color: #a855f7; font-weight: 800; margin-bottom: 10px;">
        RANK &amp; CHASSIS UNLOCK LADDER
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        ${LEVEL_MILESTONES.map((m) => {
          const isUnlocked = prog.level >= m.level;
          const isCurrent = prog.level === m.level;
          return `
            <div style="
              display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 0;
              background: ${isCurrent ? 'rgba(168,85,247,0.15)' : isUnlocked ? 'rgba(30,41,59,0.7)' : '#0f172a'};
              border: 1px solid ${isCurrent ? '#a855f7' : isUnlocked ? '#334155' : '#1e293b'};
              opacity: ${isUnlocked ? '1' : '0.6'};
            ">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="
                  font-size: 11px; font-weight: 900; width: 26px; height: 26px; border-radius: 50%;
                  display: flex; align-items: center; justify-content: center;
                  background: ${isCurrent ? '#a855f7' : isUnlocked ? '#3b82f6' : '#1e293b'};
                  color: #ffffff;
                ">
                  ${m.level}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 800; color: #ffffff;">${m.title}</span>
                    <span style="font-size: 9px; font-weight: 700; color: #94a3b8; font-family: monospace;">(${m.xpRequired.toLocaleString()} XP)</span>
                  </div>
                  <div style="font-size: 11px; color: #38bdf8; font-weight: 700;">${m.turretName}</div>
                  <div style="font-size: 10px; color: #94a3b8;">${m.perks}</div>
                </div>
              </div>
              <div>
                <span style="
                  font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 6px;
                  background: ${isCurrent ? '#a855f7' : isUnlocked ? 'rgba(52,211,153,0.15)' : 'rgba(100,116,139,0.2)'};
                  color: ${isCurrent ? '#ffffff' : isUnlocked ? '#34d399' : '#64748b'};
                  border: 1px solid ${isCurrent ? '#a855f7' : isUnlocked ? '#059669' : '#334155'};
                ">
                  ${isCurrent ? 'ACTIVE CHASSIS' : isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <button id="prog-done-btn" style="background: #a855f7; border: none; color: #ffffff; padding: 9px 20px; border-radius: 0; font-weight: 800; font-size: 12px; cursor: pointer; letter-spacing: 0.5px;">
          RESUME COMBAT
        </button>
      </div>
    </div>
  `;

  ctx.modalContainer.style.display = 'flex';

  const close = () => {
    ctx.modalContainer.style.display = 'none';
    ctx.modalContainer.innerHTML = '';
  };

  ctx.modalContainer.querySelector('#prog-close-btn')?.addEventListener('click', close);
  ctx.modalContainer.querySelector('#prog-done-btn')?.addEventListener('click', close);
}
