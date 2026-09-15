import { FairnessSession } from '../network/FairnessSession';
import { PayoutEngine } from '../engine/systems/PayoutEngine';

/**
 * Lightweight debug HUD when localStorage fish_frenzy_debug=1
 */
export class DebugOverlay {
  private el: HTMLDivElement | null = null;
  private lastShot: string = '—';
  private entityCount = 0;
  private fps = 0;
  private frames = 0;
  private lastFpsTs = performance.now();

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
      this.render();
    }
  }

  public ensure(): void {
    if (localStorage.getItem('fish_frenzy_debug') !== '1') {
      this.destroy();
      return;
    }
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'ff-debug-overlay';
    this.el.style.cssText = `
      position:fixed; left:8px; bottom:8px; z-index:9999; pointer-events:none;
      background:rgba(2,6,18,0.85); border:1px solid #334155; border-radius:8px;
      padding:8px 10px; font:11px ui-monospace,monospace; color:#94a3b8; max-width:360px;
    `;
    document.body.appendChild(this.el);
    this.render();
  }

  private render(): void {
    if (!this.el) return;
    const sess = FairnessSession.getInstance().getState();
    const stats = PayoutEngine.getSessionStats();
    this.el.innerHTML = `
      <div style="color:#fbbf24;font-weight:800;">DEBUG</div>
      <div>FPS ${this.fps} · entities ${this.entityCount}</div>
      <div>RTP target 85% · realized ${stats.realizedRtp.toFixed(1)}%</div>
      <div>shots ${stats.totalShots} hits ${stats.totalHits}</div>
      <div style="word-break:break-all;">session ${sess?.sessionId || '—'} (${sess?.status || 'n/a'})</div>
      <div style="word-break:break-all;color:#64748b;">last shot ${this.lastShot}</div>
    `;
  }

  public destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}

export const debugOverlay = new DebugOverlay();
