import { ProvablyFairAuditor } from '../../utils/ProvablyFairAuditor';
import { SoundManager } from '../../audio/SoundManager';
import { FairnessSession } from '../../network/FairnessSession';
import type { ModalContext } from './ModalContext';

export async function showAuditModal(ctx: ModalContext): Promise<void> {
  SoundManager.playUiSound('modal_open');
  const fair = FairnessSession.getInstance();
  let state = fair.getState();
  if (!state) {
    state = await fair.begin();
  }
  const revealed = state.status === 'revealed' || state.status === 'local';
  const serverSeedDisplay = revealed && state.serverSeed ? state.serverSeed : '(committed — click Reveal)';
  const nonceHigh = state.nonceHigh || 0;
  const rangeLabel =
    nonceHigh > 0
      ? `nonce 0 – ${nonceHigh - 1} (${nonceHigh} roll${nonceHigh === 1 ? '' : 's'} this session)`
      : 'no rolls settled yet this session';

  ctx.modalContainer.innerHTML = `
    <div style="background:#0f172a;border:2px solid #0284c7;border-radius:16px;padding:24px;max-width:480px;width:100%;color:#e2e8f0;font-family:ui-monospace,monospace;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="margin:0;font-size:16px;color:#38bdf8;">🛡️ PROVABLY FAIR</h2>
        <button id="modal-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <p style="font-size:12px;color:#94a3b8;line-height:1.5;">
        Server commits a seed hash before play. After reveal you can verify any roll used to settle your shots.
        <strong style="color:#fbbf24;">Production SC settlement is server-side</strong> — this panel is for audit transparency.
      </p>
      <div style="background:#020617;border:1px solid #1e293b;border-radius:8px;padding:12px;font-size:11px;word-break:break-all;">
        <div><span style="color:#64748b;">Status</span> ${state.status}</div>
        <div style="margin-top:6px;"><span style="color:#64748b;">Session</span> ${state.sessionId}</div>
        <div style="margin-top:6px;"><span style="color:#64748b;">Server hash</span><br/>${state.serverSeedHash}</div>
        <div style="margin-top:6px;"><span style="color:#64748b;">Client seed</span><br/>${state.clientSeed}</div>
        <div style="margin-top:6px;"><span style="color:#64748b;">Server seed</span><br/>${serverSeedDisplay}</div>
        <div style="margin-top:8px;"><span style="color:#64748b;">Verifiable range</span><br/>${rangeLabel}</div>
      </div>
      ${
        revealed
          ? `
      <div style="margin-top:14px;">
        <label style="font-size:11px;color:#94a3b8;">Verify a specific nonce (0–${Math.max(nonceHigh - 1, 0)}):</label>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <input id="audit-nonce-input" type="number" min="0" max="${Math.max(nonceHigh - 1, 0)}" value="0"
            style="flex:1;padding:8px;border-radius:6px;border:1px solid #1e293b;background:#020617;color:#e2e8f0;font-family:inherit;" />
          <button id="audit-verify-btn" style="padding:8px 14px;border:none;border-radius:6px;font-weight:800;cursor:pointer;background:#0284c7;color:#fff;">
            VERIFY
          </button>
        </div>
        <div id="audit-verify-result" style="margin-top:8px;color:#34d399;font-size:12px;"></div>
      </div>
      `
          : ''
      }
      <button id="audit-reveal-btn" style="margin-top:14px;width:100%;padding:12px;border:none;border-radius:8px;font-weight:800;cursor:pointer;background:#0284c7;color:#fff;">
        REVEAL SERVER SEED
      </button>
    </div>
  `;
  ctx.modalContainer.style.display = 'flex';
  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    SoundManager.playUiSound('modal_close');
    ctx.closeModal();
  });
  document.getElementById('audit-reveal-btn')?.addEventListener('click', async () => {
    await fair.reveal();
    await showAuditModal(ctx);
  });
  document.getElementById('audit-verify-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('audit-nonce-input') as HTMLInputElement | null;
    const resultEl = document.getElementById('audit-verify-result');
    if (!input || !resultEl || !state?.serverSeed) return;
    const nonce = Math.max(0, Math.floor(Number(input.value) || 0));
    const roll = ProvablyFairAuditor.verifyOutcome(state.serverSeed, state.clientSeed, nonce);
    resultEl.textContent = `nonce=${nonce} → ${roll.toFixed(4)}`;
  });
}
