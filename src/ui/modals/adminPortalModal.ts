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
    <div style="background:#0b1120;border:2px solid #f59e0b;border-radius:0;padding:22px;max-width:560px;width:100%;color:#e2e8f0;max-height:90vh;overflow-y:auto;font-family:ui-monospace,monospace;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <h2 style="margin:0;font-size:16px;color:#fbbf24;">OPERATOR</h2>
          <div style="font-size:11px;color:#94a3b8;">RTP fixed at ${rtp}% · packages server-side</div>
        </div>
        <button id="modal-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button>
      </div>

      <div style="background:#052e16;border:1px solid #166534;border-radius:0;padding:12px;margin-bottom:14px;font-size:12px;color:#86efac;">
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

      <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px;">DEPOSITS (FIRESTORE)</div>
      <div id="admin-economy-stats" style="font-size:11px;color:#cbd5e1;margin-bottom:14px;background:#1e293b;padding:10px;border-radius:8px;">Loading…</div>

      <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px;">PACKAGES (GC editable · SC% auto)</div>
      <div id="admin-packages" style="font-size:11px;color:#cbd5e1;margin-bottom:8px;">Loading…</div>
      <button id="admin-pkg-save" style="width:100%;margin-bottom:8px;padding:10px;border-radius:8px;border:1px solid #22d3ee;background:#0e7490;color:#ecfeff;cursor:pointer;font-weight:800;">SAVE PACKAGE GC AMOUNTS</button>
      <button id="admin-pkg-seed" style="width:100%;margin-bottom:12px;padding:8px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#94a3b8;cursor:pointer;font-size:11px;">Reset to defaults</button>
      <div id="admin-pkg-status" style="font-size:11px;color:#64748b;margin-bottom:12px;"></div>

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

  
  const ecoEl = document.getElementById('admin-economy-stats');
  if (ecoEl && isFirebaseConfigured) {
    httpsCallable(functions, 'getEconomyStats')()
      .then((res) => {
        const d = res.data as any;
        ecoEl.innerHTML = `
          <div>Completed deposits: <strong>${d.completed}</strong> · Pending: ${d.pending}</div>
          <div>USD in: <strong>$${Number(d.totalDepositUsd).toFixed(2)}</strong></div>
          <div>GC granted: <strong>${Number(d.totalGcGranted).toLocaleString()}</strong> · SC bonus: ${Number(d.totalScBonus).toFixed(2)}</div>
          <div style="margin-top:6px;color:#64748b;">Last 14 days:</div>
          ${(d.daily || []).slice(0, 5).map((x: any) => `<div>${x.day}: $${x.depositsUsd.toFixed(2)} · ${x.count} tx</div>`).join('') || '<div>No rows yet</div>'}
        `;
      })
      .catch(() => {
        ecoEl.textContent = 'Economy stats unavailable (deploy getEconomyStats).';
      });
  } else if (ecoEl) {
    ecoEl.textContent = 'Configure Firebase to load deposit ledger.';
  }

  let packageTiers: any[] = [];
  const pkgEl = document.getElementById('admin-packages');
  const statusEl = document.getElementById('admin-pkg-status');

  const renderPkgEditor = (tiers: any[]) => {
    packageTiers = tiers;
    if (!pkgEl) return;
    pkgEl.innerHTML = tiers
      .map(
        (t, i) => `
      <div style="padding:8px 0;border-bottom:1px solid #1e293b;display:grid;grid-template-columns:1fr 100px;gap:8px;align-items:center;">
        <div>
          <div style="font-weight:700;color:#67e8f9;">${t.label || t.id}</div>
          <div style="color:#64748b;">$${Number(t.priceUsd).toFixed(2)} · SC bonus ${t.scBonusPct ?? 0}% → ${t.bonusScAmount ?? 0} SC</div>
        </div>
        <label style="font-size:10px;color:#94a3b8;">GC
          <input data-pkg-i="${i}" class="admin-gc-input" type="number" min="0" step="100" value="${t.gcAmount}"
            style="width:100%;margin-top:4px;background:#020617;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:6px;" />
        </label>
      </div>`
      )
      .join('');
  };

  const defaults = [
    { id: 'pack_5', priceUsd: 4.99, gcAmount: 5000, scBonusPct: 0, bonusScAmount: 0, label: '$4.99 Starter', active: true },
    { id: 'pack_10', priceUsd: 9.99, gcAmount: 12000, scBonusPct: 3, bonusScAmount: 0.3, label: '$9.99 Plus', active: true },
    { id: 'pack_20', priceUsd: 19.99, gcAmount: 28000, scBonusPct: 5, bonusScAmount: 1, label: '$19.99 Pro', active: true },
    { id: 'pack_50', priceUsd: 49.99, gcAmount: 80000, scBonusPct: 7, bonusScAmount: 3.5, label: '$49.99 Elite', active: true },
    { id: 'pack_100', priceUsd: 99.99, gcAmount: 180000, scBonusPct: 10, bonusScAmount: 10, label: '$99.99 Ultimate', active: true }
  ];

  if (pkgEl && isFirebaseConfigured) {
    httpsCallable(functions, 'listPackages')()
      .then((res) => {
        const tiers = ((res.data as any)?.tiers || []) as any[];
        renderPkgEditor(tiers.length ? tiers : defaults);
      })
      .catch(() => renderPkgEditor(defaults));
  } else {
    renderPkgEditor(defaults);
  }

  document.getElementById('admin-pkg-save')?.addEventListener('click', async () => {
    if (!isFirebaseConfigured) {
      if (statusEl) statusEl.textContent = 'Firebase required to save packages.';
      return;
    }
    pkgEl?.querySelectorAll('.admin-gc-input').forEach((input) => {
      const i = parseInt((input as HTMLElement).getAttribute('data-pkg-i') || '0', 10);
      if (packageTiers[i]) packageTiers[i].gcAmount = Number((input as HTMLInputElement).value) || 0;
    });
    if (statusEl) statusEl.textContent = 'Saving…';
    try {
      const res = await httpsCallable(functions, 'updatePackages')({ tiers: packageTiers });
      const tiers = ((res.data as any)?.tiers || []) as any[];
      renderPkgEditor(tiers);
      if (statusEl) statusEl.textContent = 'Saved package GC amounts.';
      SoundManager.playUiSound('chip_up');
    } catch (e: any) {
      if (statusEl) statusEl.textContent = e?.message || 'Save failed';
    }
  });

  document.getElementById('admin-pkg-seed')?.addEventListener('click', async () => {
    if (!isFirebaseConfigured) {
      renderPkgEditor(defaults);
      return;
    }
    try {
      const res = await httpsCallable(functions, 'seedDefaultPackages')({});
      renderPkgEditor(((res.data as any)?.tiers || defaults) as any[]);
      if (statusEl) statusEl.textContent = 'Defaults restored.';
    } catch (e: any) {
      if (statusEl) statusEl.textContent = e?.message || 'Seed failed';
    }
  });
}

