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
      top: 72px;
      left: 50%;
      transform: translateX(-50%);
      width: min(440px, 92vw);
      z-index: 35;
      display: none;
      flex-direction: column;
      pointer-events: none;
      font-family: var(--font-display, 'Impact', sans-serif);
      letter-spacing: 1px;
      padding: 0 10px;
    `;

    this.container.innerHTML = `
      <!-- Boss Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="color:#ef4444; font-size:10px; font-weight:900; font-style:italic; text-shadow: 0 1px 2px #000;">TARGET</span>
          <span id="sf-boss-name" style="color:#f8fafc; font-size:14px; font-weight:900; font-style:italic; text-shadow:0 2px 4px #000; letter-spacing:1px;">APEX LEVIATHAN</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size:11px; font-family:var(--font-mono, monospace);">
          <span id="sf-boss-multiplier" style="color:#fbbf24; font-weight:900; text-shadow: 0 1px 2px #000;">x2.5</span>
          <span id="sf-boss-timer" style="color:#ef4444; font-weight:900; text-shadow: 0 1px 2px #000;">88s</span>
        </div>
      </div>

      <!-- Street Fighter Dual-Layer Bar (Floating) -->
      <div class="sf-bar-frame" style="height: 10px; position: relative; background: rgba(0,0,0,0.3); overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
        <div id="sf-boss-bar-trailing" class="sf-bar-trailing" style="position: absolute; top: 0; bottom: 0; left: 0; background: #fbbf24; opacity: 0.6; width: 100%;"></div>
        <div id="sf-boss-bar-active" class="sf-bar-active" style="position: absolute; top: 0; bottom: 0; left: 0; background: linear-gradient(180deg, #22d3ee, #0891b2); width: 100%; box-shadow: 0 0 8px #22d3ee;"></div>
      </div>

      <!-- Sub stats -->
      <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:#cbd5e1; font-family:var(--font-mono, monospace); font-weight: 700; text-shadow: 0 1px 2px #000;">
        <span id="sf-boss-damage">DMG: 0</span>
        <span id="sf-boss-phase" style="color:#22d3ee; text-transform:uppercase; letter-spacing:1px;">ENGAGED</span>
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
      // Add a slight delay before trailing bar matches active bar
      setTimeout(() => {
        if (this.trailingBar) {
          this.trailingBar.style.width = `${pct}%`;
        }
      }, 300);
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
