import { ModalContext } from './ModalContext';
import { WalletService } from '../../network/WalletService';
import { SoundManager } from '../../audio/SoundManager';
import { ARCADE } from '../StyleConstants';

export function showDepositModal(
  ctx: ModalContext,
  wallet: WalletService,
  onSuccess?: () => void
): void {
  const balances = wallet.getBalances();
  let selectedAmount = 10;
  let selectedCurrency: 'SC' | 'GC' = 'SC';

  const render = () => {
    const curBal = selectedCurrency === 'SC' ? balances.sweepstakesCoins : balances.goldCoins;
    const accentColor = selectedCurrency === 'SC' ? '#38bdf8' : '#fbbf24';

    const html = `
      <div style="
        background: #090d18;
        border: 3px solid ${accentColor};
        box-shadow: 6px 6px 0 #020617;
        border-radius: 2px;
        width: min(440px, 95vw);
        padding: 22px;
        color: #f8fafc;
        font-family: var(--font-display, 'Impact', sans-serif);
        box-sizing: border-box;
        position: relative;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e293b; padding-bottom:8px; margin-bottom:14px;">
          <span style="font-size:20px; font-weight:900; font-style:italic; color:${accentColor}; letter-spacing:1px;">
            CREDIT DISPENSER // DEPOSIT
          </span>
          <button id="ff-dep-close" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:4px 8px; cursor:pointer; font-weight:900; font-family:var(--font-mono, monospace);">[X]</button>
        </div>

        <div style="font-family:var(--font-mono, monospace); font-size:12px; display:flex; flex-direction:column; gap:12px;">
          <!-- CURRENCY PICKER -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button id="ff-dep-pick-sc" type="button" class="ff-arcade-btn" style="padding:8px; ${selectedCurrency === 'SC' ? 'background:#0284c7; color:#fff; border-color:#38bdf8;' : 'background:#0f172a; color:#94a3b8; border-color:#334155;'} font-family:var(--font-display); font-size:13px;">
              SWEEPS COINS (SC)
            </button>
            <button id="ff-dep-pick-gc" type="button" class="ff-arcade-btn" style="padding:8px; ${selectedCurrency === 'GC' ? 'background:#d97706; color:#fff; border-color:#fbbf24;' : 'background:#0f172a; color:#94a3b8; border-color:#334155;'} font-family:var(--font-display); font-size:13px;">
              GOLD COINS (GC)
            </button>
          </div>

          <!-- CURRENT BALANCE STATUS -->
          <div style="background:#0f172a; border:1px solid #334155; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94a3b8; font-weight:700;">CURRENT BALANCE:</span>
            <span style="color:${accentColor}; font-weight:900; font-size:16px;">
              ${curBal.toLocaleString()} ${selectedCurrency}
            </span>
          </div>

          <!-- QUICK PRESETS -->
          <div>
            <div style="font-size:10px; color:#94a3b8; font-weight:800; letter-spacing:1px; margin-bottom:6px;">QUICK PACKS:</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
              ${(selectedCurrency === 'SC' ? [5, 10, 25, 50] : [1000, 5000, 15000, 50000])
                .map(
                  (amt) => `
                <button type="button" class="ff-dep-preset ff-arcade-btn" data-amt="${amt}" style="
                  padding:8px 4px; font-size:12px; font-family:var(--font-mono, monospace); font-weight:900;
                  ${selectedAmount === amt ? 'background:#0369a1; color:#fff; border-color:#38bdf8;' : 'background:#1e293b; color:#cbd5e1; border-color:#475569;'}
                ">
                  +${amt}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- CUSTOM AMOUNT INPUT -->
          <div>
            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; letter-spacing:1px; margin-bottom:4px;">
              CUSTOM AMOUNT (${selectedCurrency})
            </label>
            <input 
              id="ff-dep-input" 
              type="number" 
              min="1" 
              step="${selectedCurrency === 'SC' ? '0.1' : '1'}"
              value="${selectedAmount}"
              style="
                width:100%; box-sizing:border-box; background:#0f172a; border:2px solid #334155;
                color:#f8fafc; font-family:var(--font-mono, monospace); font-size:16px; font-weight:900;
                padding:8px 10px; border-radius:2px; outline:none;
              "
            />
          </div>

          <div id="ff-dep-status" style="min-height:16px; font-size:11px; font-weight:700;"></div>

          <!-- ACTION BUTTON -->
          <div>
            ${ARCADE.arcadeButton(`INSTANT DEPOSIT +${selectedAmount} ${selectedCurrency}`, {
              id: 'ff-dep-confirm-btn',
              variant: selectedCurrency === 'SC' ? 'cyan' : 'primary',
              fullWidth: true,
              size: 'lg'
            })}
          </div>
        </div>
      </div>
    `;

    ctx.openModal(html);

    ctx.modalContainer.querySelector('#ff-dep-close')?.addEventListener('click', () => ctx.closeModal());

    ctx.modalContainer.querySelector('#ff-dep-pick-sc')?.addEventListener('click', () => {
      selectedCurrency = 'SC';
      selectedAmount = 10;
      render();
    });

    ctx.modalContainer.querySelector('#ff-dep-pick-gc')?.addEventListener('click', () => {
      selectedCurrency = 'GC';
      selectedAmount = 5000;
      render();
    });

    ctx.modalContainer.querySelectorAll<HTMLButtonElement>('.ff-dep-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const amt = Number(btn.getAttribute('data-amt'));
        if (Number.isFinite(amt) && amt > 0) {
          selectedAmount = amt;
          render();
        }
      });
    });

    const input = ctx.modalContainer.querySelector<HTMLInputElement>('#ff-dep-input');
    input?.addEventListener('input', () => {
      const v = Number(input.value);
      if (Number.isFinite(v) && v > 0) {
        selectedAmount = v;
        const confirmBtn = ctx.modalContainer.querySelector<HTMLButtonElement>('#ff-dep-confirm-btn');
        if (confirmBtn) {
          confirmBtn.textContent = `INSTANT DEPOSIT +${v} ${selectedCurrency}`;
        }
      }
    });

    const confirmBtn = ctx.modalContainer.querySelector<HTMLButtonElement>('#ff-dep-confirm-btn');
    confirmBtn?.addEventListener('click', async () => {
      const amt = Number(input?.value || selectedAmount);
      const statusEl = ctx.modalContainer.querySelector<HTMLElement>('#ff-dep-status');
      if (!Number.isFinite(amt) || amt <= 0) {
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.textContent = 'Enter a valid amount.';
        }
        return;
      }

      confirmBtn.disabled = true;
      if (statusEl) {
        statusEl.style.color = '#38bdf8';
        statusEl.textContent = 'Crediting wallet…';
      }

      try {
        if (selectedCurrency === 'SC') {
          wallet.credit(0, amt);
        } else {
          wallet.credit(amt, 0);
        }
        SoundManager.playUiSound('powerup');
        if (statusEl) {
          statusEl.style.color = '#34d399';
          statusEl.textContent = `✓ Successfully added +${amt} ${selectedCurrency}!`;
        }
        onSuccess?.();
        setTimeout(() => ctx.closeModal(), 700);
      } catch (err: any) {
        confirmBtn.disabled = false;
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.textContent = err?.message || 'Deposit failed.';
        }
      }
    });
  };

  render();
}

export function showWithdrawModal(
  ctx: ModalContext,
  wallet: WalletService,
  onSuccess?: () => void
): void {
  const balances = wallet.getBalances();
  const maxSc = balances.sweepstakesCoins;
  let withdrawAmt = Math.min(10, maxSc);

  const render = () => {
    const html = `
      <div style="
        background: #090d18;
        border: 3px solid #64748b;
        box-shadow: 6px 6px 0 #020617;
        border-radius: 2px;
        width: min(440px, 95vw);
        padding: 22px;
        color: #f8fafc;
        font-family: var(--font-display, 'Impact', sans-serif);
        box-sizing: border-box;
        position: relative;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e293b; padding-bottom:8px; margin-bottom:14px;">
          <span style="font-size:20px; font-weight:900; font-style:italic; color:#94a3b8; letter-spacing:1px;">
            CREDIT REDEMPTION // WITHDRAW
          </span>
          <button id="ff-wtd-close" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:4px 8px; cursor:pointer; font-weight:900; font-family:var(--font-mono, monospace);">[X]</button>
        </div>

        <div style="font-family:var(--font-mono, monospace); font-size:12px; display:flex; flex-direction:column; gap:12px;">
          <div style="background:#0f172a; border:1px solid #334155; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94a3b8; font-weight:700;">AVAILABLE FOR CASHOUT:</span>
            <span style="color:#38bdf8; font-weight:900; font-size:16px;">
              ${maxSc.toLocaleString()} SC
            </span>
          </div>

          <!-- PRESETS -->
          <div>
            <div style="font-size:10px; color:#94a3b8; font-weight:800; letter-spacing:1px; margin-bottom:6px;">QUICK AMOUNTS:</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
              ${[5, 10, 25, maxSc]
                .map(
                  (amt, idx) => `
                <button type="button" class="ff-wtd-preset ff-arcade-btn" data-amt="${amt}" style="
                  padding:8px 4px; font-size:11px; font-family:var(--font-mono, monospace); font-weight:900;
                  background:#1e293b; color:#cbd5e1; border-color:#475569;
                ">
                  ${idx === 3 ? 'MAX ALL' : `${amt} SC`}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- INPUT -->
          <div>
            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; letter-spacing:1px; margin-bottom:4px;">
              WITHDRAW AMOUNT (SC)
            </label>
            <input 
              id="ff-wtd-input" 
              type="number" 
              min="0.1" 
              max="${maxSc}"
              step="0.1"
              value="${withdrawAmt}"
              style="
                width:100%; box-sizing:border-box; background:#0f172a; border:2px solid #334155;
                color:#f8fafc; font-family:var(--font-mono, monospace); font-size:16px; font-weight:900;
                padding:8px 10px; border-radius:2px; outline:none;
              "
            />
          </div>

          <div id="ff-wtd-status" style="min-height:16px; font-size:11px; font-weight:700;"></div>

          <div>
            ${ARCADE.arcadeButton('PROCESS WITHDRAWAL', {
              id: 'ff-wtd-confirm-btn',
              variant: 'slate',
              fullWidth: true,
              size: 'lg'
            })}
          </div>
        </div>
      </div>
    `;

    ctx.openModal(html);

    ctx.modalContainer.querySelector('#ff-wtd-close')?.addEventListener('click', () => ctx.closeModal());

    ctx.modalContainer.querySelectorAll<HTMLButtonElement>('.ff-wtd-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const amt = Number(btn.getAttribute('data-amt'));
        if (Number.isFinite(amt) && amt > 0) {
          withdrawAmt = Math.min(amt, maxSc);
          const input = ctx.modalContainer.querySelector<HTMLInputElement>('#ff-wtd-input');
          if (input) input.value = String(withdrawAmt);
        }
      });
    });

    const confirmBtn = ctx.modalContainer.querySelector<HTMLButtonElement>('#ff-wtd-confirm-btn');
    confirmBtn?.addEventListener('click', async () => {
      const input = ctx.modalContainer.querySelector<HTMLInputElement>('#ff-wtd-input');
      const amt = Number(input?.value || withdrawAmt);
      const statusEl = ctx.modalContainer.querySelector<HTMLElement>('#ff-wtd-status');

      if (!Number.isFinite(amt) || amt <= 0) {
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.textContent = 'Enter a valid amount.';
        }
        return;
      }

      if (amt > maxSc) {
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.textContent = 'Insufficient available SC balance.';
        }
        return;
      }

      confirmBtn.disabled = true;
      if (statusEl) {
        statusEl.style.color = '#38bdf8';
        statusEl.textContent = 'Processing withdrawal…';
      }

      try {
        wallet.trySpend('SC', amt);
        SoundManager.playUiSound('modal_close');
        if (statusEl) {
          statusEl.style.color = '#34d399';
          statusEl.textContent = `✓ Successfully cashed out ${amt} SC!`;
        }
        onSuccess?.();
        setTimeout(() => ctx.closeModal(), 700);
      } catch (err: any) {
        confirmBtn.disabled = false;
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.textContent = err?.message || 'Withdrawal failed.';
        }
      }
    });
  };

  render();
}
