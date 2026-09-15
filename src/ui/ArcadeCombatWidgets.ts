import { GameEventBus, ComboEvent, TurretMultiplierEvent, BossResultEvent } from '../engine/core/GameEvents';
import { ARCADE } from './StyleConstants';

export class ArcadeCombatWidgets {
  private parent: HTMLElement;
  private comboContainer: HTMLDivElement | null = null;
  private comboCountEl: HTMLElement | null = null;
  private comboBarEl: HTMLElement | null = null;
  private comboBonusEl: HTMLElement | null = null;
  private turretContainer: HTMLDivElement | null = null;
  private turretBarEl: HTMLElement | null = null;
  private turretValEl: HTMLElement | null = null;
  private warningOverlay: HTMLDivElement | null = null;
  private resultModal: HTMLDivElement | null = null;
  private crosshair: HTMLDivElement | null = null;
  private roundBanner: HTMLDivElement | null = null;
  private damageContainer: HTMLDivElement | null = null;
  private unsubs: Array<() => void> = [];

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
    this.crosshair.style.cssText = `position:absolute;width:42px;height:42px;pointer-events:none;z-index:1000;border:1px solid rgba(103,232,249,.75);transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;transition:border-color .08s,transform .05s ease-out;filter:drop-shadow(0 0 4px rgba(34,211,238,.35));`;
    this.crosshair.innerHTML = `<div style="width:3px;height:3px;background:#fff"></div><div style="position:absolute;top:-7px;width:2px;height:7px;background:#22d3ee"></div><div style="position:absolute;bottom:-7px;width:2px;height:7px;background:#22d3ee"></div><div style="position:absolute;left:-7px;width:7px;height:2px;background:#22d3ee"></div><div style="position:absolute;right:-7px;width:7px;height:2px;background:#22d3ee"></div>`;
    this.parent.appendChild(this.crosshair);
  }

  private renderRoundBanner(): void {
    this.roundBanner = document.createElement('div');
    this.roundBanner.id = 'ff-round-banner';
    this.roundBanner.style.cssText = `position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) scale(.65) skewX(-8deg);z-index:100;pointer-events:none;display:none;font-family:${ARCADE.fontDisplay};font-size:clamp(46px,10vw,82px);font-weight:900;font-style:italic;color:#facc15;text-shadow:3px 3px 0 #7c2d12,6px 6px 0 #020617,0 0 22px rgba(250,204,21,.45);text-transform:uppercase;letter-spacing:3px;opacity:0;transition:opacity .14s,transform .2s cubic-bezier(.17,.89,.32,1.25);`;
    this.parent.appendChild(this.roundBanner);
  }

  private renderDamageContainer(): void {
    this.damageContainer = document.createElement('div');
    this.damageContainer.id = 'ff-damage-layer';
    this.damageContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:30;overflow:hidden;';
    this.parent.appendChild(this.damageContainer);
  }

  private renderComboWidget(): void {
    this.comboContainer = document.createElement('div');
    this.comboContainer.id = 'ff-combo-widget';
    this.comboContainer.style.cssText = `position:absolute;top:clamp(126px,16vh,154px);left:14px;z-index:25;pointer-events:none;display:none;flex-direction:column;min-width:156px;font-family:${ARCADE.fontDisplay};font-style:italic;filter:drop-shadow(2px 3px 0 #020617);`;
    this.comboContainer.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;border-left:4px solid #facc15;padding:2px 0 2px 8px;"><span id="ff-combo-count" class="ff-combo-punch" style="font-size:30px;line-height:1;font-weight:900;color:#facc15;text-shadow:2px 2px 0 #713f12;">COMBO 01</span><span id="ff-combo-bonus" style="font-size:13px;line-height:1;color:#67e8f9;font-weight:900;font-family:${ARCADE.fontMono};">1.0x</span></div><div style="height:6px;background:#020617;border:1px solid #64748b;margin-top:5px;transform:skewX(-10deg);"><div id="ff-combo-bar" style="height:100%;width:100%;background:#facc15;box-shadow:0 0 8px rgba(250,204,21,.7);transition:width .08s linear;"></div></div><div style="font:900 9px ${ARCADE.fontMono};letter-spacing:2px;color:#94a3b8;margin-top:3px;padding-left:9px;">CHAIN ATTACK</div>`;
    this.parent.appendChild(this.comboContainer);
    this.comboCountEl = this.comboContainer.querySelector('#ff-combo-count');
    this.comboBarEl = this.comboContainer.querySelector('#ff-combo-bar');
    this.comboBonusEl = this.comboContainer.querySelector('#ff-combo-bonus');
  }

  private renderTurretWidget(): void {
    this.turretContainer = document.createElement('div');
    this.turretContainer.id = 'ff-turret-widget';
    this.turretContainer.style.cssText = `position:absolute;bottom:clamp(92px,12vh,116px);left:18px;z-index:25;pointer-events:none;display:none;flex-direction:column;min-width:158px;font-family:${ARCADE.fontDisplay};font-style:italic;filter:drop-shadow(2px 3px 0 #020617);`;
    this.turretContainer.innerHTML = `<div style="display:flex;align-items:center;gap:7px;border-left:4px solid #22d3ee;padding-left:8px;"><span style="font-size:12px;color:#f8fafc;font-weight:900;letter-spacing:2px;">TURRET</span><span id="ff-turret-val" style="font-size:15px;color:#67e8f9;font-weight:900;letter-spacing:1px;">x2</span></div><div style="height:6px;background:#020617;border:1px solid #475569;margin-top:5px;transform:skewX(-10deg);"><div id="ff-turret-bar" style="height:100%;width:100%;background:#22d3ee;box-shadow:0 0 10px rgba(34,211,238,.7);transition:width .08s linear;"></div></div>`;
    this.parent.appendChild(this.turretContainer);
    this.turretBarEl = this.turretContainer.querySelector('#ff-turret-bar');
    this.turretValEl = this.turretContainer.querySelector('#ff-turret-val');
  }

  private renderWarningOverlay(): void {
    this.warningOverlay = document.createElement('div');
    this.warningOverlay.id = 'ff-boss-warning-overlay';
    this.warningOverlay.style.cssText = 'position:absolute;inset:0;z-index:40;pointer-events:none;display:none;background:repeating-linear-gradient(135deg,rgba(127,29,29,.12) 0,rgba(127,29,29,.12) 8px,transparent 8px,transparent 16px),radial-gradient(circle,rgba(185,28,28,.08),rgba(3,7,18,.72));';
    this.warningOverlay.innerHTML = `<div style="position:absolute;top:31%;left:50%;transform:translate(-50%,-50%) skewX(-8deg);text-align:center;min-width:280px;font-family:${ARCADE.fontDisplay};font-style:italic;"><div style="color:#ef4444;font:900 13px ${ARCADE.fontMono};letter-spacing:5px;text-shadow:0 0 10px #ef4444;">// INCOMING //</div><div id="ff-boss-warn-name" style="color:#fff;font-size:clamp(30px,7vw,46px);font-weight:900;letter-spacing:2px;text-shadow:3px 3px 0 #450a0a,0 0 20px #ef4444;">BOSS APPROACHING</div></div>`;
    this.parent.appendChild(this.warningOverlay);
  }

  private renderResultModal(): void {
    this.resultModal = document.createElement('div');
    this.resultModal.id = 'ff-boss-result-modal';
    this.resultModal.style.cssText = 'position:absolute;inset:0;z-index:55;display:none;align-items:center;justify-content:center;background:rgba(3,7,18,.88);padding:20px;font-family:Impact,Arial Black,sans-serif;pointer-events:auto;';
    this.parent.appendChild(this.resultModal);
  }

  private setupListeners(): void {
    const bus = GameEventBus.getInstance();
    this.unsubs.push(bus.on('AIM_UPDATE', (e: { x: number; y: number }) => { if (this.crosshair) { this.crosshair.style.left = `${e.x}px`; this.crosshair.style.top = `${e.y}px`; } }));
    this.unsubs.push(bus.on<ComboEvent>('COMBO_UPDATE', (e) => {
      if (e.combo > 1) {
        if (this.comboContainer) this.comboContainer.style.display = 'flex';
        if (this.comboCountEl) { this.comboCountEl.textContent = `COMBO ${e.combo < 10 ? '0' + e.combo : e.combo}`; this.comboCountEl.classList.remove('ff-combo-punch'); void this.comboCountEl.offsetWidth; this.comboCountEl.classList.add('ff-combo-punch'); }
        if (this.comboBonusEl) this.comboBonusEl.textContent = `${e.damageMultiplier.toFixed(1)}x`;
        if (this.comboBarEl) this.comboBarEl.style.width = `${Math.round(e.timerRatio * 100)}%`;
      } else if (this.comboContainer) this.comboContainer.style.display = 'none';
    }));
    this.unsubs.push(bus.on('COMBO_BREAK', () => { if (this.comboContainer) this.comboContainer.style.display = 'none'; }));
    this.unsubs.push(bus.on<any>('FISH_HIT', (e) => this.showDamageNumber(e.x, e.y, e.damage, e.isCrit)));
    this.unsubs.push(bus.on<any>('BOSS_HIT', (e) => this.showDamageNumber(e.x, e.y, e.damage, e.isCrit)));
    this.unsubs.push(bus.on('GAME_START', () => this.showBanner('READY?', 1500, () => this.showBanner('FIGHT!', 1000))));
    this.unsubs.push(bus.on('BOSS_START', () => this.showBanner('BOSS BATTLE!', 2000)));
    this.unsubs.push(bus.on<any>('BOSS_PHASE_CHANGE', (e) => this.showBanner(e.phase || 'ENRAGED', 1500)));
    this.unsubs.push(bus.on('BOSS_DEFEATED', () => this.showBanner('K.O.', 3000)));
    this.unsubs.push(bus.on('BOSS_ESCAPED', () => this.showBanner('TIME UP', 2000)));
    this.unsubs.push(bus.on<TurretMultiplierEvent>('TURRET_TRIGGER', (e) => this.showTurretBonus(e)));
    this.unsubs.push(bus.on<TurretMultiplierEvent>('TURRET_UPDATE', (e) => this.updateTurretBonus(e)));
    this.unsubs.push(bus.on('TURRET_READY', () => { if (this.turretContainer) this.turretContainer.style.display = 'none'; }));
    this.unsubs.push(bus.on<{ name: string; warningMs: number }>('BOSS_WARNING', (e) => this.showBossWarning(e.name, e.warningMs)));
    this.unsubs.push(bus.on<BossResultEvent>('BOSS_DEFEATED', (res) => { window.setTimeout(() => this.showVictory(res), 2500); }));
    this.unsubs.push(bus.on<BossResultEvent>('BOSS_ESCAPED', (res) => { window.setTimeout(() => this.showDefeat(res), 1500); }));
  }

  private showBanner(text: string, duration: number, onComplete?: () => void): void {
    if (!this.roundBanner) return;
    this.roundBanner.textContent = text;
    this.roundBanner.style.display = 'block';
    this.roundBanner.style.opacity = '0';
    this.roundBanner.style.transform = 'translate(-50%,-50%) scale(.55) skewX(-8deg)';
    requestAnimationFrame(() => { if (this.roundBanner) { this.roundBanner.style.opacity = '1'; this.roundBanner.style.transform = 'translate(-50%,-50%) scale(1) skewX(-8deg)'; } });
    window.setTimeout(() => {
      if (this.roundBanner) { this.roundBanner.style.opacity = '0'; this.roundBanner.style.transform = 'translate(-50%,-50%) scale(1.35) skewX(-8deg)'; }
      window.setTimeout(() => { if (this.roundBanner) this.roundBanner.style.display = 'none'; onComplete?.(); }, 220);
    }, duration);
  }

  private showDamageNumber(x: number, y: number, damage: number, isCrit: boolean): void {
    if (!this.damageContainer || !Number.isFinite(damage)) return;
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-family:${ARCADE.fontDisplay};font-size:${isCrit ? '28px' : '19px'};font-weight:900;font-style:italic;color:${isCrit ? '#facc15' : '#fff'};text-shadow:2px 2px 0 #020617,0 0 8px ${isCrit ? 'rgba(250,204,21,.7)' : 'rgba(255,255,255,.35)'};pointer-events:none;transform:translate(-50%,-50%) rotate(-5deg) scale(.75);transition:all .52s cubic-bezier(.23,1,.32,1);z-index:35;white-space:nowrap;`;
    el.textContent = Math.round(damage).toString();
    if (isCrit) el.textContent += '!';
    this.damageContainer.appendChild(el);
    requestAnimationFrame(() => { el.style.top = `${y - 72}px`; el.style.opacity = '0'; el.style.transform = `translate(-50%,-50%) rotate(${isCrit ? '-8deg' : '0deg'}) scale(${isCrit ? 1.45 : 1.1})`; });
    window.setTimeout(() => el.remove(), 650);
  }

  private showTurretBonus(e: TurretMultiplierEvent): void {
    if (this.turretContainer) this.turretContainer.style.display = 'flex';
    if (this.turretValEl) { this.turretValEl.textContent = `x${e.multiplier}`; this.turretValEl.style.color = '#67e8f9'; }
    if (this.turretBarEl) { this.turretBarEl.style.width = '100%'; this.turretBarEl.style.background = '#22d3ee'; this.turretBarEl.style.boxShadow = '0 0 10px rgba(34,211,238,.7)'; }
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
        if (this.turretValEl) { this.turretValEl.textContent = 'RECHARGE'; this.turretValEl.style.color = '#94a3b8'; }
      } else {
        this.turretBarEl.style.background = '#22d3ee';
        this.turretBarEl.style.boxShadow = '0 0 10px rgba(34,211,238,.7)';
        if (this.turretValEl) { this.turretValEl.textContent = `x${e.multiplier}`; this.turretValEl.style.color = '#67e8f9'; }
      }
    }
  }

  private showBossWarning(name: string, durationMs: number): void {
    if (!this.warningOverlay) return;
    const nameEl = this.warningOverlay.querySelector('#ff-boss-warn-name');
    if (nameEl) nameEl.textContent = name || 'BOSS APPROACHING';
    this.warningOverlay.style.display = 'block';
    window.setTimeout(() => { if (this.warningOverlay) this.warningOverlay.style.display = 'none'; }, Math.max(0, durationMs));
  }

  public showVictory(res: BossResultEvent): void {
    if (!this.resultModal) return;
    this.resultModal.innerHTML = `<div style="background:#090d18;border:3px solid #facc15;border-left-width:10px;padding:22px 20px;text-align:center;color:#f8fafc;width:min(390px,95vw);box-sizing:border-box;box-shadow:8px 8px 0 #020617;transform:skewX(-2deg);"><div style="font-size:56px;font-weight:900;color:#facc15;text-shadow:3px 3px 0 #713f12;">K.O.!</div><div style="font:900 12px ${ARCADE.fontMono};letter-spacing:3px;color:#67e8f9;margin-bottom:16px;">TARGET DOWN</div><div style="background:#05070f;border:1px solid #334155;padding:12px;margin-bottom:18px;font:12px ${ARCADE.fontMono};display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;"><div>DMG <b>${Math.round(res.totalDamage)}</b></div><div>TIME <b>${res.timeElapsedSec}s</b></div><div>BOUNTY <b style="color:#facc15">x${res.multiplier}</b></div><div>REWARD <b style="color:#34d399">+${res.bountyPayout.toFixed(2)} ${res.currency}</b></div></div>${ARCADE.arcadeButton('CONTINUE',{id:'ff-res-continue',variant:'primary',fullWidth:true})}</div>`;
    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-res-continue')?.addEventListener('click', () => this.hideResultModal());
  }

  public showDefeat(res: BossResultEvent): void {
    if (!this.resultModal) return;
    this.resultModal.innerHTML = `<div style="background:#090d18;border:3px solid #ef4444;border-left-width:10px;padding:22px 20px;text-align:center;color:#f8fafc;width:min(390px,95vw);box-sizing:border-box;box-shadow:8px 8px 0 #020617;transform:skewX(-2deg);"><div style="font-size:48px;font-weight:900;color:#f87171;text-shadow:3px 3px 0 #450a0a;">TIME UP!</div><div style="font:900 12px ${ARCADE.fontMono};letter-spacing:3px;color:#94a3b8;margin-bottom:16px;">TARGET ESCAPED</div><div style="background:#05070f;border:1px solid #334155;padding:12px;margin-bottom:18px;font:12px ${ARCADE.fontMono};display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;"><div>DMG <b>${Math.round(res.totalDamage)}</b></div><div>PARTIAL <b style="color:#34d399">+${res.bountyPayout.toFixed(2)} ${res.currency}</b></div></div>${ARCADE.arcadeButton('RETRY',{id:'ff-res-retry',variant:'slate',fullWidth:true})}</div>`;
    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-res-retry')?.addEventListener('click', () => this.hideResultModal());
  }

  public hideResultModal(): void {
    if (this.resultModal) { this.resultModal.style.display = 'none'; this.resultModal.innerHTML = ''; }
  }

  public destroy(): void {
    this.unsubs.forEach((off) => off());
    this.unsubs = [];
    [this.comboContainer, this.turretContainer, this.warningOverlay, this.resultModal, this.crosshair, this.roundBanner, this.damageContainer].forEach((el) => el?.remove());
    this.comboContainer = this.turretContainer = this.warningOverlay = this.resultModal = this.crosshair = this.roundBanner = this.damageContainer = null;
  }
}
