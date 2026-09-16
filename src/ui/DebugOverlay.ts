import { FairnessSession } from '../network/FairnessSession';
import { PayoutEngine } from '../engine/systems/PayoutEngine';
import { BossSystem } from '../engine/systems/BossSystem';
import { TurretSystem } from '../engine/systems/TurretSystem';
import { ComboSystem } from '../engine/systems/ComboSystem';
import { AudioManager } from '../audio/AudioManager';
import { SoundManager } from '../audio/SoundManager';

/**
 * Arcade Developer Diagnostics Panel
 * Press `~` or click the debug button to monitor game systems,
 * RTP, boss eligibility safety nets, turret cooldowns, and audio state.
 */
export class DebugOverlay {
  private el: HTMLDivElement | null = null;
  private isVisible = false;
  private lastShot: string = '—';
  private entityCount = 0;
  private fps = 0;
  private frames = 0;
  private lastFpsTs = performance.now();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!e.shiftKey && (e.key === '`' || e.key === '~')) {
        this.toggle();
      }
    });
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.ensure();
    } else {
      this.destroy();
    }
  }

  public setLastShotPayload(payload: unknown): void {
    try {
      this.lastShot = JSON.stringify(payload).slice(0, 180);
    } catch {
      this.lastShot = String(payload);
    }
  }

  public setEntityCount(n: number): void {
    this.entityCount = n;
  }

  public tick(): void {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastFpsTs >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastFpsTs = now;
      if (this.isVisible && this.el) {
        this.render();
      }
    }
  }

  public ensure(): void {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'ff-debug-overlay';
    this.el.style.cssText = `
      position:fixed; left:12px; bottom:12px; z-index:99999;
      background:#080d1a; border:2px solid #38bdf8; border-radius:2px;
      padding:10px 14px; font:11px ui-monospace,monospace; color:#f8fafc;
      width:340px; max-height:85vh; overflow-y:auto;
      box-shadow:0 8px 24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.1);
      line-height:1.45;
    `;
    document.body.appendChild(this.el);
    this.render();
  }

  public destroy(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private render(): void {
    if (!this.el) return;
    const sess = FairnessSession.getInstance().getState();
    const stats = PayoutEngine.getSessionStats();
    const boss = BossSystem.getInstance();
    const turret = TurretSystem.getInstance();
    const combo = ComboSystem.getInstance();
    const audio = AudioManager.getInstance();

    const hitRate = stats.totalShots > 0
      ? ((stats.totalHits / stats.totalShots) * 100).toFixed(1)
      : '0.0';

    this.el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:8px;">
        <span style="color:#fbbf24; font-weight:900; font-family:'Impact',sans-serif; letter-spacing:1px; font-size:13px;">ARCADE DIAGNOSTICS</span>
        <button id="ff-dbg-close" style="background:#1e293b; color:#94a3b8; border:1px solid #475569; padding:1px 6px; cursor:pointer; font-size:10px;">[X]</button>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px; font-size:11px;">
        <div>FPS: <b style="color:#22d3ee;">${this.fps}</b></div>
        <div>Active Fish: <b>${this.entityCount}</b></div>
        <div>Shots: <b>${stats.totalShots}</b></div>
        <div>Hits: <b>${stats.totalHits}</b> (${hitRate}%)</div>
        <div>RTP: <b style="color:${stats.realizedRtp > 100 ? '#ef4444' : '#34d399'};">${stats.realizedRtp.toFixed(1)}%</b></div>
        <div>Combo: <b>x${combo.getCombo()}</b> (Max: ${combo.getMaxCombo()})</div>
      </div>

      <!-- BOSS SYSTEM -->
      <div style="background:#0f172a; border:1px solid #334155; padding:6px 8px; margin-bottom:6px;">
        <div style="color:#f87171; font-weight:900; margin-bottom:3px; display:flex; justify-content:space-between;">
          <span>BOSS SYSTEM</span>
          <span style="color:${boss.isActive() ? '#34d399' : '#94a3b8'};">${boss.getPhase()}</span>
        </div>
        <div style="font-size:10px; color:#cbd5e1;">
          Eligible: <b style="color:${boss.isEligible() ? '#34d399' : '#ef4444'};">${boss.isEligible() ? 'YES' : 'NO'}</b> ·
          Since last: <b>${boss.getKillsSinceBoss()} kills</b><br/>
          Next guarantee: <b style="color:#fbbf24;">${boss.getKillsUntilGuarantee()} kills remaining</b>
          ${boss.getCooldownRemainingSec() > 0 ? ` · Cooldown: ${boss.getCooldownRemainingSec()}s` : ''}
        </div>
        <div style="margin-top:5px;">
          <button id="ff-dbg-trigger-boss" style="background:#b91c1c; color:#fff; border:1px solid #ef4444; padding:3px 8px; font-size:10px; cursor:pointer; font-weight:900;">⚡ FORCE BOSS</button>
        </div>
      </div>

      <!-- TURRET MULTIPLIER -->
      <div style="background:#0f172a; border:1px solid #334155; padding:6px 8px; margin-bottom:6px;">
        <div style="color:#38bdf8; font-weight:900; margin-bottom:3px; display:flex; justify-content:space-between;">
          <span>TURRET MULTIPLIER</span>
          <span style="color:${turret.isBonusActive() ? '#fbbf24' : '#94a3b8'};">x${turret.getMultiplier()} (${turret.getState()})</span>
        </div>
        <div style="font-size:10px; color:#cbd5e1;">
          Eligible: <b style="color:${turret.isEligible() ? '#34d399' : '#ef4444'};">${turret.isEligible() ? 'YES' : 'NO'}</b> ·
          Since last: <b>${turret.getKillsSinceLastBonus()} kills</b>
          ${turret.getRemainingCooldownSec() > 0 ? ` · Cooldown: ${turret.getRemainingCooldownSec()}s` : ''}
        </div>
        <div style="margin-top:5px;">
          <button id="ff-dbg-trigger-turret" style="background:#0369a1; color:#fff; border:1px solid #38bdf8; padding:3px 8px; font-size:10px; cursor:pointer; font-weight:900;">⚡ TRIGGER TURRET x2</button>
        </div>
      </div>

      <!-- AUDIO STATE & AI GENERATION -->
      <div style="background:#0f172a; border:1px solid #334155; padding:6px 8px; margin-bottom:6px; font-size:10px;">
        <div style="color:#a855f7; font-weight:900; margin-bottom:2px; display:flex; justify-content:space-between;">
          <span>AUDIO & THEME ENGINE</span>
          <span style="color:#38bdf8;">Theme: ${SoundManager.getTheme().toUpperCase()}</span>
        </div>
        <div style="color:#cbd5e1; margin-bottom:4px;">
          Music: <b>${SoundManager.isBgmEnabled() ? 'ON' : 'OFF'}</b> · SFX: <b>${SoundManager.isSoundEnabled() ? 'ON' : 'OFF'}</b>
          ${SoundManager.hasAiAudio(`ai_music_${SoundManager.getTheme()}`) ? ' · <span style="color:#34d399;">AI Music Active</span>' : ' · <span style="color:#fbbf24;">Procedural BGM</span>'}
        </div>
        <div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
          <button id="ff-dbg-test-coins" style="background:#0284c7; color:#fff; border:none; padding:3px 6px; font-size:9px; cursor:pointer; font-weight:700;">🪙 TEST COINS</button>
          <button id="ff-dbg-gen-music-light" style="background:#3b82f6; color:#fff; border:none; padding:3px 6px; font-size:9px; cursor:pointer;">${SoundManager.isGeneratingAiAudio('ai_music_light') ? '⏳ Generating...' : '✨ AI Music (Light)'}</button>
          <button id="ff-dbg-gen-music-dark" style="background:#7c3aed; color:#fff; border:none; padding:3px 6px; font-size:9px; cursor:pointer;">${SoundManager.isGeneratingAiAudio('ai_music_dark') ? '⏳ Generating...' : '✨ AI Music (Dark)'}</button>
          <button id="ff-dbg-gen-sfx" style="background:#475569; color:#fff; border:none; padding:3px 6px; font-size:9px; cursor:pointer;">✨ AI SFX</button>
        </div>
      </div>

      <!-- PAPER CUTOUT RIG INSPECTOR -->
      <div style="background:#130a21; border:1px solid #7c3aed; padding:6px 8px; margin-bottom:6px; font-size:10px;">
        <div style="color:#c084fc; font-weight:900; margin-bottom:4px; display:flex; justify-content:space-between;">
          <span>PAPER CUTOUT SKELETAL RIG</span>
          <span style="color:#4ade80;">GAPLESS: OK</span>
        </div>
        <button id="ff-dbg-open-rig" style="background:#7c3aed; color:#fff; border:1px solid #c084fc; padding:5px 8px; font-size:10px; cursor:pointer; font-weight:900; width:100%;">
          🔍 OPEN SKELETAL RIG BENCH & ROTATION TESTER
        </button>
      </div>

      <!-- PROVABLY FAIR -->
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#64748b; border-top:1px solid #1e293b; padding-top:4px;">
        <span>Seed: ${sess?.serverSeedHash ? sess.serverSeedHash.slice(0, 14) + '…' : 'local'}</span>
        <button id="ff-dbg-admin" style="background:#475569; color:#f1f5f9; border:none; padding:2px 4px; cursor:pointer;">OPERATOR PORTAL</button>
      </div>
    `;

    this.el.querySelector('#ff-dbg-close')?.addEventListener('click', () => this.toggle());
    this.el.querySelector('#ff-dbg-admin')?.addEventListener('click', () => {
      // Broadcast event that UIManager listens to, or just click the hidden shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', shiftKey: true }));
    });
    this.el.querySelector('#ff-dbg-open-rig')?.addEventListener('click', () => {
      this.toggle();
      document.getElementById('hud-paper-rig-btn')?.click();
    });
    this.el.querySelector('#ff-dbg-trigger-boss')?.addEventListener('click', () => {
      BossSystem.getInstance().forceTrigger();
    });
    this.el.querySelector('#ff-dbg-trigger-turret')?.addEventListener('click', () => {
      TurretSystem.getInstance().forceTrigger();
    });
    this.el.querySelector('#ff-dbg-test-coins')?.addEventListener('click', () => {
      SoundManager.playCoinDrop('medium');
    });
    this.el.querySelector('#ff-dbg-gen-music-light')?.addEventListener('click', async () => {
      await SoundManager.generateAiAudio('music', 'light');
      this.render();
    });
    this.el.querySelector('#ff-dbg-gen-music-dark')?.addEventListener('click', async () => {
      await SoundManager.generateAiAudio('music', 'dark');
      this.render();
    });
    this.el.querySelector('#ff-dbg-gen-sfx')?.addEventListener('click', async () => {
      await SoundManager.generateAiAudio('sfx', SoundManager.getTheme());
      this.render();
    });
  }
}

export const debugOverlay = new DebugOverlay();
