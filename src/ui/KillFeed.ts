import { GameEventBus, FishKilledEvent } from '../engine/core/GameEvents';

export class KillFeed {
  private container: HTMLDivElement | null = null;
  private items: Array<{ el: HTMLDivElement; timeoutId: number }> = [];
  private readonly MAX_ITEMS = 4;

  constructor(parent: HTMLElement) {
    this.createContainer(parent);
    this.setupListeners();
  }

  private createContainer(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'ff-kill-feed';
    this.container.style.cssText = `
      position: absolute;
      top: 76px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
      z-index: 25;
      font-family: var(--font-display, 'Impact', sans-serif);
      font-style: italic;
      letter-spacing: 1px;
    `;
    parent.appendChild(this.container);
  }

  private setupListeners(): void {
    GameEventBus.getInstance().on<FishKilledEvent>('FISH_KILLED', (event) => {
      this.addItem(event);
    });
  }

  public addItem(event: FishKilledEvent): void {
    if (!this.container) return;

    // Prune oldest if at capacity
    if (this.items.length >= this.MAX_ITEMS) {
      const oldest = this.items.shift();
      if (oldest) {
        clearTimeout(oldest.timeoutId);
        oldest.el.remove();
      }
    }

    const item = document.createElement('div');
    item.className = 'ff-kill-feed-item';

    const isBoss = event.fishType === 'boss';
    const isBig = event.payout >= 5 || event.multiplier >= 4;

    const bg = isBoss
      ? 'rgba(185, 28, 28, 0.9)'
      : isBig
      ? 'rgba(180, 83, 9, 0.9)'
      : 'rgba(15, 23, 42, 0.85)';

    const border = isBoss
      ? '#ef4444'
      : isBig
      ? '#fbbf24'
      : '#38bdf8';

    const color = isBoss
      ? '#fee2e2'
      : isBig
      ? '#fef08a'
      : '#f8fafc';

    item.style.cssText = `
      background: ${bg};
      border: 1px solid ${border};
      border-radius: 2px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 900;
      color: ${color};
      box-shadow: 2px 2px 0 #020617;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 140px;
      justify-content: space-between;
    `;

    const payoutText = `+${event.payout.toFixed(2)} ${event.currency}`;

    item.innerHTML = `
      <span style="text-transform:uppercase;">${event.name}</span>
      <span style="color:#fbbf24; font-size:13px;">${payoutText}</span>
    `;

    this.container.appendChild(item);

    const timeoutId = window.setTimeout(() => {
      item.remove();
      this.items = this.items.filter((i) => i.el !== item);
    }, 2600);

    this.items.push({ el: item, timeoutId });
  }

  public destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.items.forEach((i) => clearTimeout(i.timeoutId));
    this.items = [];
  }
}
