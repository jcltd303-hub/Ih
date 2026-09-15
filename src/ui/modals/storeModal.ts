import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';
import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../../network/FirebaseClient';
import { WalletService } from '../../network/WalletService';
import { FeatureFlags } from '../../config/FeatureFlags';

type Tier = {
  id: string;
  priceUsd: number;
  gcAmount: number;
  bonusScAmount?: number;
  scBonusPct?: number;
  label: string;
};

const FALLBACK: Tier[] = [
  { id: 'pack_5', priceUsd: 4.99, gcAmount: 5000, bonusScAmount: 0, label: '$4.99 Starter' },
  { id: 'pack_10', priceUsd: 9.99, gcAmount: 12000, bonusScAmount: 0.3, label: '$9.99 Plus' },
  { id: 'pack_20', priceUsd: 19.99, gcAmount: 28000, bonusScAmount: 1.0, label: '$19.99 Pro' },
  { id: 'pack_50', priceUsd: 49.99, gcAmount: 80000, bonusScAmount: 3.5, label: '$49.99 Elite' },
  { id: 'pack_100', priceUsd: 99.99, gcAmount: 180000, bonusScAmount: 10.0, label: '$99.99 Ultimate' }
];

export async function showStoreModal(ctx: ModalContext): Promise<void> {
  SoundManager.playUiSound('modal_open');
  let tiers = FALLBACK;
  if (isFirebaseConfigured) {
    try {
      const res = await httpsCallable(functions, 'listPackages')();
      const list = (res.data as any)?.tiers;
      if (Array.isArray(list) && list.length) tiers = list;
    } catch {
      /* fallback */
    }
  }

  let provider = 'crypto';
  let cryptoAsset = 'USDT';

  const render = () => {
    ctx.modalContainer.innerHTML = `
      <div style="background:linear-gradient(160deg,#0b1224,#0f172a);border:2px solid #22d3ee;border-radius:16px;padding:20px;max-width:520px;width:100%;color:#e2e8f0;max-height:90vh;overflow-y:auto;font-family:ui-monospace,monospace;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="margin:0;font-size:18px;font-weight:900;color:#67e8f9;">STORE</h2>
          <button id="modal-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 12px;line-height:1.4;">
          Buy <strong>GC</strong>. Bonus <strong>SC</strong> is free (1:1 USD of bonus %). Top pack 10% SC; $4.99 is GC only.
        </p>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
          ${['crypto', 'stripe', 'capital']
            .map(
              (p) => `
            <button type="button" class="store-prov" data-p="${p}" style="padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;
              border:2px solid ${provider === p ? '#22d3ee' : '#334155'};
              background:${provider === p ? 'rgba(34,211,238,0.15)' : '#1e293b'};
              color:${provider === p ? '#67e8f9' : '#94a3b8'};">${p.toUpperCase()}</button>`
            )
            .join('')}
        </div>
        ${
          provider === 'crypto'
            ? `<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
            ${['BTC', 'ETH', 'USDT', 'USDC', 'SOL']
              .map(
                (a) => `
              <button type="button" class="store-asset" data-a="${a}" style="padding:6px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;
                border:1px solid ${cryptoAsset === a ? '#a78bfa' : '#334155'};
                background:${cryptoAsset === a ? 'rgba(167,139,250,0.2)' : '#0f172a'};
                color:#e2e8f0;">${a}</button>`
              )
              .join('')}
          </div>`
            : ''
        }
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${tiers
            .map((t) => {
              const sc = t.bonusScAmount ?? 0;
              return `
            <button type="button" class="store-buy" data-id="${t.id}" style="text-align:left;padding:12px 14px;border-radius:12px;border:1px solid #334155;background:#1e293b;cursor:pointer;color:#fff;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:900;color:#67e8f9;">${t.label || t.id}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
                    ${t.gcAmount.toLocaleString()} GC${sc > 0 ? ` + ${sc} SC bonus` : ' · GC only'}
                  </div>
                </div>
                <div style="font-weight:900;font-size:16px;color:#fbbf24;">$${Number(t.priceUsd).toFixed(2)}</div>
              </div>
            </button>`;
            })
            .join('')}
        </div>
        <div id="store-status" style="margin-top:12px;font-size:11px;color:#94a3b8;min-height:18px;"></div>
      </div>
    `;
    ctx.modalContainer.style.display = 'flex';

    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      SoundManager.playUiSound('modal_close');
      ctx.closeModal();
    });
    ctx.modalContainer.querySelectorAll('.store-prov').forEach((btn) => {
      btn.addEventListener('click', () => {
        provider = (btn as HTMLElement).getAttribute('data-p') || 'crypto';
        render();
      });
    });
    ctx.modalContainer.querySelectorAll('.store-asset').forEach((btn) => {
      btn.addEventListener('click', () => {
        cryptoAsset = (btn as HTMLElement).getAttribute('data-a') || 'USDT';
        render();
      });
    });
    ctx.modalContainer.querySelectorAll('.store-buy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const packageId = (btn as HTMLElement).getAttribute('data-id')!;
        const status = document.getElementById('store-status');
        if (!isFirebaseConfigured) {
          if (status) status.textContent = 'Configure Firebase to purchase. Demo: packages listed only.';
          return;
        }
        if (status) status.textContent = 'Creating checkout…';
        try {
          const requestDeposit = httpsCallable(functions, 'requestDeposit');
          const res = await requestDeposit({
            packageId,
            provider,
            cryptoAsset: provider === 'crypto' ? cryptoAsset : undefined
          });
          const data = res.data as any;
          if (status) {
            if (FeatureFlags.stubPayments) {
              status.innerHTML = `Pending <code>${data.depositId}</code> · ${data.gcAmount} GC${
                data.bonusScAmount ? ` + ${data.bonusScAmount} SC` : ''
              }. <button type="button" id="store-confirm-stub" style="margin-left:8px;cursor:pointer;">Simulate pay (stub)</button>`;
            } else {
              status.textContent =
                'Payment pending confirmation — this can take a few minutes. Your balance will update automatically once confirmed.';
            }
          }
          document.getElementById('store-confirm-stub')?.addEventListener('click', async () => {
            try {
              const confirm = httpsCallable(functions, 'confirmDepositStub');
              const done = await confirm({ depositId: data.depositId });
              const d = done.data as any;
              WalletService.getInstance().applyServerBalances?.(d.goldCoins, d.sweepstakesCoins);
              if (status) status.textContent = `Credited ${d.gcGranted} GC` + (d.scBonus ? ` + ${d.scBonus} SC` : '');
              SoundManager.playUiSound('chip_up');
            } catch (e: any) {
              if (status) {
                status.textContent =
                  e?.code === 'permission-denied'
                    ? 'Stub confirmation is disabled outside internal QA builds.'
                    : e?.message || 'Confirmation failed';
              }
            }
          });
        } catch (e: any) {
          if (status) status.textContent = e?.message || 'Purchase failed';
        }
      });
    });
  };

  render();
}
