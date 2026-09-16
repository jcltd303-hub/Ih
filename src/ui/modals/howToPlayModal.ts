import { ModalContext } from './ModalContext';
import { ARCADE } from '../StyleConstants';

export function showHowToPlayModal(ctx: ModalContext): void {
  const html = `
    <div style="
      background: #090d18;
      border: 3px solid #38bdf8;
      box-shadow: 4px 4px 0 #020617;
      border-radius: 2px;
      width: min(440px, 95vw);
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px;
      color: #f8fafc;
      font-family: var(--font-display, 'Impact', sans-serif);
      box-sizing: border-box;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 16px;">
        <span style="font-size: 20px; font-weight: 900; font-style: italic; color: #38bdf8; letter-spacing: 1px;">
          ARCADE COMBAT MANUAL
        </span>
        <button id="ff-htp-close" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:4px 8px; cursor:pointer; font-weight:900;">[X]</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; font-family:var(--font-mono, monospace); font-size:12px; line-height:1.5;">
        <div style="background:#0f172a; border:1px solid #334155; padding:10px;">
          <div style="color:#fbbf24; font-weight:900; font-family:var(--font-display); font-size:14px; font-style:italic; margin-bottom:4px;">
            1. TARGET & FIRE
          </div>
          <div>Aim with your cursor or finger. Click or hold to fire energy bolts. Each projectile costs your selected stake. Hits earn instant pay-per-hit credits.</div>
        </div>

        <div style="background:#0f172a; border:1px solid #334155; padding:10px;">
          <div style="color:#22d3ee; font-weight:900; font-family:var(--font-display); font-size:14px; font-style:italic; margin-bottom:4px;">
            2. COMBOS & MULTIPLIERS
          </div>
          <div>Chain consecutive hits to build your COMBO meter. Higher combos boost your damage up to 1.5x. Quick fish captures award random Turret x2 powerups!</div>
        </div>

        <div style="background:#0f172a; border:1px solid #334155; padding:10px;">
          <div style="color:#ef4444; font-weight:900; font-family:var(--font-display); font-size:14px; font-style:italic; margin-bottom:4px;">
            3. ABYSSAL BOSS RAIDS
          </div>
          <div>Defeat trench targets to trigger the guaranteed ABYSSAL HORROR BOSS raid. Whittle down its Street Fighter-style health bar before time runs out for major bounty multipliers!</div>
        </div>

        <div style="background:#0f172a; border:1px solid #334155; padding:10px;">
          <div style="color:#34d399; font-weight:900; font-family:var(--font-display); font-size:14px; font-style:italic; margin-bottom:4px;">
            4. PROVABLY FAIR
          </div>
          <div>All RNG outcomes and multipliers are cryptographically determined via HMAC-SHA256 nonces and verifiable server seeds. Press (~) anytime to view live diagnostics.</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        ${ARCADE.arcadeButton('ENTER COMBAT', { id: 'ff-htp-ok', variant: 'cyan', fullWidth: true, size: 'md' })}
      </div>
    </div>
  `;

  ctx.openModal(html);
  ctx.modalContainer.querySelector('#ff-htp-close')?.addEventListener('click', () => ctx.closeModal());
  ctx.modalContainer.querySelector('#ff-htp-ok')?.addEventListener('click', () => ctx.closeModal());
}
