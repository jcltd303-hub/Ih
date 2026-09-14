import { PayoutEngine } from '../../engine/systems/PayoutEngine';
import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';

export function showAdminPortalModal(ctx: ModalContext): void {
const config = PayoutEngine.getConfig();
    const stats = PayoutEngine.getSessionStats();

    const getLoosenessTier = (rtp: number) => {
      if (rtp < 75) return { label: '🔒 TIGHT', desc: 'High House Margin (25%+ Edge) • Conservative payouts & lower capture odds', color: '#ef4444' };
      if (rtp < 86) return { label: '⚖️ CONSERVATIVE', desc: 'Arcade Standard (~15-25% Edge) • Moderate hit frequency', color: '#f59e0b' };
      if (rtp <= 94) return { label: '🎰 STANDARD VEGAS', desc: 'Casino Floor (92% Baseline) • Balanced volatility & instant captures', color: '#38bdf8' };
      if (rtp <= 100) return { label: '🔥 VERY LOOSE', desc: 'Player Advantageous (95-100%) • Generous gamble capture rate & crits', color: '#34d399' };
      return { label: '💥 PROMO FRENZY', desc: 'Promotional / VIP Rush (>100%) • Operator subsidy / High capture frequency', color: '#ec4899' };
    };

    const initialTier = getLoosenessTier(config.targetRtp);

    ctx.modalContainer.innerHTML = `
      <div style="background: #0b1120; border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; max-width: 580px; width: 100%; color: #ffffff; box-shadow: 0 16px 48px rgba(0,0,0,0.85); max-height: 90vh; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #fbbf24; margin: 0; display: flex; align-items: center; gap: 8px;">
              ⚙️ OPERATOR ADMIN PORTAL
            </h2>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
              GAME LOOSENESS & GAMBLE MATH ENGINE CALIBRATOR
            </div>
          </div>
          <button id="modal-close-btn" style="background: #1e293b; border: 1px solid #334155; color: #94a3b8; width: 32px; height: 32px; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
        </div>

        <!-- Main Looseness Slider Card -->
        <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
            <div>
              <div style="font-size: 11px; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">GAME LOOSENESS (TARGET PAYOUT %)</div>
              <div id="admin-tier-badge" style="font-size: 12px; font-weight: 800; color: ${initialTier.color}; margin-top: 3px;">
                ${initialTier.label} — <span style="font-weight: normal; font-size: 11px; color: #cbd5e1;">${initialTier.desc}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <span id="admin-slider-val" style="font-size: 28px; font-weight: 900; color: ${initialTier.color}; font-family: monospace;">
                ${config.targetRtp}%
              </span>
            </div>
          </div>

          <!-- Slider -->
          <div style="margin: 14px 0 10px 0;">
            <input
              type="range"
              id="admin-rtp-slider"
              min="50"
              max="120"
              step="1"
              value="${config.targetRtp}"
              style="width: 100%; height: 8px; cursor: pointer; accent-color: #f59e0b; border-radius: 4px;"
            />
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 4px;">
              <span>50% (Tightest)</span>
              <span>75% (Arcade)</span>
              <span>92% (Standard)</span>
              <span>100% (Break-Even)</span>
              <span>120% (Max Loose)</span>
            </div>
          </div>

          <!-- Presets -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
            <button class="admin-preset-btn" data-rtp="70" style="background: #1e293b; color: #ef4444; border: 1px solid #7f1d1d; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              🔒 Tight (70%)
            </button>
            <button class="admin-preset-btn" data-rtp="82" style="background: #1e293b; color: #f59e0b; border: 1px solid #78350f; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              ⚖️ Arcade (82%)
            </button>
            <button class="admin-preset-btn" data-rtp="92" style="background: #1e293b; color: #38bdf8; border: 1px solid #0369a1; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              🎰 Vegas (92%)
            </button>
            <button class="admin-preset-btn" data-rtp="96" style="background: #1e293b; color: #34d399; border: 1px solid #065f46; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              🔥 Loose (96%)
            </button>
            <button class="admin-preset-btn" data-rtp="105" style="background: #1e293b; color: #ec4899; border: 1px solid #831843; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              💥 Promo (105%)
            </button>
          </div>
        </div>

        <!-- Gamble Mechanics Toggles -->
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; margin-bottom: 10px; text-transform: uppercase;">
            🎲 GAMBLE MECHANICS TOGGLES
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer;">
              <span>⚡ <strong>Instant Gamble Kill Roll</strong> <span style="color: #64748b; font-size: 11px;">(RNG roll allows any bullet to instantly explode target)</span></span>
              <input type="checkbox" id="admin-gamble-kill-toggle" ${config.gambleKillEnabled ? 'checked' : ''} style="accent-color: #00ffcc; width: 16px; height: 16px; cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer;">
              <span>🎯 <strong>Jackpot Multipliers on Catch</strong> <span style="color: #64748b; font-size: 11px;">(Surprise 2x, 5x, 10x surge on fish capture)</span></span>
              <input type="checkbox" id="admin-bonus-mult-toggle" ${config.gambleBonusMultiplierEnabled ? 'checked' : ''} style="accent-color: #fbbf24; width: 16px; height: 16px; cursor: pointer;" />
            </label>
          </div>
        </div>

        <!-- Live Session Telemetry -->
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">
              📊 LIVE AUDIT TELEMETRY
            </div>
            <button id="admin-reset-stats-btn" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">
              🔄 RESET STATS
            </button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px;">
            <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b;">TOTAL WAGERED</div>
              <div id="admin-stat-wagered" style="font-size: 13px; font-weight: bold; color: #ffffff;">${stats.totalWagered.toFixed(2)} SC</div>
            </div>
            <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b;">TOTAL PAID OUT</div>
              <div id="admin-stat-payout" style="font-size: 13px; font-weight: bold; color: #34d399;">${stats.totalPaidOut.toFixed(2)} SC</div>
            </div>
            <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b;">REALIZED RTP</div>
              <div id="admin-stat-rtp" style="font-size: 13px; font-weight: 800; color: ${stats.realizedRtp > 100 ? '#ec4899' : stats.realizedRtp >= 85 ? '#34d399' : '#f59e0b'};">
                ${stats.realizedRtp.toFixed(2)}%
              </div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px;">
            <div style="color: #94a3b8;">Shots: <strong id="admin-stat-shots" style="color: #ffffff;">${stats.totalShots}</strong></div>
            <div style="color: #94a3b8;">Hits: <strong id="admin-stat-hits" style="color: #38bdf8;">${stats.totalHits}</strong></div>
            <div style="color: #94a3b8;">Gamble Kills: <strong id="admin-stat-gk" style="color: #00ffcc;">${stats.instantGambleKills}</strong></div>
            <div style="color: #94a3b8;">Jackpots: <strong id="admin-stat-jp" style="color: #fbbf24;">${stats.bonusJackpotTriggers}</strong></div>
          </div>
        </div>

        <!-- Monte Carlo In-Browser Simulation Test -->
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">
              ⚡ MONTE CARLO RTP BENCHMARK
            </div>
            <button id="admin-run-sim-btn" style="background: #0284c7; color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
              SIMULATE 10,000 SHOTS
            </button>
          </div>
          <div id="admin-sim-output" style="font-size: 11px; color: #cbd5e1; background: #1e293b; padding: 8px 12px; border-radius: 6px; min-height: 22px; line-height: 1.4;">
            Click button above to benchmark the current looseness setting empirically across 10,000 algorithmic rounds.
          </div>
        </div>

        <!-- Status Toast -->
        <div id="admin-save-toast" style="font-size: 11px; color: #34d399; text-align: center; height: 18px; margin-bottom: 8px; font-weight: 700;"></div>

        <button id="modal-close-btn-bottom" style="width: 100%; background: #334155; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          CLOSE ADMIN PORTAL
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    ctx.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => ctx.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => ctx.closeModal());

    const slider = document.getElementById('admin-rtp-slider') as HTMLInputElement;
    const sliderVal = document.getElementById('admin-slider-val');
    const tierBadge = document.getElementById('admin-tier-badge');
    const saveToast = document.getElementById('admin-save-toast');
    const hudBadge = document.getElementById('hud-admin-rtp-badge');

    const updateLooseness = (newRtp: number) => {
      PayoutEngine.setTargetRtp(newRtp);
      const tier = getLoosenessTier(newRtp);

      if (slider) slider.value = String(newRtp);
      if (sliderVal) {
        sliderVal.textContent = `${newRtp}%`;
        sliderVal.style.color = tier.color;
      }
      if (tierBadge) {
        tierBadge.innerHTML = `${tier.label} — <span style="font-weight: normal; font-size: 11px; color: #cbd5e1;">${tier.desc}</span>`;
        tierBadge.style.color = tier.color;
      }
      if (hudBadge) {
        hudBadge.textContent = `${newRtp}%`;
      }
      if (saveToast) {
        saveToast.textContent = `✓ Game looseness successfully calibrated to ${newRtp}% (${tier.label})`;
        setTimeout(() => {
          if (saveToast) saveToast.textContent = '';
        }, 2200);
      }
    };

    slider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      updateLooseness(val);
    });

    const presetButtons = ctx.modalContainer.querySelectorAll('.admin-preset-btn');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rtp = parseInt((e.currentTarget as HTMLElement).getAttribute('data-rtp') || '92', 10);
        updateLooseness(rtp);
      });
    });

    document.getElementById('admin-gamble-kill-toggle')?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      PayoutEngine.saveConfig({ gambleKillEnabled: enabled });
      if (saveToast) {
        saveToast.textContent = `✓ Instant Gamble Kill Roll: ${enabled ? 'ENABLED' : 'DISABLED'}`;
      }
    });

    document.getElementById('admin-bonus-mult-toggle')?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      PayoutEngine.saveConfig({ gambleBonusMultiplierEnabled: enabled });
      if (saveToast) {
        saveToast.textContent = `✓ Jackpot Multipliers on Catch: ${enabled ? 'ENABLED' : 'DISABLED'}`;
      }
    });

    document.getElementById('admin-reset-stats-btn')?.addEventListener('click', () => {
      PayoutEngine.resetSessionStats();
      const elWagered = document.getElementById('admin-stat-wagered');
      const elPayout = document.getElementById('admin-stat-payout');
      const elRtp = document.getElementById('admin-stat-rtp');
      const elShots = document.getElementById('admin-stat-shots');
      const elHits = document.getElementById('admin-stat-hits');
      const elGk = document.getElementById('admin-stat-gk');
      const elJp = document.getElementById('admin-stat-jp');

      if (elWagered) elWagered.textContent = '0.00 SC';
      if (elPayout) elPayout.textContent = '0.00 SC';
      if (elRtp) {
        elRtp.textContent = '0.00%';
        elRtp.style.color = '#f59e0b';
      }
      if (elShots) elShots.textContent = '0';
      if (elHits) elHits.textContent = '0';
      if (elGk) elGk.textContent = '0';
      if (elJp) elJp.textContent = '0';

      if (saveToast) {
        saveToast.textContent = '✓ Session telemetry metrics reset.';
      }
    });

    document.getElementById('admin-run-sim-btn')?.addEventListener('click', () => {
      const currentRtp = parseInt(slider ? slider.value : '92', 10);
      const simResult = PayoutEngine.runQuickSimulation(10000, currentRtp);
      const outputEl = document.getElementById('admin-sim-output');
      if (outputEl) {
        outputEl.innerHTML = `
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 3px;">
            ✓ 10,000 Shot Monte Carlo Benchmark Complete:
          </div>
          <div>Total Wagered: <strong>${simResult.totalWagered.toLocaleString()} SC</strong> | Total Return: <strong style="color: #34d399;">${simResult.totalPayout.toFixed(2)} SC</strong></div>
          <div style="margin-top: 2px;">
            Target Looseness: <strong>${currentRtp}%</strong> ➔ Empirical Realized RTP: <strong style="color: ${simResult.realizedRtp >= 90 ? '#34d399' : '#fbbf24'}; font-size: 13px;">${simResult.realizedRtp.toFixed(2)}%</strong>
          </div>
          <div style="color: #94a3b8; margin-top: 2px; font-size: 10px;">
            Instant Captures Triggered: ${simResult.instantKills} | Jackpot Surges: ${simResult.jackpots}
          </div>
        `;
      }
    });
  
}
