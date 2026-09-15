import { ModalContext } from './ModalContext';
import { AudioManager } from '../../audio/AudioManager';
import { ThemeManager, GameTheme } from '../../engine/systems/ThemeManager';
import { ARCADE } from '../StyleConstants';

export function showOptionsModal(
  ctx: ModalContext,
  onThemeChange?: (theme: GameTheme) => void
): void {
  const audio = AudioManager.getInstance();
  const volumes = audio.getVolumes();
  const themeMgr = ThemeManager.getInstance();
  const currentTheme = themeMgr ? themeMgr.getTheme() : 'light';

  const html = `
    <div style="
      background: #090d18;
      border: 3px solid #64748b;
      box-shadow: 4px 4px 0 #020617;
      border-radius: 2px;
      width: min(400px, 95vw);
      padding: 20px;
      color: #f8fafc;
      font-family: var(--font-display, 'Impact', sans-serif);
      box-sizing: border-box;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 16px;">
        <span style="font-size: 20px; font-weight: 900; font-style: italic; color: #f8fafc; letter-spacing: 1px;">
          OPTIONS & AUDIO
        </span>
        <button id="ff-opt-close" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:4px 8px; cursor:pointer; font-weight:900;">[X]</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:14px; font-family:var(--font-mono, monospace); font-size:12px;">
        <!-- MUTE TOGGLE -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:10px; border:1px solid #334155;">
          <span>AUDIO OUTPUT</span>
          <button id="ff-opt-mute-btn" style="
            background:${audio.getIsMuted() ? '#b91c1c' : '#0369a1'};
            color:#fff; border:1px solid ${audio.getIsMuted() ? '#ef4444' : '#38bdf8'};
            padding:5px 12px; font-weight:900; cursor:pointer; font-family:var(--font-display);
          ">
            ${audio.getIsMuted() ? 'MUTED 🔇' : 'ACTIVE 🔊'}
          </button>
        </div>

        <!-- VOLUME SLIDERS -->
        <div style="background:#0f172a; padding:10px; border:1px solid #334155; display:flex; flex-direction:column; gap:8px;">
          <div>
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
              <span>MUSIC VOLUME</span>
              <span id="ff-opt-music-val">${Math.round(volumes.music * 100)}%</span>
            </div>
            <input type="range" id="ff-opt-music-slider" min="0" max="100" value="${Math.round(volumes.music * 100)}" style="width:100%; accent-color:#38bdf8; cursor:pointer;" />
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
              <span>SFX VOLUME</span>
              <span id="ff-opt-sfx-val">${Math.round(volumes.sfx * 100)}%</span>
            </div>
            <input type="range" id="ff-opt-sfx-slider" min="0" max="100" value="${Math.round(volumes.sfx * 100)}" style="width:100%; accent-color:#fbbf24; cursor:pointer;" />
          </div>
        </div>

        <!-- THEME SELECTOR -->
        <div style="background:#0f172a; padding:10px; border:1px solid #334155;">
          <div style="margin-bottom:6px; color:#94a3b8; font-weight:900;">COMBAT THEME ART DIRECTION</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button id="ff-opt-theme-light" style="
              background:${currentTheme === 'light' ? '#0369a1' : '#1e293b'};
              color:#fff; border:2px solid ${currentTheme === 'light' ? '#38bdf8' : '#475569'};
              padding:8px; font-weight:900; cursor:pointer; font-family:var(--font-display); font-style:italic;
            ">
              ☀ SUNLIT TROPICAL
            </button>
            <button id="ff-opt-theme-dark" style="
              background:${currentTheme === 'dark' ? '#701a75' : '#1e293b'};
              color:#fff; border:2px solid ${currentTheme === 'dark' ? '#d946ef' : '#475569'};
              padding:8px; font-weight:900; cursor:pointer; font-family:var(--font-display); font-style:italic;
            ">
              ☾ DEEP-SEA ABYSS
            </button>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;">
        ${ARCADE.arcadeButton('DONE', { id: 'ff-opt-done', variant: 'slate', fullWidth: true, size: 'md' })}
      </div>
    </div>
  `;

  ctx.openModal(html);

  ctx.modalContainer.querySelector('#ff-opt-close')?.addEventListener('click', () => ctx.closeModal());
  ctx.modalContainer.querySelector('#ff-opt-done')?.addEventListener('click', () => ctx.closeModal());

  const muteBtn = ctx.modalContainer.querySelector('#ff-opt-mute-btn') as HTMLButtonElement | null;
  muteBtn?.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    if (muteBtn) {
      muteBtn.textContent = isMuted ? 'MUTED 🔇' : 'ACTIVE 🔊';
      muteBtn.style.background = isMuted ? '#b91c1c' : '#0369a1';
      muteBtn.style.borderColor = isMuted ? '#ef4444' : '#38bdf8';
    }
  });

  const musicSlider = ctx.modalContainer.querySelector('#ff-opt-music-slider') as HTMLInputElement | null;
  const sfxSlider = ctx.modalContainer.querySelector('#ff-opt-sfx-slider') as HTMLInputElement | null;
  const musicVal = ctx.modalContainer.querySelector('#ff-opt-music-val');
  const sfxVal = ctx.modalContainer.querySelector('#ff-opt-sfx-val');

  const onVolumeChange = () => {
    const m = (musicSlider ? parseInt(musicSlider.value, 10) : 70) / 100;
    const s = (sfxSlider ? parseInt(sfxSlider.value, 10) : 100) / 100;
    if (musicVal) musicVal.textContent = `${Math.round(m * 100)}%`;
    if (sfxVal) sfxVal.textContent = `${Math.round(s * 100)}%`;
    audio.setVolumes(1.0, m, s);
  };

  musicSlider?.addEventListener('input', onVolumeChange);
  sfxSlider?.addEventListener('input', onVolumeChange);

  ctx.modalContainer.querySelector('#ff-opt-theme-light')?.addEventListener('click', () => {
    if (themeMgr) void themeMgr.setTheme('light');
    if (onThemeChange) onThemeChange('light');
    ctx.closeModal();
  });

  ctx.modalContainer.querySelector('#ff-opt-theme-dark')?.addEventListener('click', () => {
    if (themeMgr) void themeMgr.setTheme('dark');
    if (onThemeChange) onThemeChange('dark');
    ctx.closeModal();
  });
}
