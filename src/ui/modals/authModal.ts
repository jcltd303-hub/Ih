import { ModalContext } from './ModalContext';
import { AuthManager } from '../../network/AuthManager';

export function showAuthModal(ctx: ModalContext, onUpdated?: () => void): void {
  const auth = AuthManager.getInstance();
  const state = auth.getState();
  const isCloudLinked = !!(state.user && !state.user.isAnonymous);
  const isCustomCallsign = !state.isAnonymous && !isCloudLinked;

  const currentName = state.displayName || 'NEON_STRIKER';

  const html = `
    <div style="
      background: #090d18;
      border: 3px solid #38bdf8;
      box-shadow: 6px 6px 0 #020617;
      border-radius: 2px;
      width: min(440px, 95vw);
      padding: 22px;
      color: #f8fafc;
      font-family: var(--font-display, 'Impact', sans-serif);
      box-sizing: border-box;
      position: relative;
    ">
      <!-- HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e293b; padding-bottom:10px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:20px; font-weight:900; font-style:italic; color:#38bdf8; letter-spacing:1.5px;">
            PILOT DOSSIER
          </span>
          <span style="font-size:10px; font-family:var(--font-mono, monospace); background:#0369a1; color:#e0f2fe; padding:2px 6px; border-radius:2px; font-weight:700;">
            ${isCloudLinked ? 'CLOUD VERIFIED' : isCustomCallsign ? 'REGISTERED' : 'GUEST'}
          </span>
        </div>
        <button id="ff-pilot-close" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:4px 8px; cursor:pointer; font-weight:900; font-family:var(--font-mono);">[X]</button>
      </div>

      <!-- STATUS & FORM -->
      <div style="font-family:var(--font-mono, monospace); font-size:12px; display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; letter-spacing:1px; margin-bottom:4px;">
            PILOT CALLSIGN // HANDLE
          </label>
          <div style="display:flex; gap:8px;">
            <input 
              id="ff-pilot-input" 
              type="text" 
              value="${currentName}" 
              maxlength="18"
              placeholder="ENTER CALLSIGN"
              style="
                flex:1;
                background:#0f172a;
                border:2px solid #334155;
                color:#38bdf8;
                font-family:var(--font-mono, monospace);
                font-size:14px;
                font-weight:900;
                padding:8px 10px;
                border-radius:2px;
                outline:none;
                text-transform:uppercase;
              " 
            />
            <button id="ff-pilot-save-btn" class="ff-arcade-btn ff-arcade-btn-primary" style="padding:8px 14px; font-size:11px; white-space:nowrap;">
              SAVE ID
            </button>
          </div>
        </div>

        <!-- QUICK CALLSIGN PRESETS -->
        <div>
          <div style="font-size:9px; color:#64748b; margin-bottom:4px; font-weight:700; letter-spacing:0.5px;">QUICK CALLSIGNS:</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px;" id="ff-preset-chips">
            <button type="button" class="ff-chip-preset" data-name="NEON_STRIKER" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 7px; cursor:pointer; font-family:var(--font-mono); font-weight:700;">⚡ NEON_STRIKER</button>
            <button type="button" class="ff-chip-preset" data-name="APEX_HUNTER" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 7px; cursor:pointer; font-family:var(--font-mono); font-weight:700;">🦈 APEX_HUNTER</button>
            <button type="button" class="ff-chip-preset" data-name="REEF_SNIPER" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 7px; cursor:pointer; font-family:var(--font-mono); font-weight:700;">🌊 REEF_SNIPER</button>
            <button type="button" class="ff-chip-preset" data-name="TRENCH_VIPER" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 7px; cursor:pointer; font-family:var(--font-mono); font-weight:700;">🐍 TRENCH_VIPER</button>
            <button type="button" class="ff-chip-preset" data-name="ABYSS_RAIDER" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 7px; cursor:pointer; font-family:var(--font-mono); font-weight:700;">⚓ ABYSS_RAIDER</button>
          </div>
        </div>

        <div id="ff-pilot-alert" style="display:none; padding:8px 10px; font-size:11px; border-radius:2px; font-weight:700; font-family:var(--font-mono);"></div>

        <!-- GOOGLE SYNC OPTION -->
        <div style="border-top:1px solid #1e293b; padding-top:12px; margin-top:2px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:10px; color:#94a3b8; font-weight:800; letter-spacing:1px;">
              GOOGLE CLOUD PROFILE
            </span>
            <span style="font-size:9px; color:#64748b;">(CROSS-DEVICE)</span>
          </div>
          
          <button 
            id="ff-google-link-btn" 
            type="button" 
            class="ff-arcade-btn ff-arcade-btn-slate" 
            style="width:100%; padding:9px 12px; font-size:11px; display:flex; justify-content:center; align-items:center; gap:8px;"
          >
            <span>🔗</span>
            <span>${isCloudLinked ? 'CLOUD ACCOUNT CONNECTED' : 'LINK GOOGLE ACCOUNT (OPTIONAL)'}</span>
          </button>
          <div id="ff-google-status" style="margin-top:8px; font-size:10px; color:#94a3b8; line-height:1.4;"></div>
        </div>

        <!-- LOGOUT / RESET -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #1e293b; padding-top:10px; margin-top:2px;">
          <button id="ff-reset-btn" type="button" style="background:transparent; border:none; color:#ef4444; font-size:10px; cursor:pointer; font-weight:700; text-decoration:underline; font-family:var(--font-mono);">
            RESET CALLSIGN / LOG OUT
          </button>
          <span style="font-size:9px; color:#64748b; font-family:var(--font-mono);">UID: ${state.uid.slice(0, 10)}…</span>
        </div>
      </div>
    </div>
  `;

  ctx.openModal(html);

  const container = ctx.modalContainer;
  const closeBtn = container.querySelector('#ff-pilot-close');
  const inputEl = container.querySelector<HTMLInputElement>('#ff-pilot-input');
  const saveBtn = container.querySelector<HTMLButtonElement>('#ff-pilot-save-btn');
  const alertEl = container.querySelector<HTMLElement>('#ff-pilot-alert');
  const googleBtn = container.querySelector<HTMLButtonElement>('#ff-google-link-btn');
  const googleStatus = container.querySelector<HTMLElement>('#ff-google-status');
  const resetBtn = container.querySelector<HTMLButtonElement>('#ff-reset-btn');
  const chipButtons = container.querySelectorAll<HTMLButtonElement>('.ff-chip-preset');

  closeBtn?.addEventListener('click', () => ctx.closeModal());

  chipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      if (name && inputEl) {
        inputEl.value = name;
        inputEl.focus();
      }
    });
  });

  const showAlert = (msg: string, isError = false) => {
    if (!alertEl) return;
    alertEl.style.display = 'block';
    alertEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)';
    alertEl.style.border = isError ? '1px solid #ef4444' : '1px solid #34d399';
    alertEl.style.color = isError ? '#fca5a5' : '#6ee7b7';
    alertEl.textContent = msg;
  };

  saveBtn?.addEventListener('click', async () => {
    const val = inputEl?.value.trim().toUpperCase() || '';
    if (!val) {
      showAlert('Enter a valid callsign (max 18 chars).', true);
      return;
    }
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'SAVING…';
      await auth.setPilotCallsign(val);
      showAlert(`✓ CALLSIGN ACTIVATED: ${val}`);
      saveBtn.textContent = 'SAVED';
      onUpdated?.();
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'SAVE ID';
      }, 1200);
    } catch (e: any) {
      showAlert(e?.message || 'Failed to save callsign.', true);
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE ID';
    }
  });

  googleBtn?.addEventListener('click', async () => {
    if (isCloudLinked) {
      if (googleStatus) {
        googleStatus.innerHTML = `<span style="color:#38bdf8;">✓ Google profile linked. Your cloud data is active.</span>`;
      }
      return;
    }

    if (googleStatus) {
      googleStatus.innerHTML = `<span style="color:#fbbf24;">Connecting to Google Authentication…</span>`;
    }

    try {
      googleBtn.disabled = true;
      await auth.linkGoogle();
      if (googleStatus) {
        googleStatus.innerHTML = `<span style="color:#34d399;">✓ Successfully linked Google account!</span>`;
      }
      onUpdated?.();
      setTimeout(() => ctx.closeModal(), 1000);
    } catch (err: any) {
      googleBtn.disabled = false;
      if (googleStatus) {
        googleStatus.innerHTML = `
          <div style="background:#1e293b; border:1px solid #475569; padding:8px; border-radius:3px; color:#facc15; margin-top:4px;">
            ℹ Note: Google Auth is not configured on this Firebase project.<br/>
            Your game progress, credits, and stats are saved under your Callsign <b>"${inputEl?.value || currentName}"</b>.
          </div>
        `;
      }
    }
  });

  resetBtn?.addEventListener('click', async () => {
    if (window.confirm('Reset pilot callsign back to default Guest?')) {
      await auth.signOut();
      if (inputEl) inputEl.value = 'NEON_STRIKER';
      showAlert('Identity reset to default Guest.');
      onUpdated?.();
      setTimeout(() => ctx.closeModal(), 800);
    }
  });
}
