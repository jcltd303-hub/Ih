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

  // Boss Victory/Defeat Result Modal
  private resultModal: HTMLDivElement | null = null;

  // Crosshair
  private crosshair: HTMLDivElement | null = null;

  // Round Banner
  private roundBanner: HTMLDivElement | null = null;

  // Damage Numbers Container
  private damageContainer: HTMLDivElement | null = null;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.renderComboWidget();
    this.renderTurretWidget();
    this.renderWarningOverlay();
    this.renderResultModal();
    this.renderCrosshair();
    this.renderRoundBanner();
    this.renderDamageContainer();
    this.setupListeners();
  }

  private renderCrosshair(): void {
    this.crosshair = document.createElement('div');
    this.crosshair.id = 'ff-arcade-crosshair';
    this.crosshair.style.cssText = `
      position: absolute;
      width: 44px;
      height: 44px;
      pointer-events: none;
      z-index: 1000;
      border: 1.5px solid rgba(56, 189, 248, 0.6);
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.1s, transform 0.05s ease-out;
    `;
    this.crosshair.innerHTML = `
      <div style="width:2px; height:2px; background:#fff; border-radius:50%;"></div>
      <div style="position:absolute; top:-6px; width:1px; height:6px; background:#38bdf8;"></div>
      <div style="position:absolute; bottom:-6px; width:1px; height:6px; background:#38bdf8;"></div>
      <div style="position:absolute; left:-6px; width:6px; height:1px; background:#38bdf8;"></div>
      <div style="position:absolute; right:-6px; width:6px; height:1px; background:#38bdf8;"></div>
    `;
    this.parent.appendChild(this.crosshair);
  }

  private renderRoundBanner(): void {
    this.roundBanner = document.createElement('div');
    this.roundBanner.id = 'ff-round-banner';
    this.roundBanner.style.cssText = `
      position: absolute;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      z-index: 100;
      pointer-events: none;
      display: none;
      font-family: var(--font-display, 'Impact', sans-serif);
      font-size: 72px;
      font-weight: 900;
      font-style: italic;
      color: #fbbf24;
      text-shadow: 0 4px 0 #78350f, 0 8px 12px rgba(0,0,0,0.5);
      text-transform: uppercase;
      letter-spacing: 4px;
      opacity: 0;
      transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    this.parent.appendChild(this.roundBanner);
  }

  private renderDamageContainer(): void {
    this.damageContainer = document.createElement('div');
    this.damageContainer.id = 'ff-damage-layer';
    this.damageContainer.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 30;
      overflow: hidden;
    `;
    this.parent.appendChild(this.damageContainer);
  }

  private renderComboWidget(): void {
    this.comboContainer = document.createElement('div');
    this.comboContainer.id = 'ff-combo-widget';
    this.comboContainer.style.cssText = `
      position: absolute;
      top: 140px;
      left: 16px;
      z-index: 25;
      pointer-events: none;
      display: none;
      flex-direction: column;
      min-width: 100px;
      font-family: var(--font-display, 'Impact', sans-serif);
      font-style: italic;
    `;

    this.comboContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:6px;">
        <span id="ff-combo-count" class="ff-combo-punch" style="font-size: 28px; font-weight: 900; color: #fbbf24; text-shadow: 0 2px 4px #000;">COMBO 01</span>
        <span id="ff-combo-bonus" style="font-size: 14px; color: #38bdf8; font-weight: 900; font-family:var(--font-mono, monospace); text-shadow: 0 1px 2px #000;">1.0x</span>
      </div>
      <div style="height: 3px; background: rgba(0,0,0,0.3); margin-top: 2px; overflow: hidden;">
        <div id="ff-combo-bar" style="height: 100%; width: 100%; background: #fbbf24; box-shadow: 0 0 8px #fbbf24;"></div>
      </div>
    `;

    this.parent.appendChild(this.comboContainer);
    this.comboCountEl = this.comboContainer.querySelector('#ff-combo-count');
    this.comboBarEl = this.comboContainer.querySelector('#ff-combo-bar');
    this.comboBonusEl = this.comboContainer.querySelector('#ff-combo-bonus');
  }

  private renderTurretWidget(): void {
    this.turretContainer = document.createElement('div');
    this.turretContainer.id = 'ff-turret-widget';
    this.turretContainer.style.cssText = `
      position: absolute;
      bottom: 110px;
      left: 20px;
      z-index: 25;
      pointer-events: none;
      display: none;
      flex-direction: column;
      min-width: 140px;
      font-family: var(--font-display, 'Impact', sans-serif);
      font-style: italic;
    `;

    this.turretContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:12px; color:#f8fafc; font-weight:900; letter-spacing:1px; text-shadow: 0 1px 2px #000;">TURRET</span>
        <span id="ff-turret-val" style="font-size:14px; color:#38bdf8; font-weight:900; letter-spacing:1px; text-shadow: 0 1px 2px #000;">x2</span>
      </div>
      <div style="height: 4px; background: rgba(0,0,0,0.3); overflow: hidden;">
        <div id="ff-turret-bar" style="height: 100%; width: 100%; background: #38bdf8; box-shadow: 0 0 10px #38bdf8;"></div>
      </div>
    `;

    this.parent.appendChild(this.turretContainer);
    this.turretBarEl = this.turretContainer.querySelector('#ff-turret-bar');
    this.turretValEl = this.turretContainer.querySelector('#ff-turret-val');
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
      background: radial-gradient(circle, rgba(185, 28, 28, 0.1) 0%, rgba(3, 7, 18, 0.6) 100%);
    `;

    this.warningOverlay.innerHTML = `
      <div style="
        position: absolute;
        top: 35%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        min-width: 280px;
        font-family: var(--font-display, 'Impact', sans-serif);
        font-style: italic;
      ">
        <div style="color:#ef4444; font-size:14px; letter-spacing:4px; font-weight:900; margin-bottom:4px; text-shadow: 0 0 10px #ef4444;">⚠ WARNING ⚠</div>
        <div id="ff-boss-warn-name" style="color:#ffffff; font-size:32px; font-weight:900; letter-spacing:2px; text-shadow: 0 0 20px #ef4444;">BOSS APPROACHING</div>
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

    bus.on('AIM_UPDATE', (e: { x: number, y: number }) => {
      if (this.crosshair) {
        this.crosshair.style.left = `${e.x}px`;
        this.crosshair.style.top = `${e.y}px`;
      }
    });

    bus.on<ComboEvent>('COMBO_UPDATE', (e) => {
      if (e.combo > 1) {
        if (this.comboContainer) this.comboContainer.style.display = 'flex';
        if (this.comboCountEl) {
          this.comboCountEl.textContent = `COMBO ${e.combo < 10 ? '0' + e.combo : e.combo}`;
          this.comboCountEl.classList.remove('ff-combo-punch');
          void this.comboCountEl.offsetWidth;
          this.comboCountEl.classList.add('ff-combo-punch');
        }
        if (this.comboBonusEl) this.comboBonusEl.textContent = `${e.damageMultiplier.toFixed(1)}x`;
        if (this.comboBarEl) this.comboBarEl.style.width = `${Math.round(e.timerRatio * 100)}%`;
      } else {
        if (this.comboContainer) this.comboContainer.style.display = 'none';
      }
    });

    bus.on('COMBO_BREAK', () => {
      if (this.comboContainer) this.comboContainer.style.display = 'none';
    });

    bus.on<any>('FISH_HIT', (e) => this.showDamageNumber(e.x, e.y, e.damage, e.isCrit));
    bus.on<any>('BOSS_HIT', (e) => this.showDamageNumber(e.x, e.y, e.damage, e.isCrit));

    bus.on('GAME_START', () => this.showBanner('READY?', 1500, () => this.showBanner('FIGHT!', 1000)));
    bus.on('BOSS_START', () => this.showBanner('BOSS BATTLE!', 2000));
    bus.on<any>('BOSS_PHASE_CHANGE', (e) => this.showBanner(e.phase || 'ENRAGED', 1500));
    bus.on('BOSS_DEFEATED', () => this.showBanner('K.O.', 3000));
    bus.on('BOSS_ESCAPED', () => this.showBanner('TIME UP', 2000));

    bus.on<TurretMultiplierEvent>('TURRET_TRIGGER', (e) => this.showTurretBonus(e));
    bus.on<TurretMultiplierEvent>('TURRET_UPDATE', (e) => this.updateTurretBonus(e));
    bus.on('TURRET_EXPIRE', () => {
      // Logic handled in updateTurretBonus (COOLDOWN state)
    });
    bus.on('TURRET_READY', () => {
      if (this.turretContainer) this.turretContainer.style.display = 'none';
    });

    bus.on<{ name: string; warningMs: number }>('BOSS_WARNING', (e) => this.showBossWarning(e.name, e.warningMs));

    bus.on<BossResultEvent>('BOSS_DEFEATED', (res) => {
      setTimeout(() => this.showVictory(res), 2500);
    });

    bus.on<BossResultEvent>('BOSS_ESCAPED', (res) => {
      setTimeout(() => this.showDefeat(res), 1500);
    });
  }

  private showBanner(text: string, duration: number, onComplete?: () => void): void {
    if (!this.roundBanner) return;
    this.roundBanner.textContent = text;
    this.roundBanner.style.display = 'block';
    this.roundBanner.style.opacity = '0';
    this.roundBanner.style.transform = 'translate(-50%, -50%) scale(0.5)';
    
    requestAnimationFrame(() => {
      if (this.roundBanner) {
        this.roundBanner.style.opacity = '1';
        this.roundBanner.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    });

    setTimeout(() => {
      if (this.roundBanner) {
        this.roundBanner.style.opacity = '0';
        this.roundBanner.style.transform = 'translate(-50%, -50%) scale(1.5)';
      }
      setTimeout(() => {
        if (this.roundBanner) this.roundBanner.style.display = 'none';
        if (onComplete) onComplete();
      }, 300);
    }, duration);
  }

  private showDamageNumber(x: number, y: number, damage: number, isCrit: boolean): void {
    if (!this.damageContainer) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      font-size: ${isCrit ? '24px' : '18px'};
      font-weight: 900;
      font-style: italic;
      color: ${isCrit ? '#fbbf24' : '#fff'};
      text-shadow: 0 2px 4px #000;
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
      z-index: 35;
      white-space: nowrap;
    `;
    el.textContent = Math.round(damage).toString();
    this.damageContainer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.top = `${y - 80}px`;
      el.style.opacity = '0';
      el.style.transform = `translate(-50%, -50%) scale(${isCrit ? 1.4 : 1.1})`;
    });

    setTimeout(() => el.remove(), 700);
  }

  private showTurretBonus(e: TurretMultiplierEvent): void {
    if (this.turretContainer) this.turretContainer.style.display = 'flex';
    if (this.turretValEl) {
      this.turretValEl.textContent = `TURRET x${e.multiplier}`;
      this.turretValEl.style.color = '#38bdf8';
    }
    if (this.turretBarEl) {
      this.turretBarEl.style.width = '100%';
      this.turretBarEl.style.background = '#38bdf8';
      this.turretBarEl.style.boxShadow = '0 0 10px #38bdf8';
    }
  }

  private updateTurretBonus(e: TurretMultiplierEvent): void {
    if (!this.turretContainer) return;
    this.turretContainer.style.display = 'flex';

    if (this.turretBarEl && e.totalDurationMs > 0) {
      const ratio = Math.max(0, Math.min(1, e.remainingMs / e.totalDurationMs));
      this.turretBarEl.style.width = `${Math.round(ratio * 100)}%`;
      
      if (e.state === 'COOLDOWN') {
        this.turretBarEl.style.background = '#64748b';
        this.turretBarEl.style.boxShadow = 'none';
        if (this.turretValEl) {
          this.turretValEl.textContent = 'COOLDOWN';
          this.turretValEl.style.color = '#64748b';
        }
      } else {
        this.turretBarEl.style.background = '#38bdf8';
        this.turretBarEl.style.boxShadow = '0 0 10px #38bdf8';
        if (this.turretValEl) {
          this.turretValEl.textContent = `TURRET x${e.multiplier}`;
          this.turretValEl.style.color = '#38bdf8';
        }
      }
    }
  }

  private hideTurretBonus(): void {
    // We now keep it visible if it's in cooldown, but let's hide it if we want to follow the old logic
    // Actually, the new plan says show COOLDOWN. So we don't hide on EXPIRE if COOLDOWN is starting.
  }

  private showBossWarning(name: string, durationMs: number): void {
    if (!this.warningOverlay) return;
    const nameEl = this.warningOverlay.querySelector('#ff-boss-warn-name');
    if (nameEl) nameEl.textContent = name || 'BOSS APPROACHING';
    this.warningOverlay.style.display = 'block';

    setTimeout(() => {
      if (this.warningOverlay) this.warningOverlay.style.display = 'none';
    }, durationMs);
  }

  public showVictory(res: BossResultEvent): void {
    if (!this.resultModal) return;
    this.resultModal.innerHTML = `
      <div style="background:#090d18; border:3px solid #fbbf24; padding:24px 20px; text-align:center; color:#f8fafc; width:min(380px, 95vw); box-sizing:border-box;">
        <div style="font-size:54px; font-weight:900; color:#fbbf24; text-shadow:0 4px 0 #78350f; margin-bottom:2px;">K.O.!</div>
        <div style="font-size:14px; font-weight:900; color:#38bdf8; margin-bottom:16px;">BOSS TARGET DEFEATED</div>
        <div style="background:#0f172a; padding:12px; margin-bottom:18px; font-family:var(--font-mono, monospace); font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:left;">
          <div>DMG: <b style="color:#fff;">${Math.round(res.totalDamage)}</b></div>
          <div>TIME: <b style="color:#fff;">${res.timeElapsedSec}s</b></div>
          <div>BOUNTY: <b style="color:#fbbf24;">x${res.multiplier}</b></div>
          <div>REWARD: <b style="color:#34d399;">+${res.bountyPayout.toFixed(2)} ${res.currency}</b></div>
        </div>
        ${ARCADE.arcadeButton('CONTINUE', { id: 'ff-res-continue', variant: 'primary', fullWidth: true })}
      </div>
    `;
    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-res-continue')?.addEventListener('click', () => this.hideResultModal());
  }

  public showDefeat(res: BossResultEvent): void {
    if (!this.resultModal) return;
    this.resultModal.innerHTML = `
      <div style="background:#090d18; border:3px solid #ef4444; padding:24px 20px; text-align:center; color:#f8fafc; width:min(380px, 95vw); box-sizing:border-box;">
        <div style="font-size:46px; font-weight:900; color:#f87171; text-shadow:0 4px 0 #450a0a; margin-bottom:2px;">TIME UP!</div>
        <div style="font-size:13px; font-weight:900; color:#94a3b8; margin-bottom:16px;">BOSS ESCAPED</div>
        <div style="background:#0f172a; padding:12px; margin-bottom:18px; font-family:var(--font-mono, monospace); font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:left;">
          <div>DMG: <b style="color:#fff;">${Math.round(res.totalDamage)}</b></div>
          <div>PARTIAL: <b style="color:#34d399;">+${res.bountyPayout.toFixed(2)} ${res.currency}</b></div>
        </div>
        ${ARCADE.arcadeButton('RETRY', { id: 'ff-res-retry', variant: 'slate', fullWidth: true })}
      </div>
    `;
    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-res-retry')?.addEventListener('click', () => this.hideResultModal());
  }

  public hideResultModal(): void {
    if (this.resultModal) {
      this.resultModal.style.display = 'none';
      this.resultModal.innerHTML = '';
    }
  }

  public destroy(): void {
    [this.comboContainer, this.turretContainer, this.warningOverlay, this.resultModal, this.crosshair, this.roundBanner, this.damageContainer].forEach(el => el?.remove());
  }
}
