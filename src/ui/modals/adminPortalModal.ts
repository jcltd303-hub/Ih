import { PayoutEngine } from '../../engine/systems/PayoutEngine';
import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';
import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../../network/FirebaseClient';

export function showAdminPortalModal(ctx: ModalContext): void {
  SoundManager.playUiSound('modal_open');
  const stats = PayoutEngine.getSessionStats();
  const profit = PayoutEngine.getProfitSnapshot();
  const rtp = 85; // fixed server policy

  ctx.modalContainer.innerHTML = `
    <div style="background:#0b1120;border:2px solid #f59e0b;border-radius:16px;padding:22px;max-width:560px;width:100%;color:#e2e8f0;max-height:90vh;overflow-y:auto;font-family:ui-monospace,monospace;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <h2 style="margin:0;font-size:16px;color:#fbbf24;">OPERATOR</h2>
          <div style="font-size:11px;color:#94a3b8;">RTP fixed at ${rtp}% · packages server-side</div>
        </div>
        <button id="modal-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button>
      </div>

      <div style="background:#052e16;border:1px solid #166534;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#86efac;">
        Target RTP is <strong>85%</strong> (server). Client cannot change payout policy.
      </div>

      <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px;">SESSION</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">WAGERED</div>
          <div style="font-weight:800;">${stats.totalWagered.toFixed(2)}</div>
        </div>
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">PAID OUT</div>
          <div style="font-weight:800;color:#34d399;">${stats.totalPaidOut.toFixed(2)}</div>
        </div>
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">REALIZED RTP</div>
          <div style="font-weight:800;">${stats.realizedRtp.toFixed(2)}%</div>
        </div>
      </div>

      <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px;">HOUSE P&L (LIFETIME)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">DEPOSITS</div>
          <div style="font-weight:800;color:#60a5fa;">${profit.ledger.totalDeposits.toFixed(2)}</div>
        </div>
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">HANDLE</div>
          <div style="font-weight:800;">${profit.ledger.totalHandle.toFixed(2)}</div>
        </div>
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">CASH PROFIT</div>
          <div style="font-weight:800;color:${profit.cashProfit >= 0 ? '#34d399' : '#f87171'};">${profit.cashProfit.toFixed(2)}</div>
        </div>
        <div style="background:#1e293b;padding:10px;border-radius:8px;">
          <div style="font-size:10px;color:#64748b;">HOUSE EDGE</div>
          <div style="font-weight:800;color:#fbbf24;">${profit.gameHouseEdgePct.toFixed(2)}%</div>
        </div>
      </div>

      <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px;">PACKAGES (READ)</div>
      <div id="admin-packages" style="font-size:11px;color:#cbd5e1;margin-bottom:12px;">Loading…</div>

      <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:12px;cursor:pointer;">
        <input type="checkbox" id="admin-debug-toggle" />
        Debug mode (FPS / session in console)
      </label>

      <button id="admin-reset-stats-btn" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;font-weight:700;">
        RESET SESSION STATS
      </button>
    </div>
  `;
  ctx.modalContainer.style.display = 'flex';

  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    SoundManager.playUiSound('modal_close');
    ctx.closeModal();
  });
  document.getElementById('admin-reset-stats-btn')?.addEventListener('click', () => {
    PayoutEngine.resetSessionStats();
    showAdminPortalModal(ctx);
  });

  const dbg = document.getElementById('admin-debug-toggle') as HTMLInputElement | null;
  if (dbg) {
    dbg.checked = localStorage.getItem('fish_frenzy_debug') === '1';
    dbg.addEventListener('change', () => {
      localStorage.setItem('fish_frenzy_debug', dbg.checked ? '1' : '0');
    });
  }

  const pkgEl = document.getElementById('admin-packages');
  if (pkgEl && isFirebaseConfigured) {
    httpsCallable(functions, 'listPackages')()
      .then((res) => {
        const tiers = ((res.data as any)?.tiers || []) as any[];
        pkgEl.innerHTML = tiers
          .map(
            (t) =>
              `<div style="padding:6px 0;border-bottom:1px solid #1e293b;">${t.label || t.id}: <strong>${t.gcAmount} GC</strong> + <strong>${t.bonusScAmount ?? 0} SC</strong> ($${t.priceUsd})</div>`
          )
          .join('');
      })
      .catch(() => {
        pkgEl.textContent = 'Packages unavailable offline — defaults apply on server.';
      });
  } else if (pkgEl) {
    pkgEl.innerHTML = `
      <div>$4.99 → 5000 GC (GC only)</div>
      <div>$9.99 → 12000 GC + 3% SC</div>
      <div>$19.99 → 28000 GC + 5% SC</div>
      <div>$49.99 → 80000 GC + 7% SC</div>
      <div>$99.99 → 180000 GC + 10% SC</div>
    `;
  }
}
