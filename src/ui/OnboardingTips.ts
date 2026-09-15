import { FeatureFlags } from '../config/FeatureFlags';

const KEY = 'fish_frenzy_onboarding_v2';

const TIPS = [
  'Aim with mouse or finger — the turret follows your pointer.',
  'Hold to fire continuously. Release to stop. Each shot costs your Lobby stake.',
  'Open LOBBY to set SC/GC and bet amount. Combat HUD is display-only for stake.',
  'STORE in Lobby: buy GC. Higher packs grant free bonus SC (top pack 10%). $4.99 is GC only.',
  'When BOSS BASH appears, focus fire — phases change armor and speed.',
  'Level bar tracks progression. Streak rewards appear once per day on login.'
];

export function maybeShowOnboarding(root: HTMLElement): void {
  if (!FeatureFlags.onboarding) return;
  try {
    if (localStorage.getItem(KEY) === '1') return;
  } catch {
    return;
  }

  const el = document.createElement('div');
  el.id = 'ff-onboarding';
  el.style.cssText = `
    position:absolute; inset:0; z-index:45; display:flex; align-items:center; justify-content:center;
    background:rgba(2,6,18,0.86); font-family:ui-monospace,monospace; color:#e2e8f0; padding:20px;
  `;
  let i = 0;
  const render = () => {
    el.innerHTML = `
      <div style="max-width:440px; background:#0f172a; border:2px solid #22d3ee; border-radius:14px; padding:22px;
        box-shadow:0 0 28px rgba(34,211,238,0.2);">
        <div style="font-size:11px; color:#22d3ee; letter-spacing:2px; margin-bottom:8px; font-weight:800;">ELECTRIC RAGE · TIP ${i + 1}/${TIPS.length}</div>
        <p style="margin:0 0 18px; font-size:14px; line-height:1.5;">${TIPS[i]}</p>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="ff-tip-skip" style="background:transparent;border:1px solid #475569;color:#94a3b8;padding:8px 14px;border-radius:8px;cursor:pointer;">Skip</button>
          <button id="ff-tip-next" style="background:linear-gradient(180deg,#155e75,#0e7490);border:2px solid #22d3ee;color:#ecfeff;padding:8px 16px;border-radius:8px;font-weight:800;cursor:pointer;">
            ${i === TIPS.length - 1 ? 'Play' : 'Next'}
          </button>
        </div>
      </div>`;
    el.querySelector('#ff-tip-skip')?.addEventListener('click', finish);
    el.querySelector('#ff-tip-next')?.addEventListener('click', () => {
      if (i >= TIPS.length - 1) finish();
      else {
        i++;
        render();
      }
    });
  };
  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    el.remove();
  };
  render();
  root.appendChild(el);
}
