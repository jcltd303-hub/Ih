import { GameEventBus, FishKilledEvent } from '../engine/core/GameEvents';

export class KillFeed {
  private container: HTMLDivElement | null = null;
  private items: Array<{ el: HTMLDivElement; timeoutId: number; fadeId?: number }> = [];
  private readonly MAX_ITEMS = 4;
  private unsub: (() => void) | null = null;
  private roundKills = 0;
  private streakEl: HTMLDivElement | null = null;
  private streakTimerId: number | null = null;

  constructor(parent: HTMLElement) {
    this.createContainer(parent);
    this.setupListeners();
  }

  private createContainer(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'ff-kill-feed';
    this.container.style.cssText = `position:absolute;top:clamp(126px,16vh,154px);right:14px;display:flex;flex-direction:column;align-items:flex-end;gap:5px;pointer-events:none;z-index:25;font-family:var(--font-display,'Impact','Arial Black',sans-serif);font-style:italic;letter-spacing:1px;filter:drop-shadow(2px 3px 0 #020617);`;
    this.streakEl = document.createElement('div');
    this.streakEl.style.cssText = 'display:none;align-items:baseline;gap:7px;margin-bottom:2px;padding:2px 7px;border-right:4px solid #facc15;color:#facc15;background:linear-gradient(90deg,rgba(5,7,15,.18),rgba(5,7,15,.82));font-weight:900;transform:skewX(-8deg);';
    this.streakEl.innerHTML = '<span style="font-size:9px;letter-spacing:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">K.O. STREAK</span><span id="ff-kill-streak-count" style="font-size:22px;line-height:1;">00</span>';
    this.container.appendChild(this.streakEl);
    parent.appendChild(this.container);
  }

  private setupListeners(): void {
    const bus = GameEventBus.getInstance();
    const killUnsub = bus.on<FishKilledEvent>('FISH_KILLED', (event) => this.addItem(event));
    const roundUnsub = bus.on('ROUND_END', () => this.resetStreak());
    this.unsub = () => {
      killUnsub();
      roundUnsub();
    };
  }

  public addItem(event: FishKilledEvent): void {
    if (!this.container) return;
    this.roundKills += 1;
    this.updateStreak();

    if (this.items.length >= this.MAX_ITEMS) {
      const oldest = this.items.shift();
      if (oldest) {
        clearTimeout(oldest.timeoutId);
        if (oldest.fadeId) clearTimeout(oldest.fadeId);
        oldest.el.remove();
      }
    }

    const item = document.createElement('div');
    item.className = 'ff-kill-feed-item';
    const isBoss = event.fishType === 'boss';
    const isBig = event.payout >= 5 || event.multiplier >= 4;
    const accent = isBoss ? '#ef4444' : isBig ? '#facc15' : '#22d3ee';
    const label = isBoss ? 'BOSS K.O.' : isBig ? 'HEAVY K.O.' : 'K.O.';
    const payoutText = `+${event.payout.toFixed(2)} ${event.currency}`;

    item.style.cssText = `padding:5px 7px 5px 10px;border-right:4px solid ${accent};background:linear-gradient(90deg,rgba(5,7,15,.18),rgba(5,7,15,.9));min-width:190px;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#f8fafc;font-size:12px;font-weight:900;text-shadow:2px 2px 0 #020617;transform:skewX(-8deg) translateX(12px) scale(.98);opacity:0;transition:transform .12s cubic-bezier(.17,.89,.32,1.25),opacity .12s ease-out;`;
    item.innerHTML = `<span style="font:900 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.5px;color:${accent};white-space:nowrap;">${label}</span><span style="text-transform:uppercase;letter-spacing:.7px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${event.name}</span><span style="color:#facc15;font-size:13px;white-space:nowrap;">${payoutText}</span>`;
    this.container.appendChild(item);

    requestAnimationFrame(() => {
      item.style.transform = 'skewX(-8deg) translateX(0) scale(1)';
      item.style.opacity = '1';
    });

    if (isBoss) {
      this.showStreakPulse('BOSS DOWN');
    } else if (this.roundKills % 5 === 0) {
      this.showStreakPulse(`${this.roundKills} K.O.`);
    }

    const timeoutId = window.setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'skewX(-8deg) translateX(18px) scale(.98)';
      const fadeId = window.setTimeout(() => {
        item.remove();
        this.items = this.items.filter((i) => i.el !== item);
      }, 120);
      const record = this.items.find((i) => i.el === item);
      if (record) record.fadeId = fadeId;
    }, isBoss ? 3400 : 2500);
    this.items.push({ el: item, timeoutId });
  }

  private updateStreak(): void {
    if (!this.streakEl) return;
    const count = this.streakEl.querySelector<HTMLElement>('#ff-kill-streak-count');
    if (count) count.textContent = String(Math.min(99, this.roundKills)).padStart(2, '0');
    this.streakEl.style.display = 'flex';
    if (this.roundKills >= 10) {
      this.streakEl.style.color = '#ef4444';
      this.streakEl.style.borderRightColor = '#ef4444';
    } else {
      this.streakEl.style.color = '#facc15';
      this.streakEl.style.borderRightColor = '#facc15';
    }
    if (this.streakTimerId !== null) window.clearTimeout(this.streakTimerId);
    this.streakTimerId = window.setTimeout(() => {
      if (this.roundKills > 0 && this.streakEl) this.streakEl.style.display = 'none';
      this.streakTimerId = null;
    }, 3200);
  }

  private showStreakPulse(text: string): void {
    if (!this.streakEl) return;
    const count = this.streakEl.querySelector<HTMLElement>('#ff-kill-streak-count');
    if (!count) return;
    count.textContent = text;
    count.style.fontSize = '15px';
    count.style.letterSpacing = '1px';
    this.streakEl.style.display = 'flex';
    requestAnimationFrame(() => {
      if (!this.streakEl || !count) return;
      this.streakEl.style.transform = 'skewX(-8deg) scale(1.08)';
      window.setTimeout(() => {
        if (this.streakEl && count) {
          this.streakEl.style.transform = 'skewX(-8deg) scale(1)';
          count.style.fontSize = '22px';
          count.style.letterSpacing = '0';
          count.textContent = String(Math.min(99, this.roundKills)).padStart(2, '0');
        }
      }, 140);
    });
  }

  private resetStreak(): void {
    this.roundKills = 0;
    if (this.streakTimerId !== null) {
      window.clearTimeout(this.streakTimerId);
      this.streakTimerId = null;
    }
    if (this.streakEl) this.streakEl.style.display = 'none';
  }

  public destroy(): void {
    this.unsub?.();
    this.unsub = null;
    if (this.streakTimerId !== null) window.clearTimeout(this.streakTimerId);
    this.streakTimerId = null;
    this.items.forEach((i) => {
      clearTimeout(i.timeoutId);
      if (i.fadeId) clearTimeout(i.fadeId);
    });
    this.items = [];
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.streakEl = null;
  }
}
