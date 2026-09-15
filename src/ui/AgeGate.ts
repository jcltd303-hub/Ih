const KEY = 'fish_frenzy_age_ok_v1';

export function hasPassedAgeGate(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Simple 18+ gate before play. Not a substitute for legal compliance. */
export function showAgeGate(root: HTMLElement): Promise<boolean> {
  if (hasPassedAgeGate()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'ff-age-gate';
    el.style.cssText = `
      position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
      background:rgba(2,6,18,0.94);font-family:ui-monospace,monospace;color:#e2e8f0;padding:20px;
    `;
    el.innerHTML = `
      <div style="max-width:420px;background:#0f172a;border:1px solid #334155;border-radius:0;padding:22px;">
        <div style="font-size:11px;color:#fbbf24;letter-spacing:2px;font-weight:800;margin-bottom:8px;">AGE CONFIRMATION</div>
        <p style="font-size:13px;line-height:1.5;color:#cbd5e1;margin:0 0 12px;">
          Fish Frenzy is intended for adults (18+). SC balances are demo/promotional unless your operator has completed legal review.
        </p>
        <p style="font-size:11px;color:#64748b;margin:0 0 16px;">
          <a href="/legal/terms.html" style="color:#38bdf8;">Terms</a> ·
          <a href="/legal/privacy.html" style="color:#38bdf8;">Privacy</a> ·
          <a href="/legal/responsible.html" style="color:#38bdf8;">Responsible play</a>
        </p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="ff-age-no" style="background:transparent;border:1px solid #475569;color:#94a3b8;padding:10px 14px;border-radius:8px;cursor:pointer;">Exit</button>
          <button id="ff-age-yes" style="background:#00ffcc;border:none;color:#0a0f1d;padding:10px 16px;border-radius:8px;font-weight:800;cursor:pointer;">I am 18+</button>
        </div>
      </div>`;
    root.appendChild(el);
    el.querySelector('#ff-age-no')?.addEventListener('click', () => {
      el.innerHTML = `<div style="color:#94a3b8;text-align:center;">You must be 18+ to play.</div>`;
      resolve(false);
    });
    el.querySelector('#ff-age-yes')?.addEventListener('click', () => {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* ignore */
      }
      el.remove();
      resolve(true);
    });
  });
}
