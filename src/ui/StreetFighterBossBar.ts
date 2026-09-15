import { GameEventBus, BossStateEvent } from '../engine/core/GameEvents';

export class StreetFighterBossBar {
  private container: HTMLDivElement | null = null;
  private activeBar: HTMLDivElement | null = null;
  private trailingBar: HTMLDivElement | null = null;
  private timerEl: HTMLElement | null = null;
  private hpTextEl: HTMLElement | null = null;
  private damageEl: HTMLElement | null = null;
  private nameEl: HTMLElement | null = null;
  private phaseEl: HTMLElement | null = null;
  private isVisible = false;

  constructor(parent: HTMLElement) {
    this.render(parent);
    this.setupListeners();
  }

  private render(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'sf-boss-bar-widget';
    this.container.style.cssText = `
      position: absolute;
      top: 12px;
      right: 16px;
      width: min(340px, calc(100vw - 32px));
      z-index: 30;
      display: none;
      flex-direction: column;
      pointer-events: none;
      font-family: var(--font-display, 'Impact', sans-serif);
      letter-spacing: 1px;
    `;

    this.container.innerHTML = `
      <!-- Boss Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="background:#b91c1c; color:#fff; border:1px solid #ef4444; font-size:10px; font-weight:900; padding:1px 4px; font-style:italic;">TARGET</span>
          <span id="sf-boss-name" style="color:#f8fafc; font-size:14px; font-weight:900; font-style:italic; text-shadow:0 2px 4px #000;">APEX LEVIATHAN</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size:11px; font-family:var(--font-mono, monospace);">
          <span id="sf-boss-multiplier" style="color:#fbbf24; font-weight:900;">x2.5 BOUNTY</span>
          <span id="sf-boss-timer" style="color:#ef4444; font-weight:900;">35s</span>
        </div>
      </div>

      <!-- Street Fighter Dual-Layer Bar -->
      <div class="sf-bar-frame" style="height: 18px;">
        <div class="sf-bar-depleted"></div>
        <div id="sf-boss-bar-trailing" class="sf-bar-trailing" style="width: 100%;"></div>
        <div id="sf-boss-bar-active" class="sf-bar-active" style="width: 100%;"></div>
        <div class="sf-bar-segments"></div>
      </div>

      <!-- Sub stats -->
      <div style="display:flex; justify-content:space-between; margin-top:3px; font-size:10px; color:#cbd5e1; font-family:var(--font-mono, monospace);">
        <span id="sf-boss-damage">DMG: 0</span>
        <span id="sf-boss-phase" style="color:#22d3ee; font-weight:900; text-transform:uppercase;">ENGAGED</span>
        <span id="sf-boss-hp-text">HP: 100%</span>
      </div>
    `;

    parent.appendChild(this.container);

    this.activeBar = this.container.querySelector('#sf-boss-bar-active');
    this.trailingBar = this.container.querySelector('#sf-boss-bar-trailing');
    this.timerEl = this.container.querySelector('#sf-boss-timer');
    this.hpTextEl = this.container.querySelector('#sf-boss-hp-text');
    this.damageEl = this.container.querySelector('#sf-boss-damage');
    this.nameEl = this.container.querySelector('#sf-boss-name');
    this.phaseEl = this.container.querySelector('#sf-boss-phase');
  }

  private setupListeners(): void {
    const bus = GameEventBus.getInstance();

    bus.on<BossStateEvent>('BOSS_STATE', (state) => {
      this.updateState(state);
    });

    bus.on('BOSS_INTRO', () => {
      this.show();
    });

    bus.on('BOSS_DEFEATED', () => {
      this.hide();
    });

    bus.on('BOSS_ESCAPED', () => {
      this.hide();
    });

    bus.on('ROUND_END', () => {
      this.hide();
    });
  }

  public show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  public hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public updateState(state: BossStateEvent): void {
    if (!this.isVisible && (state.phase === 'engaged' || state.phase === 'enraged')) {
      this.show();
    }

    const pct = Math.max(0, Math.min(100, state.hpPercent));

    if (this.activeBar) {
      this.activeBar.style.width = `${pct}%`;
      if (state.phase === 'enraged') {
        this.activeBar.classList.add('boss-enraged');
      } else {
        this.activeBar.classList.remove('boss-enraged');
      }
    }

    if (this.trailingBar) {
      this.trailingBar.style.width = `${pct}%`;
    }

    if (this.timerEl) {
      this.timerEl.textContent = `${state.timeRemainingSec}s`;
    }

    if (this.hpTextEl) {
      this.hpTextEl.textContent = `HP: ${Math.round(pct)}%`;
    }

    if (this.damageEl) {
      this.damageEl.textContent = `DMG: ${Math.round(state.totalDamage)}`;
    }

    if (this.nameEl && state.name) {
      this.nameEl.textContent = state.name;
    }

    if (this.phaseEl) {
      this.phaseEl.textContent = state.phase.toUpperCase();
      this.phaseEl.style.color = state.phase === 'enraged' ? '#ef4444' : '#22d3ee';
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
