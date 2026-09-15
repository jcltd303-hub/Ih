import { GameEventBus, ComboEvent, TurretMultiplierEvent, BossResultEvent } from '../engine/core/GameEvents';
import { ARCADE } from './StyleConstants';

export class ArcadeCombatWidgets {
  private parent: HTMLElement;

  // Combo Widget
  private comboContainer: HTMLDivElement | null = null;
  private comboCountEl: HTMLElement | null = null;
  private comboBarEl: HTMLElement | null = null;
  private comboBonusEl: HTMLElement | null = null;

  // Turret Widget
  private turretContainer: HTMLDivElement | null = null;
  private turretBarEl: HTMLElement | null = null;
  private turretValEl: HTMLElement | null = null;

  // Boss Warning Banner
  private warningOverlay: HTMLDivElement | null = null;

  // Player Health
  private playerHealthContainer: HTMLDivElement | null = null;

  // Boss Victory/Defeat Result Modal
  private resultModal: HTMLDivElement | null = null;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.renderComboWidget();
    this.renderTurretWidget();
    this.renderPlayerHealthBar();
    this.renderWarningOverlay();
    this.renderResultModal();
    this.setupListeners();
  }

  private renderComboWidget(): void {
    this.comboContainer = document.createElement('div');
    this.comboContainer.id = 'ff-combo-widget';
    this.comboContainer.style.cssText = `
      position: absolute;
      top: 130px;
      left: 16px;
      z-index: 25;
      pointer-events: none;
      display: none;
      flex-direction: column;
      background: rgba(9, 13, 24, 0.9);
      border: 2px solid #fbbf24;
      border-radius: 2px;
      padding: 6px 12px;
      box-shadow: 2px 2px 0 #020617;
      min-width: 110px;
      font-family: var(--font-display, 'Impact', sans-serif);
      font-style: italic;
    `;

    this.comboContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:6px;">
        <span id="ff-combo-count" class="ff-combo-punch" style="font-size: 22px; font-weight: 900; color: #fbbf24; text-shadow: 0 2px 4px #000;">COMBO 01</span>
        <span id="ff-combo-bonus" style="font-size: 11px; color: #38bdf8; font-weight: 900; font-family:var(--font-mono, monospace);">1.0x</span>
      </div>
      <!-- Draining timer bar -->
      <div style="height: 4px; background: #020617; border: 1px solid #475569; margin-top: 3px; overflow: hidden;">
        <div id="ff-combo-bar" style="height: 100%; width: 100%; background: #fbbf24; transition: width 0.05s linear;"></div>
      </div>
    `;

    this.parent.appendChild(this.comboContainer);
    this.comboCountEl = this.comboContainer.querySelector('#ff-combo-count');
    this.comboBarEl = this.comboContainer.querySelector('#ff-combo-bar');
    this.comboBonusEl = this.comboContainer.querySelector('#ff-combo-bonus');
  }

  private renderPlayerHealthBar(): void {
    this.playerHealthContainer = document.createElement('div');
    this.playerHealthContainer.id = 'ff-player-health-widget';
    this.playerHealthContainer.style.cssText = `
      position: absolute;
      top: 12px;
      left: 16px;
      width: 300px;
      z-index: 25;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      font-family: var(--font-display, 'Impact', sans-serif);
      letter-spacing: 1px;
    `;

    this.playerHealthContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
        <span style="color:#f8fafc; font-size:14px; font-weight:900; font-style:italic; text-shadow:0 2px 4px #000;">P1 // PILOT</span>
        <span id="ff-player-hp-text" style="color:#fbbf24; font-size:12px; font-weight:900; font-family:var(--font-mono, monospace);">CREDITS 100%</span>
      </div>
      <div class="sf-bar-frame" style="height: 18px; border: 2px solid #38bdf8; background: #020617; box-shadow: 2px 2px 0 #020617;">
        <div id="ff-player-hp-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); transition: width 0.3s ease-out;"></div>
      </div>
    `;

    this.parent.appendChild(this.playerHealthContainer);
  }

  private renderWarningOverlay(): void {
    this.warningOverlay = document.createElement('div');
    this.warningOverlay.id = 'ff-boss-warning-overlay';
    this.warningOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 40;
      pointer-events: none;
      display: none;
      background: radial-gradient(circle, rgba(185, 28, 28, 0.25) 0%, rgba(3, 7, 18, 0.75) 100%);
    `;

    this.warningOverlay.innerHTML = `
      <div class="ff-boss-warning-box" style="
        position: absolute;
        top: 35%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #090d16;
        border: 3px solid #ef4444;
        box-shadow: 0 0 25px rgba(239, 68, 68, 0.6), inset 0 0 15px rgba(239, 68, 68, 0.3);
        padding: 18px 28px;
        text-align: center;
        min-width: 280px;
        font-family: var(--font-display, 'Impact', sans-serif);
        font-style: italic;
      ">
        <div style="color:#f87171; font-size:12px; letter-spacing:3px; font-weight:900; margin-bottom:4px;">⚠ EMERGENCY COMBAT ALERT ⚠</div>
        <div style="color:#ffffff; font-size:28px; font-weight:900; letter-spacing:2px; text-shadow: 0 0 12px #ef4444;">WARNING: BOSS APPROACHING</div>
        <div id="ff-boss-warn-name" style="color:#fbbf24; font-size:16px; font-weight:900; letter-spacing:2px; margin-top:4px;">APEX LEVIATHAN</div>
      </div>
    `;

    this.parent.appendChild(this.warningOverlay);
  }

  private renderResultModal(): void {
    this.resultModal = document.createElement('div');
    this.resultModal.id = 'ff-boss-result-modal';
    this.resultModal.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 55;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(3, 7, 18, 0.85);
      backdrop-filter: blur(6px);
      padding: 20px;
      font-family: var(--font-display, 'Impact', sans-serif);
      pointer-events: auto;
    `;

    this.parent.appendChild(this.resultModal);
  }

  private setupListeners(): void {
    const bus = GameEventBus.getInstance();

    // Combo listeners
    bus.on<ComboEvent>('COMBO_UPDATE', (e) => {
      if (e.combo > 1) {
        if (this.comboContainer) this.comboContainer.style.display = 'flex';
        if (this.comboCountEl) {
          this.comboCountEl.textContent = `COMBO ${e.combo < 10 ? '0' + e.combo : e.combo}`;
          this.comboCountEl.classList.remove('ff-combo-punch');
          void this.comboCountEl.offsetWidth; // trigger reflow
          this.comboCountEl.classList.add('ff-combo-punch');
        }
        if (this.comboBonusEl) {
          this.comboBonusEl.textContent = `${e.damageMultiplier.toFixed(1)}x`;
        }
        if (this.comboBarEl) {
          this.comboBarEl.style.width = `${Math.round(e.timerRatio * 100)}%`;
        }
      } else {
        if (this.comboContainer) this.comboContainer.style.display = 'none';
      }
    });

    bus.on('COMBO_BREAK', () => {
      if (this.comboContainer) this.comboContainer.style.display = 'none';
    });

    // Turret Multiplier listeners
    bus.on<TurretMultiplierEvent>('TURRET_TRIGGER', (e) => {
      this.showTurretBonus(e);
    });

    bus.on<TurretMultiplierEvent>('TURRET_UPDATE', (e) => {
      this.updateTurretBonus(e);
    });

    bus.on('TURRET_EXPIRE', () => {
      this.hideTurretBonus();
    });

    // Boss Warning
    bus.on<{ name: string; warningMs: number }>('BOSS_WARNING', (e) => {
      this.showBossWarning(e.name, e.warningMs);
    });

    // Boss Results
    bus.on<BossResultEvent>('BOSS_DEFEATED', (res) => {
      this.showVictory(res);
    });

    bus.on<BossResultEvent>('BOSS_ESCAPED', (res) => {
      this.showDefeat(res);
    });
  }

  private showTurretBonus(e: TurretMultiplierEvent): void {
    if (this.turretContainer) {
      this.turretContainer.style.display = 'flex';
    }
    if (this.turretValEl) {
      this.turretValEl.textContent = `TURRET x${e.multiplier}`;
    }
    if (this.turretBarEl) {
      this.turretBarEl.style.width = '100%';
    }
  }

  private updateTurretBonus(e: TurretMultiplierEvent): void {
    if (this.turretBarEl && e.totalDurationMs > 0) {
      const ratio = Math.max(0, Math.min(1, e.remainingMs / e.totalDurationMs));
      this.turretBarEl.style.width = `${Math.round(ratio * 100)}%`;
    }
  }

  private hideTurretBonus(): void {
    if (this.turretContainer) {
      this.turretContainer.style.display = 'none';
    }
  }

  private showBossWarning(name: string, durationMs: number): void {
    if (!this.warningOverlay) return;
    const nameEl = this.warningOverlay.querySelector('#ff-boss-warn-name');
    if (nameEl) nameEl.textContent = name || 'APEX LEVIATHAN';
    this.warningOverlay.style.display = 'block';

    setTimeout(() => {
      if (this.warningOverlay) {
        this.warningOverlay.style.display = 'none';
      }
    }, durationMs);
  }

  public showVictory(res: BossResultEvent): void {
    if (!this.resultModal) return;

    this.resultModal.innerHTML = `
      <div style="
        background: #090d18;
        border: 3px solid #fbbf24;
        box-shadow: 0 0 35px rgba(250, 204, 21, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.8);
        border-radius: 2px;
        width: min(380px, 95vw);
        padding: 24px 20px;
        text-align: center;
        color: #f8fafc;
        box-sizing: border-box;
      ">
        <div style="font-size: clamp(38px, 10vw, 54px); font-weight: 900; font-style: italic; color: #fbbf24; text-shadow: 0 4px 0 #78350f, 0 0 15px #facc15; margin-bottom: 2px;">
          K.O.!
        </div>
        <div style="font-size: 14px; font-weight: 900; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase; margin-bottom: 16px;">
          BOSS TARGET DEFEATED
        </div>

        <div style="background: #0f172a; border: 1px solid #334155; padding: 12px; margin-bottom: 18px; font-family: var(--font-mono, monospace); font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left;">
          <div><span style="color:#94a3b8;">DAMAGE:</span> <b style="color:#fff;">${Math.round(res.totalDamage)}</b></div>
          <div><span style="color:#94a3b8;">TIME:</span> <b style="color:#fff;">${res.timeElapsedSec}s</b></div>
          <div><span style="color:#94a3b8;">BOUNTY:</span> <b style="color:#fbbf24;">x${res.multiplier}</b></div>
          <div><span style="color:#94a3b8;">REWARD:</span> <b style="color:#34d399;">+${res.bountyPayout.toFixed(2)} ${res.currency}</b></div>
        </div>

        ${ARCADE.arcadeButton('CONTINUE COMBAT', { id: 'ff-res-continue', variant: 'primary', fullWidth: true, size: 'lg' })}
      </div>
    `;

    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-res-continue')?.addEventListener('click', () => {
      this.hideResultModal();
    });
  }

  public showDefeat(res: BossResultEvent): void {
    if (!this.resultModal) return;

    this.resultModal.innerHTML = `
      <div style="
        background: #090d18;
        border: 3px solid #ef4444;
        box-shadow: 0 0 35px rgba(239, 68, 68, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.8);
        border-radius: 2px;
        width: min(380px, 95vw);
        padding: 24px 20px;
        text-align: center;
        color: #f8fafc;
        box-sizing: border-box;
      ">
        <div style="font-size: clamp(34px, 8vw, 46px); font-weight: 900; font-style: italic; color: #f87171; text-shadow: 0 4px 0 #450a0a; margin-bottom: 2px;">
          TIME UP!
        </div>
        <div style="font-size: 13px; font-weight: 900; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 16px;">
          BOSS ESCAPED TO DEEP TRENCH
        </div>

        <div style="background: #0f172a; border: 1px solid #334155; padding: 12px; margin-bottom: 18px; font-family: var(--font-mono, monospace); font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left;">
          <div><span style="color:#94a3b8;">DAMAGE:</span> <b style="color:#fff;">${Math.round(res.totalDamage)}</b></div>
          <div><span style="color:#94a3b8;">PARTIAL:</span> <b style="color:#34d399;">+${res.bountyPayout.toFixed(2)} ${res.currency}</b></div>
        </div>

        ${ARCADE.arcadeButton('RETRY COMBAT', { id: 'ff-res-retry', variant: 'slate', fullWidth: true, size: 'lg' })}
      </div>
    `;

    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-res-retry')?.addEventListener('click', () => {
      this.hideResultModal();
    });
  }

  public hideResultModal(): void {
    if (this.resultModal) {
      this.resultModal.style.display = 'none';
      this.resultModal.innerHTML = '';
    }
  }

  public destroy(): void {
    if (this.comboContainer) this.comboContainer.remove();
    if (this.turretContainer) this.turretContainer.remove();
    if (this.warningOverlay) this.warningOverlay.remove();
    if (this.resultModal) this.resultModal.remove();
  }
}
