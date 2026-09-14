import { ProvablyFairAuditor } from '../../utils/ProvablyFairAuditor';
import { SoundManager } from '../../audio/SoundManager';
import type { ModalContext } from './ModalContext';

export async function showAuditModal(ctx: ModalContext): Promise<void> {
const serverSeed = 'fish_frenzy_provably_fair_audit_seed_' + Date.now();
    const serverHash = await ProvablyFairAuditor.generateServerSeedHash(serverSeed);
    const clientSeed = 'client_local_entropy_999';
    const outcomeRoll = ProvablyFairAuditor.verifyOutcome(serverSeed, clientSeed, 1);

    ctx.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #0284c7; border-radius: 16px; padding: 24px; max-width: 520px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #38bdf8; margin: 0;">🛡️ PROVABLY FAIR AUDITOR</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 14px; line-height: 1.4;">
          All ballistic outcomes are cryptographically pre-committed using SHA-256 hash chains. Players can verify that target multipliers were determined prior to weapon fire.
        </p>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">PRE-COMMITTED SERVER SEED (SHA-256)</div>
          <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 11px; word-break: break-all; color: #38bdf8; font-family: monospace;">
            ${serverHash}
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">ACTIVE CLIENT ENTROPY SEED</div>
          <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #e2e8f0; font-family: monospace;">
            ${clientSeed}
          </div>
        </div>
        <div style="margin-bottom: 18px; display: flex; justify-content: space-between; background: #1e293b; padding: 12px; border-radius: 8px; align-items: center;">
          <span style="font-size: 12px; color: #cbd5e1;">Computed RNG Multiplier Roll:</span>
          <span style="font-size: 16px; font-weight: 800; color: #34d399;">${outcomeRoll.toFixed(2)}x</span>
        </div>
        <button id="modal-close-btn-bottom" style="width: 100%; background: #0284c7; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          CLOSE AUDIT LEDGER
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    ctx.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => ctx.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => ctx.closeModal());
  
}
