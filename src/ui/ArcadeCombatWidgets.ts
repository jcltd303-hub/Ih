import {
  GameEventBus,
  ComboEvent,
  TurretMultiplierEvent,
  BossResultEvent,
  FishHitEvent,
  BossStateEvent,
} from '../engine/core/GameEvents';
import { ARCADE } from './StyleConstants';

/**
 * Fast, low-chrome combat feedback layer.
 * The regular HUD should read like an arcade fighter, not a dashboard:
 * hard edges, short-lived impact feedback, and information that disappears
 * when it stops being useful.
 */
export class ArcadeCombatWidgets {
  private parent: HTMLElement;
  private comboContainer: HTMLDivElement | null = null;
  private comboCountEl: HTMLElement | null = null;
  private comboBarEl: HTMLElement | null = null;
  private comboBonusEl: HTMLElement | null = null;
  private turretContainer: HTMLDivElement | null = null;
  private turretBarEl: HTMLElement | null = null;
  private turretValEl: HTMLElement | null = null;
  private turretLabelEl: HTMLElement | null = null;
  private warningOverlay: HTMLDivElement | null = null;
  private resultModal: HTMLDivElement | null = null;
  private crosshair: HTMLDivElement | null = null;
  private roundBanner: HTMLDivElement | null = null;
  private damageContainer: HTMLDivElement | null = null;
  private bossMiniHud: HTMLDivElement | null = null;
  private unsubs: Array<() => void> = [];
  private timers = new Set<number>();
  private theme: 'light' | 'dark' = 'light';

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.renderCrosshair();
    this.renderRoundBanner();
    this.renderDamageContainer();
    this.renderComboWidget();
    this.renderTurretWidget();
    this.renderWarningOverlay();
    this.renderBossMiniHud();
    this.renderResultModal();
    this.setupListeners();
  }

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private renderCrosshair(): void {
    this.crosshair = document.createElement('div');
    this.crosshair.id = 'ff-arcade-crosshair';
    this.crosshair.style.cssText = `position:absolute;width:42px;height:42px;pointer-events:none;z-index:1000;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;opacity:.9;transition:transform .05s ease-out,opacity .08s;filter:drop-shadow(0 0 4px rgba(34,211,238,.4));`;
    this.crosshair.innerHTML = `
      <span style="position:absolute;inset:0;border:1px solid rgba(103,232,249,.72);transform:rotate(45deg);"></span>
      <span style="width:4px;height:4px;background:#fff;box-shadow:0 0 6px #22d3ee;"></span>
      <i style="position:absolute;top:-5px;width:2px;height:7px;background:#22d3ee;"></i>
      <i style="position:absolute;bottom:-5px;width:2px;height:7px;background:#22d3ee;"></i>
      <i style="position:absolute;left:-5px;width:7px;height:2px;background:#22d3ee;"></i>
      <i style="position:absolute;right:-5px;width:7px;height:2px;background:#22d3ee;"></i>`;
    this.parent.appendChild(this.crosshair);
  }

  private renderRoundBanner(): void {
    this.roundBanner = document.createElement('div');
    this.roundBanner.id = 'ff-round-banner';
    this.roundBanner.style.cssText = `position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) scale(.55) skewX(-8deg);z-index:100;pointer-events:none;display:none;font-family:${ARCADE.fontDisplay};font-size:clamp(46px,10vw,82px);font-weight:900;font-style:italic;color:#facc15;text-shadow:3px 3px 0 #7c2d12,6px 6px 0 #020617,0 0 22px rgba(250,204,21,.45);text-transform:uppercase;letter-spacing:3px;opacity:0;transition:opacity .12s,transform .18s cubic-bezier(.17,.89,.32,1.25);`;
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
    this.comboContainer.style.cssText = `position:absolute;top:clamp(126px,16vh,154px);left:14px;z-index:25;pointer-events:none;display:none;flex-direction:column;min-width:170px;font-family:${ARCADE.fontDisplay};font-style:italic;filter:drop-shadow(2px 3px 0 #020617);`;
    this.comboContainer.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:8px;border-left:4px solid #facc15;padding:2px 0 2px 8px;">
        <span id="ff-combo-count" style="font-size:30px;line-height:1;font-weight:900;color:#facc15;text-shadow:2px 2px 0 #713f12;">COMBO 02</span>
        <span id="ff-combo-bonus" style="font-size:13px;line-height:1;color:#67e8f9;font-weight:900;font-family:${ARCADE.fontMono};">1.0x</span>
      </div>
      <div style="height:6px;background:#020617;border:1px solid #64748b;margin-top:5px;transform:skewX(-10deg);">
        <div id="ff-combo-bar" style="height:100%;width:100%;background:#facc15;box-shadow:0 0 8px rgba(250,204,21,.7);transition:width .08s linear;"></div>
      </div>
      <div style="font:900 9px ${ARCADE.fontMono};letter-spacing:2px;color:#94a3b8;margin-top:3px;padding-left:9px;">CHAIN ATTACK</div>`;
    this.parent.appendChild(this.comboContainer);
    this.comboCountEl = this.comboContainer.querySelector('#ff-combo-count');
    this.comboBarEl = this.comboContainer.querySelector('#ff-combo-bar');
    this.comboBonusEl = this.comboContainer.querySelector('#ff-combo-bonus');
  }

  private renderTurretWidget(): void {
    this.turretContainer = document.createElement('div');
    this.turretContainer.id = 'ff-turret-widget';
    this.turretContainer.style.cssText = `position:absolute;bottom:clamp(92px,12vh,116px);left:18px;z-index:25;pointer-events:none;display:none;flex-direction:column;min-width:168px;font-family:${ARCADE.fontDisplay};font-style:italic;filter:drop-shadow(2px 3px 0 #020617);`;
    this.turretContainer.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px;border-left:4px solid #22d3ee;padding-left:8px;">
        <span id="ff-turret-label" style="font-size:12px;color:#f8fafc;font-weight:900;letter-spacing:2px;">TURRET BONUS</span>
        <span id="ff-turret-val" style="font-size:15px;color:#67e8f9;font-weight:900;letter-spacing:1px;">x2</span>
      </div>
      <div style="height:6px;background:#020617;border:1px solid #475569;margin-top:5px;transform:skewX(-10deg);">
        <div id="ff-turret-bar" style="height:100%;width:100%;background:#22d3ee;box-shadow:0 0 10px rgba(34,211,238,.7);transition:width .08s linear;"></div>
      </div>`;
    this.parent.appendChild(this.turretContainer);
    this.turretBarEl = this.turretContainer.querySelector('#ff-turret-bar');
    this.turretValEl = this.turretContainer.querySelector('#ff-turret-val');
    this.turretLabelEl = this.turretContainer.querySelector('#ff-turret-label');
  }

  private renderWarningOverlay(): void {
    this.warningOverlay = document.createElement('div');
    this.warningOverlay.id = 'ff-boss-warning-overlay';
    this.warningOverlay.style.cssText = 'position:absolute;inset:0;z-index:40;pointer-events:none;display:none;background:repeating-linear-gradient(135deg,rgba(127,29,29,.12) 0,rgba(127,29,29,.12) 8px,transparent 8px,transparent 16px),radial-gradient(circle,rgba(185,28,28,.08),rgba(3,7,18,.72));';
    this.warningOverlay.innerHTML = `<div style="position:absolute;top:31%;left:50%;transform:translate(-50%,-50%) skewX(-8deg);text-align:center;min-width:280px;font-family:${ARCADE.fontDisplay};font-style:italic;"><div style="color:#ef4444;font:900 13px ${ARCADE.fontMono};letter-spacing:5px;text-shadow:0 0 10px #ef4444;">// INCOMING //</div><div id="ff-boss-warn-name" style="color:#fff;font-size:clamp(30px,7vw,46px);font-weight:900;letter-spacing:2px;text-shadow:3px 3px 0 #450a0a,0 0 20px #ef4444;">BOSS APPROACHING</div></div>`;
    this.parent.appendChild(this.warningOverlay);
  }

  private renderBossMiniHud(): void {
    this.bossMiniHud = document.createElement('div');
    this.bossMiniHud.id = 'ff-boss-mini-hud';
    this.bossMiniHud.style.cssText = `position:absolute;top:clamp(92px,11vh,112px);left:50%;transform:translateX(-50%);z-index:24;display:none;pointer-events:none;font-family:${ARCADE.fontMono};font-size:9px;letter-spacing:2px;color:#94a3b8;text-align:center;filter:drop-shadow(1px 2px 0 #020617);`;
    this.bossMiniHud.innerHTML = `<span id="ff-boss-mini-phase">ROUND BOSS</span><span style="margin:0 8px;color:#475569;">//</span><span id="ff-boss-mini-timer">00:35</span>`;
    this.parent.appendChild(this.bossMiniHud);
  }

  private renderResultModal(): void {
    this.resultModal = document.createElement('div');
    this.resultModal.id = 'ff-boss-result-modal';
    this.resultModal.style.cssText = 'position:absolute;inset:0;z-index:55;display:none;align-items:center;justify-content:center;background:rgba(3,7,18,.88);padding:20px;font-family:Impact,Arial Black,sans-serif;pointer-events:auto;';
    this.parent.appendChild(this.resultModal);
  }

  private setupListeners(): void {
    const bus = GameEventBus.getInstance();
    this.unsubs.push(bus.on('AIM_UPDATE', (e: { x: number; y: number }) => {
      if (this.crosshair) {
        this.crosshair.style.left = `${e.x}px`;
        this.crosshair.style.top = `${e.y}px`;
      }
    }));
    this.unsubs.push(bus.on('THEME_CHANGED', (e: { id?: 'light' | 'dark' }) => {
      this.theme = e?.id === 'dark' ? 'dark' : 'light';
      this.parent.dataset.ffCombatTheme = this.theme;
    }));
    this.unsubs.push(bus.on<ComboEvent>('COMBO_UPDATE', (e) => this.updateCombo(e)));
    this.unsubs.push(bus.on('COMBO_BREAK', () => this.hideCombo()));
    this.unsubs.push(bus.on<FishHitEvent>('FISH_HIT', (e) => this.showDamageNumber(e.x, e.y, e.damage, e.isCrit)));
    this.unsubs.push(bus.on<FishHitEvent>('BOSS_HIT', (e) => this.showDamageNumber(e.x, e.y, e.damage, e.isCrit)));
    this.unsubs.push(bus.on('GAME_START', () => this.showBanner('READY?', 650, () => this.showBanner('FIGHT!', 700))));
    this.unsubs.push(bus.on('BOSS_START', () => this.showBanner('BOSS BATTLE!', 1100)));
    this.unsubs.push(bus.on<any>('BOSS_PHASE_CHANGE', (e) => this.showBanner(e.phase || 'ENRAGED', 900)));
    this.unsubs.push(bus.on('BOSS_DEFEATED', () => this.showBanner('K.O.', 1200)));
    this.unsubs.push(bus.on('BOSS_ESCAPED', () => this.showBanner('TIME UP', 1000)));
    this.unsubs.push(bus.on<TurretMultiplierEvent>('TURRET_TRIGGER', (e) => this.showTurretBonus(e)));
    this.unsubs.push(bus.on<TurretMultiplierEvent>('TURRET_UPDATE', (e) => this.updateTurretBonus(e)));
    this.unsubs.push(bus.on('TURRET_READY', () => this.hideTurret()));
    this.unsubs.push(bus.on<{ name: string; warningMs: number }>('BOSS_WARNING', (e) => this.showBossWarning(e.name, e.warningMs)));
    this.unsubs.push(bus.on<BossStateEvent>('BOSS_STATE', (e) => this.updateBossMiniHud(e)));
    this.unsubs.push(bus.on<BossResultEvent>('BOSS_DEFEATED', (res) => this.scheduleResult(res, true)));
    this.unsubs.push(bus.on<BossResultEvent>('BOSS_ESCAPED', (res) => this.scheduleResult(res, false)));
    this.unsubs.push(bus.on('ROUND_END', () => this.hideTransientUi()));
  }

  private updateCombo(e: ComboEvent): void {
    if (!this.comboContainer) return;
    if (e.combo <= 1 || e.timerRatio <= 0) {
      this.hideCombo();
      return;
    }
    this.comboContainer.style.display = 'flex';
    if (this.comboCountEl) {
      const n = Math.max(2, Math.floor(e.combo));
      this.comboCountEl.textContent = `COMBO ${n < 10 ? `0${n}` : n}`;
      this.comboCountEl.style.color = n >= 10 ? '#ef4444' : '#facc15';
      this.comboCountEl.style.textShadow = n >= 10 ? '2px 2px 0 #450a0a, 0 0 12px rgba(239,68,68,.6)' : '2px 2px 0 #713f12';
      this.comboCountEl.classList.remove('ff-combo-punch');
      void this.comboCountEl.offsetWidth;
      this.comboCountEl.classList.add('ff-combo-punch');
    }
    if (this.comboBonusEl) this.comboBonusEl.textContent = `${e.damageMultiplier.toFixed(1)}x`;
    if (this.comboBarEl) this.comboBarEl.style.width = `${Math.round(Math.max(0, Math.min(1, e.timerRatio)) * 100)}%`;
  }

  private hideCombo(): void {
    if (this.comboContainer) this.comboContainer.style.display = 'none';
  }

  private showBanner(text: string, duration: number, onComplete?: () => void): void {
    if (!this.roundBanner) return;
    this.roundBanner.textContent = text;
    this.roundBanner.style.display = 'block';
    this.roundBanner.style.opacity = '0';
    this.roundBanner.style.transform = 'translate(-50%,-50%) scale(.55) skewX(-8deg)';
    requestAnimationFrame(() => {
      if (!this.roundBanner) return;
      this.roundBanner.style.opacity = '1';
      this.roundBanner.style.transform = 'translate(-50%,-50%) scale(1) skewX(-8deg)';
    });
    this.later(() => {
      if (this.roundBanner) {
        this.roundBanner.style.opacity = '0';
        this.roundBanner.style.transform = 'translate(-50%,-50%) scale(1.25) skewX(-8deg)';
      }
      this.later(() => {
        if (this.roundBanner) this.roundBanner.style.display = 'none';
        onComplete?.();
      }, 160);
    }, duration);
  }

  private showDamageNumber(x: number, y: number, damage: number, isCrit: boolean): void {
    if (!this.damageContainer || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(damage)) return;
    const el = document.createElement('div');
    const crit = !!isCrit;
    const accent = crit ? '#facc15' : this.theme === 'dark' ? '#67e8f9' : '#ffffff';
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-family:${ARCADE.fontDisplay};font-size:${crit ? '29px' : '18px'};font-weight:900;font-style:italic;color:${accent};text-shadow:2px 2px 0 #020617,0 0 8px ${crit ? 'rgba(250,204,21,.7)' : 'rgba(34,211,238,.35)'};pointer-events:none;transform:translate(-50%,-50%) rotate(-5deg) scale(.72);transition:top .45s cubic-bezier(.23,1,.32,1),opacity .45s ease,transform .45s cubic-bezier(.23,1,.32,1);z-index:35;white-space:nowrap;`;
    el.textContent = `${Math.round(damage)}${crit ? '!' : ''}`;
    this.damageContainer.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = `${y - (crit ? 78 : 62)}px`;
      el.style.opacity = '0';
      el.style.transform = `translate(-50%,-50%) rotate(${crit ? '-8deg' : '0deg'}) scale(${crit ? 1.45 : 1.08})`;
    });
    this.later(() => el.remove(), 500);
  }

  private showTurretBonus(e: TurretMultiplierEvent): void {
    if (!this.turretContainer) return;
    this.turretContainer.style.display = 'flex';
    if (this.turretLabelEl) this.turretLabelEl.textContent = 'TURRET BONUS';
    if (this.turretValEl) {
      this.turretValEl.textContent = `x${e.multiplier}`;
      this.turretValEl.style.color = '#67e8f9';
    }
    if (this.turretBarEl) {
      this.turretBarEl.style.width = '100%';
      this.turretBarEl.style.background = '#22d3ee';
      this.turretBarEl.style.boxShadow = '0 0 10px rgba(34,211,238,.7)';
    }
  }

  private updateTurretBonus(e: TurretMultiplierEvent): void {
    if (!this.turretContainer) return;
    if (e.state === 'COOLDOWN') {
      this.turretContainer.style.display = 'flex';
      if (this.turretLabelEl) this.turretLabelEl.textContent = 'TURRET';
      if (this.turretValEl) {
        this.turretValEl.textContent = 'RECHARGE';
        this.turretValEl.style.color = '#94a3b8';
      }
      if (this.turretBarEl && e.totalDurationMs > 0) {
        this.turretBarEl.style.width = `${Math.round(Math.max(0, Math.min(1, e.remainingMs / e.totalDurationMs)) * 100)}%`;
        this.turretBarEl.style.background = '#64748b';
        this.turretBarEl.style.boxShadow = 'none';
      }
      return;
    }
    this.showTurretBonus(e);
    if (this.turretBarEl && e.totalDurationMs > 0) {
      const ratio = Math.max(0, Math.min(1, e.remainingMs / e.totalDurationMs));
      this.turretBarEl.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (e.remainingMs <= 0 || e.active === false) this.hideTurret();
  }

  private hideTurret(): void {
    if (this.turretContainer) this.turretContainer.style.display = 'none';
  }

  private showBossWarning(name: string, warningMs: number): void {
    if (!this.warningOverlay) return;
    const nameEl = this.warningOverlay.querySelector<HTMLElement>('#ff-boss-warn-name');
    if (nameEl) nameEl.textContent = name || 'BOSS APPROACHING';
    this.warningOverlay.style.display = 'block';
    this.later(() => {
      if (this.warningOverlay) this.warningOverlay.style.display = 'none';
    }, Math.max(650, warningMs));
  }

  private updateBossMiniHud(e: BossStateEvent): void {
    if (!this.bossMiniHud) return;
    const active = e.phase !== 'idle' && e.phase !== 'defeated' && e.phase !== 'escaped';
    this.bossMiniHud.style.display = active ? 'block' : 'none';
    const phase = this.bossMiniHud.querySelector<HTMLElement>('#ff-boss-mini-phase');
    const timer = this.bossMiniHud.querySelector<HTMLElement>('#ff-boss-mini-timer');
    if (phase) {
      phase.textContent = e.phase === 'enraged' ? 'ENRAGED' : e.phase === 'warning' ? 'INCOMING' : 'BOSS ROUND';
      phase.style.color = e.phase === 'enraged' ? '#ef4444' : '#facc15';
    }
    if (timer) {
      const sec = Math.max(0, Math.ceil(e.timeRemainingSec));
      timer.textContent = `00:${String(sec).padStart(2, '0')}`;
      timer.style.color = sec <= 5 ? '#ef4444' : '#94a3b8';
    }
  }

  private scheduleResult(res: BossResultEvent, victory: boolean): void {
    this.later(() => {
      if (victory) this.showVictory(res);
      else this.showDefeat(res);
    }, victory ? 1400 : 900);
  }

  private showVictory(res: BossResultEvent): void {
    this.showResult('VICTORY', 'APEX LEVIATHAN // K.O.', res, '#facc15');
  }

  private showDefeat(res: BossResultEvent): void {
    this.showResult('TIME UP', 'APEX LEVIATHAN ESCAPED', res, '#ef4444');
  }

  private showResult(title: string, subtitle: string, res: BossResultEvent, accent: string): void {
    if (!this.resultModal) return;
    this.resultModal.innerHTML = `
      <div style="width:min(430px,94vw);border:3px solid ${accent};background:#080d18;box-shadow:6px 6px 0 #020617;padding:22px;color:#fff;transform:skewX(-2deg);">
        <div style="font:900 11px ${ARCADE.fontMono};letter-spacing:4px;color:${accent};">// RAID RESULT //</div>
        <div style="font:900 italic clamp(36px,10vw,58px) ${ARCADE.fontDisplay};line-height:.95;margin-top:4px;text-shadow:3px 3px 0 #020617;">${title}</div>
        <div style="font:900 11px ${ARCADE.fontMono};letter-spacing:2px;color:#94a3b8;margin-top:7px;">${subtitle}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px;">
          <div style="border:1px solid #334155;background:#0f172a;padding:10px;text-align:left;"><div style="font:900 9px ${ARCADE.fontMono};color:#64748b;letter-spacing:1px;">DAMAGE</div><div style="font:900 22px ${ARCADE.fontDisplay};color:#f8fafc;">${Math.round(res.totalDamage).toLocaleString()}</div></div>
          <div style="border:1px solid #334155;background:#0f172a;padding:10px;text-align:left;"><div style="font:900 9px ${ARCADE.fontMono};color:#64748b;letter-spacing:1px;">TIME</div><div style="font:900 22px ${ARCADE.fontDisplay};color:#f8fafc;">${res.timeElapsedSec.toFixed(1)}s</div></div>
          <div style="border:1px solid #334155;background:#0f172a;padding:10px;text-align:left;"><div style="font:900 9px ${ARCADE.fontMono};color:#64748b;letter-spacing:1px;">MULTIPLIER</div><div style="font:900 22px ${ARCADE.fontDisplay};color:#67e8f9;">x${res.multiplier.toFixed(1)}</div></div>
          <div style="border:1px solid ${accent};background:#111827;padding:10px;text-align:left;"><div style="font:900 9px ${ARCADE.fontMono};color:#64748b;letter-spacing:1px;">BOUNTY</div><div style="font:900 22px ${ARCADE.fontDisplay};color:${accent};">+${res.bountyPayout.toFixed(2)} ${res.currency}</div></div>
        </div>
        <button id="ff-boss-result-close" type="button" class="ff-arcade-btn ff-arcade-btn-primary" style="width:100%;margin-top:16px;padding:10px;font-size:14px;letter-spacing:2px;">RETURN TO COMBAT</button>
      </div>`;
    this.resultModal.style.display = 'flex';
    this.resultModal.querySelector('#ff-boss-result-close')?.addEventListener('click', () => {
      if (this.resultModal) {
        this.resultModal.style.display = 'none';
        this.resultModal.innerHTML = '';
      }
    });
  }

  private hideTransientUi(): void {
    this.hideCombo();
    this.hideTurret();
    if (this.warningOverlay) this.warningOverlay.style.display = 'none';
    if (this.bossMiniHud) this.bossMiniHud.style.display = 'none';
  }

  public destroy(): void {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    this.parent.querySelector('#ff-arcade-crosshair')?.remove();
    this.parent.querySelector('#ff-round-banner')?.remove();
    this.parent.querySelector('#ff-damage-layer')?.remove();
    this.parent.querySelector('#ff-combo-widget')?.remove();
    this.parent.querySelector('#ff-turret-widget')?.remove();
    this.parent.querySelector('#ff-boss-warning-overlay')?.remove();
    this.parent.querySelector('#ff-boss-mini-hud')?.remove();
    this.parent.querySelector('#ff-boss-result-modal')?.remove();
    this.comboContainer = null;
    this.turretContainer = null;
    this.warningOverlay = null;
    this.resultModal = null;
    this.crosshair = null;
    this.roundBanner = null;
    this.damageContainer = null;
    this.bossMiniHud = null;
  }
}
