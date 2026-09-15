import { GameEventBus, FishKilledEvent } from '../engine/core/GameEvents';

export class KillFeed {
  private container: HTMLDivElement | null = null;
  private items: Array<{ el: HTMLDivElement; timeoutId: number }> = [];
  private readonly MAX_ITEMS = 4;
  private unsub: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.createContainer(parent);
    this.setupListeners();
  }

  private createContainer(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'ff-kill-feed';
    this.container.style.cssText = `position:absolute;top:clamp(126px,16vh,154px);right:14px;display:flex;flex-direction:column;gap:5px;pointer-events:none;z-index:25;font-family:var(--font-display,'Impact','Arial Black',sans-serif);font-style:italic;letter-spacing:1px;filter:drop-shadow(2px 3px 0 #020617);`;
    parent.appendChild(this.container);
  }

  private setupListeners(): void {
    this.unsub = GameEventBus.getInstance().on<FishKilledEvent>('FISH_KILLED', (event) => this.addItem(event));
  }

  public addItem(event: FishKilledEvent): void {
    if (!this.container) return;
    if (this.items.length >= this.MAX_ITEMS) {
      const oldest = this.items.shift();
      if (oldest) { clearTimeout(oldest.timeoutId); oldest.el.remove(); }
    }

    const item = document.createElement('div');
    item.className = 'ff-kill-feed-item';
    const isBoss = event.fishType === 'boss';
    const isBig = event.payout >= 5 || event.multiplier >= 4;
    const accent = isBoss ? '#ef4444' : isBig ? '#facc15' : '#22d3ee';
    const label = isBoss ? 'BOSS' : isBig ? 'HEAVY' : 'K.O.';
    item.style.cssText = `padding:4px 7px 4px 9px;border-right:4px solid ${accent};background:linear-gradient(90deg,rgba(5,7,15,.28),rgba(5,7,15,.86));min-width:190px;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#f8fafc;font-size:12px;font-weight:900;text-shadow:2px 2px 0 #020617;transform:skewX(-8deg) translateX(8px);opacity:0;transition:transform .12s ease-out,opacity .12s ease-out;`;

    const payoutText = `+${event.payout.toFixed(2)} ${event.currency}`;
    item.innerHTML = `<span style="font:900 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.5px;color:${accent};">${label}</span><span style="text-transform:uppercase;letter-spacing:.7px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${event.name}</span><span style="color:#facc15;font-size:13px;white-space:nowrap;">${payoutText}</span>`;
    this.container.appendChild(item);

    requestAnimationFrame(() => { item.style.transform = 'skewX(-8deg) translateX(0)'; item.style.opacity = '1'; });
    const timeoutId = window.setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'skewX(-8deg) translateX(18px)';
      window.setTimeout(() => { item.remove(); this.items = this.items.filter((i) => i.el !== item); }, 120);
    }, 2500);
    this.items.push({ el: item, timeoutId });
  }

  public destroy(): void {
    this.unsub?.();
    this.unsub = null;
    if (this.container) { this.container.remove(); this.container = null; }
    this.items.forEach((i) => clearTimeout(i.timeoutId));
    this.items = [];
  }
}
