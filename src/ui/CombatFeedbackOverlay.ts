import { GameEventBus, FishHitEvent, FishKilledEvent, ComboEvent, TurretMultiplierEvent } from '../engine/core/GameEvents';

/** Final arcade feedback layer: terse fight-state telemetry, impact grades and KO cadence. */
export class CombatFeedbackOverlay {
  private root: HTMLDivElement;
  private status: HTMLDivElement;
  private score: HTMLDivElement;
  private hit: HTMLDivElement;
  private killCount = 0;
  private unsubs: Array<() => void> = [];
  private hideTimer: number | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ff-fighter-feedback';
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.root.innerHTML = `<div class="ff-fighter-strip"><span class="ff-fighter-label">FIGHT</span><span class="ff-fighter-divider"></span><span id="ff-fighter-status">READY</span><span class="ff-fighter-divider"></span><span id="ff-fighter-kills">K.O. 00</span></div><div id="ff-fighter-score" class="ff-fighter-score">00</div><div id="ff-fighter-hit" class="ff-fighter-hit" aria-hidden="true"></div>`;
    parent.appendChild(this.root);
    this.status = this.root.querySelector('#ff-fighter-status')!;
    this.score = this.root.querySelector('#ff-fighter-kills')!;
    this.hit = this.root.querySelector('#ff-fighter-hit')!;
    this.bind();
  }

  private bind(): void {
    const bus = GameEventBus.getInstance();
    this.unsubs.push(bus.on('GAME_START', () => { this.killCount = 0; this.setStatus('READY', ''); window.setTimeout(() => this.setStatus('FIGHT!', 'fight'), 650); }));
    this.unsubs.push(bus.on('ROUND_END', () => { this.setStatus('ROUND OVER', ''); this.hideHit(); }));
    this.unsubs.push(bus.on<FishHitEvent>('FISH_HIT', (e) => this.onHit(e)));
    this.unsubs.push(bus.on<FishHitEvent>('BOSS_HIT', (e) => this.onHit(e, true)));
    this.unsubs.push(bus.on<FishKilledEvent>('FISH_KILLED', (e) => this.onKill(e)));
    this.unsubs.push(bus.on<ComboEvent>('COMBO_UPDATE', (e) => this.onCombo(e)));
    this.unsubs.push(bus.on('COMBO_BREAK', () => this.setStatus('BREAK', 'break')));
    this.unsubs.push(bus.on<TurretMultiplierEvent>('TURRET_TRIGGER', (e) => this.setStatus(`TURRET x${e.multiplier}`, 'turret')));
    this.unsubs.push(bus.on<TurretMultiplierEvent>('TURRET_UPDATE', (e) => { if (e.state === 'COOLDOWN') this.setStatus('TURRET RECHARGE', 'cooldown'); else if (e.active && e.remainingMs <= 550) this.setStatus('TURRET END', 'turret'); }));
    this.unsubs.push(bus.on('TURRET_READY', () => this.setStatus('TURRET READY', 'ready')));
    this.unsubs.push(bus.on('BOSS_START', () => this.setStatus('BOSS BATTLE', 'boss')));
    this.unsubs.push(bus.on('BOSS_DEFEATED', () => this.setStatus('K.O.', 'ko')));
    this.unsubs.push(bus.on('BOSS_ESCAPED', () => this.setStatus('TIME UP', 'danger')));
    this.unsubs.push(bus.on<any>('BOSS_PHASE_CHANGE', (e) => this.setStatus(String(e.phase || 'ENRAGED').toUpperCase(), 'danger')));
  }

  private onHit(e: FishHitEvent, boss = false): void {
    const damage = Number.isFinite(e.damage) ? Math.max(0, Math.round(e.damage)) : 0;
    const crit = !!e.isCrit;
    const superCrit = !!e.isSuperCrit;
    const grade = superCrit ? 'FIERCE!' : crit ? (damage >= 25 ? 'CRITICAL!' : 'CRITICAL') : damage >= 20 ? 'POWER HIT' : boss ? 'BOSS HIT' : 'HIT';
    this.hit.textContent = `${grade}  ${damage}`;
    this.hit.dataset.kind = superCrit ? 'super-critical' : crit ? 'critical' : boss ? 'boss' : 'normal';
    this.hit.classList.remove('ff-impact');
    void this.hit.offsetWidth;
    this.hit.classList.add('ff-impact');
    this.score.textContent = String(damage).padStart(2, '0');
    if (superCrit) this.setStatus('FIERCE!', 'critical');
  }

  private onKill(e: FishKilledEvent): void {
    this.killCount += 1;
    const count = Math.min(99, this.killCount);
    this.score.textContent = String(Math.round(e.payout * 100)).padStart(2, '0');
    this.score.classList.remove('ff-score-punch');
    void this.score.offsetWidth;
    this.score.classList.add('ff-score-punch');
    const label = e.fishType === 'boss' ? 'K.O. BOSS' : count % 10 === 0 ? `K.O. ${count}` : 'K.O.';
    this.setStatus(label, e.fishType === 'boss' ? 'ko' : 'kill');
    this.root.querySelector('#ff-fighter-kills')!.textContent = `K.O. ${String(count).padStart(2, '0')}`;
  }

  private onCombo(e: ComboEvent): void {
    const n = Math.floor(e.combo);
    if (n < 2 || e.timerRatio <= 0) return;
    const tier = n >= 20 ? 'RAMPAGE' : n >= 10 ? 'FIERCE' : n >= 5 ? 'RUSH' : 'CHAIN';
    this.setStatus(`${tier} ${n}`, n >= 10 ? 'danger' : 'combo');
  }

  private setStatus(text: string, kind: string): void {
    this.status.textContent = text;
    this.status.dataset.kind = kind;
    this.root.dataset.state = kind;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    if (kind && !['boss', 'ko', 'danger', 'critical'].includes(kind)) {
      this.hideTimer = window.setTimeout(() => { this.status.textContent = 'FIGHT'; this.status.dataset.kind = ''; this.root.dataset.state = ''; this.hideTimer = null; }, 900);
    }
  }

  private hideHit(): void { this.hit.textContent = ''; this.hit.classList.remove('ff-impact'); }

  public destroy(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.root.remove();
  }
}
