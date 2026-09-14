import { FeatureFlags } from '../config/FeatureFlags';

const KEY = 'fish_frenzy_onboarding_v1';

const TIPS = [
  'Aim with mouse/touch — click to fire the trench cannon.',
  'Set your stake in the Lobby. Auto-fire engages on canvas hold.',
  'Level up your skill through gameplay to unlock advanced turret chassis and lucky overcharges.',
  'Leviathan has 3 phases — armor, exposed core, then overdrive.'
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
    background:rgba(2,6,18,0.82); font-family:ui-monospace,monospace; color:#e2e8f0; padding:20px;
  `;
  let i = 0;
  const render = () => {
    el.innerHTML = `
      <div style="max-width:420px; background:#0f172a; border:1px solid #334155; border-radius:14px; padding:22px;">
        <div style="font-size:11px; color:#00ffcc; letter-spacing:2px; margin-bottom:8px;">TIP ${i + 1}/${TIPS.length}</div>
        <p style="margin:0 0 18px; font-size:14px; line-height:1.5;">${TIPS[i]}</p>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="ff-tip-skip" style="background:transparent;border:1px solid #475569;color:#94a3b8;padding:8px 14px;border-radius:8px;cursor:pointer;">Skip</button>
          <button id="ff-tip-next" style="background:#00ffcc;border:none;color:#0a0f1d;padding:8px 16px;border-radius:8px;font-weight:800;cursor:pointer;">
            ${i === TIPS.length - 1 ? 'Got it' : 'Next'}
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
