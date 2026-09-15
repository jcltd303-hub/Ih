import { ModalContext } from './ModalContext';
import { AudioManager } from '../../audio/AudioManager';
import { ThemeManager, GameTheme } from '../../engine/systems/ThemeManager';
import { ARCADE } from '../StyleConstants';

export function showOptionsModal(ctx: ModalContext, onThemeChange?: (theme: GameTheme) => void): void {
  const audio = AudioManager.getInstance();
  const volumes = audio.getVolumes();
  const themeMgr = ThemeManager.getInstance();
  const currentTheme = themeMgr ? themeMgr.getTheme() : 'light';
  const dark = currentTheme === 'dark';
  const panel = dark ? '#07030c' : '#f8fafc';
  const card = dark ? '#100817' : '#e0f2fe';
  const ink = dark ? '#f8fafc' : '#0f172a';
  const muted = dark ? '#a1a1aa' : '#475569';
  const border = dark ? '#7e22ce' : '#0284c7';
  const accent = dark ? '#e879f9' : '#0284c7';

  const html = `<div style="background:${panel};border:3px solid ${border};box-shadow:6px 6px 0 #020617,0 0 24px ${dark ? 'rgba(217,70,239,.22)' : 'rgba(14,165,233,.18)'};border-radius:1px;width:min(430px,95vw);padding:20px;color:${ink};font-family:var(--font-display,'Impact',sans-serif);box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${border};padding-bottom:9px;margin-bottom:16px;">
      <span style="font-size:21px;font-weight:900;font-style:italic;letter-spacing:1px;">OPTIONS // AUDIO</span>
      <button id="ff-opt-close" aria-label="Close options" style="background:${card};color:${muted};border:1px solid ${border};padding:5px 9px;cursor:pointer;font-weight:900;">[X]</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;font-family:var(--font-mono,monospace);font-size:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;background:${card};padding:10px;border:1px solid ${border};"><span>AUDIO OUTPUT</span><button id="ff-opt-mute-btn" style="background:${audio.getIsMuted() ? '#991b1b' : accent};color:#fff;border:1px solid ${audio.getIsMuted() ? '#ef4444' : accent};padding:6px 12px;font-weight:900;cursor:pointer;font-family:var(--font-display);">${audio.getIsMuted() ? 'MUTED' : 'ACTIVE'}</button></div>
      <div style="background:${card};padding:10px;border:1px solid ${border};display:flex;flex-direction:column;gap:9px;">
        <label style="display:flex;justify-content:space-between;align-items:center;">MUSIC <span id="ff-opt-music-val">${Math.round(volumes.music * 100)}%</span></label>
        <input aria-label="Music volume" type="range" id="ff-opt-music-slider" min="0" max="100" value="${Math.round(volumes.music * 100)}" style="width:100%;accent-color:${accent};cursor:pointer;" />
        <label style="display:flex;justify-content:space-between;align-items:center;">SFX <span id="ff-opt-sfx-val">${Math.round(volumes.sfx * 100)}%</span></label>
        <input aria-label="SFX volume" type="range" id="ff-opt-sfx-slider" min="0" max="100" value="${Math.round(volumes.sfx * 100)}" style="width:100%;accent-color:${dark ? '#facc15' : '#f59e0b'};cursor:pointer;" />
      </div>
      <div style="background:${card};padding:10px;border:1px solid ${border};"><div style="margin-bottom:7px;color:${muted};font-weight:900;">COMBAT THEME</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button id="ff-opt-theme-light" style="background:${currentTheme === 'light' ? '#0284c7' : '#cbd5e1'};color:${currentTheme === 'light' ? '#fff' : '#0f172a'};border:2px solid #0284c7;padding:9px;font-weight:900;cursor:pointer;font-family:var(--font-display);font-style:italic;">SUNLIT</button>
        <button id="ff-opt-theme-dark" style="background:${currentTheme === 'dark' ? '#701a75' : '#cbd5e1'};color:${currentTheme === 'dark' ? '#fff' : '#0f172a'};border:2px solid #a855f7;padding:9px;font-weight:900;cursor:pointer;font-family:var(--font-display);font-style:italic;">ABYSS</button>
      </div></div>
    </div>
    <div style="margin-top:16px;">${ARCADE.arcadeButton('DONE', { id: 'ff-opt-done', variant: 'slate', fullWidth: true, size: 'md' })}</div>
  </div>`;

  ctx.openModal(html);
  ctx.modalContainer.querySelector('#ff-opt-close')?.addEventListener('click', () => ctx.closeModal());
  ctx.modalContainer.querySelector('#ff-opt-done')?.addEventListener('click', () => ctx.closeModal());
  const muteBtn = ctx.modalContainer.querySelector('#ff-opt-mute-btn') as HTMLButtonElement | null;
  muteBtn?.addEventListener('click', () => { const muted = audio.toggleMute(); if (muteBtn) muteBtn.textContent = muted ? 'MUTED' : 'ACTIVE'; });
  const musicSlider = ctx.modalContainer.querySelector('#ff-opt-music-slider') as HTMLInputElement | null;
  const sfxSlider = ctx.modalContainer.querySelector('#ff-opt-sfx-slider') as HTMLInputElement | null;
  const musicVal = ctx.modalContainer.querySelector('#ff-opt-music-val');
  const sfxVal = ctx.modalContainer.querySelector('#ff-opt-sfx-val');
  const onVolumeChange = () => { const m = (musicSlider ? parseInt(musicSlider.value, 10) : 70) / 100; const s = (sfxSlider ? parseInt(sfxSlider.value, 10) : 100) / 100; if (musicVal) musicVal.textContent = `${Math.round(m * 100)}%`; if (sfxVal) sfxVal.textContent = `${Math.round(s * 100)}%`; audio.setVolumes(1.0, m, s); };
  musicSlider?.addEventListener('input', onVolumeChange);
  sfxSlider?.addEventListener('input', onVolumeChange);
  ctx.modalContainer.querySelector('#ff-opt-theme-light')?.addEventListener('click', () => { if (themeMgr) void themeMgr.setTheme('light'); onThemeChange?.('light'); ctx.closeModal(); });
  ctx.modalContainer.querySelector('#ff-opt-theme-dark')?.addEventListener('click', () => { if (themeMgr) void themeMgr.setTheme('dark'); onThemeChange?.('dark'); ctx.closeModal(); });
}
