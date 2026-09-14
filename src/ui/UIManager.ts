import { WalletService } from '../network/WalletService';
import { FeatureFlags } from '../config/FeatureFlags';
import { SoundManager } from '../audio/SoundManager';
import { GameTheme } from '../engine/systems/ThemeManager';
import { LoadoutManager, SKIN_PRICES } from '../network/LoadoutManager';
import { ARMORY_SKINS, skinUnlockLabel } from './modals/armorySkins';
import { PayoutEngine } from '../engine/systems/PayoutEngine';
import { showStreakModal as openStreakModal } from './modals/streakModal';
import { showAuditModal as openAuditModal } from './modals/auditModal';
import { showLeaderboardModal as openLeaderboardModal } from './modals/leaderboardModal';
import { showAdminPortalModal as openAdminPortalModal } from './modals/adminPortalModal';
import type { ModalContext } from './modals/ModalContext';

export class UIManager {
  private container: HTMLElement;
  private gcBalanceEl!: HTMLElement;
  private scBalanceEl!: HTMLElement;
  private betDisplayEl: HTMLElement | null = null;
  private soundBtn!: HTMLElement;
  private modalContainer!: HTMLElement;

  private currentBetIndex: number = 4; // Default 1.00 SC
  private betTiers: number[] = [0.05, 0.10, 0.25, 0.50, 1.00, 2.50, 5.00, 10.00];
  private gcBalance: number = 10000;
  private scBalance: number = 50.00;
  private activeCurrency: 'GC' | 'SC' = 'SC';
  private autoFireEnabled: boolean = false;
  private currentTheme: GameTheme = 'light';

  private onThemeChangeCallback?: (theme: GameTheme) => void;
  private onAutoFireToggleCallback?: (enabled: boolean) => void;
  private onBetChangeCallback?: (bet: number, currency: 'GC' | 'SC') => void;
  private onLoadoutChangeCallback?: () => void;
  private onPlayCallback?: () => void;
  private startScreenEl: HTMLElement | null = null;
  private isGameActive: boolean = false;

  constructor(
    rootElement: HTMLElement,
    callbacks?: {
      onThemeChange?: (theme: GameTheme) => void;
      onAutoFireToggle?: (enabled: boolean) => void;
      onBetChange?: (bet: number, currency: 'GC' | 'SC') => void;
      onLoadoutChange?: () => void;
      onPlay?: () => void;
    }
  ) {
    this.onThemeChangeCallback = callbacks?.onThemeChange;
    this.onAutoFireToggleCallback = callbacks?.onAutoFireToggle;
    this.onBetChangeCallback = callbacks?.onBetChange;
    this.onLoadoutChangeCallback = callbacks?.onLoadoutChange;
    this.onPlayCallback = callbacks?.onPlay;

    this.container = document.createElement('div');
    this.container.id = 'fish-frenzy-hud';
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      z-index: 20; display: flex; flex-direction: column; justify-content: space-between;
      box-sizing: border-box; padding: 16px; overflow: hidden;
    `;
    rootElement.appendChild(this.container);

    this.renderHUD();
    this.createModalContainer(rootElement);

    // Seed lifetime deposit ledger once with starting SC (operator P&L baseline)
    try {
      if (!localStorage.getItem('fish_frenzy_deposit_seeded')) {
        PayoutEngine.recordDeposit(this.scBalance);
        localStorage.setItem('fish_frenzy_deposit_seeded', '1');
      }
    } catch { /* ignore */ }
    // HUD starts hidden until Play
    this.container.style.visibility = 'hidden';
  }

  /** Full-screen cyber title card with Play CTA */
  public showStartScreen(): void {
    if (this.startScreenEl) return;

    const wallet = WalletService.getInstance();

    this.startScreenEl = document.createElement('div');
    this.startScreenEl.id = 'fish-frenzy-start';

    Object.assign(this.startScreenEl.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      boxSizing: 'border-box',
      background:
        'radial-gradient(circle at 50% 35%, rgba(25,55,75,.72), rgba(3,7,13,.98) 72%)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    });

    this.startScreenEl.innerHTML = `
      <div style="
        width:min(560px,100%);
        max-height:calc(100vh - 48px);
        overflow:auto;
        box-sizing:border-box;
        padding:28px;
        border:1px solid rgba(100,220,255,.35);
        border-radius:20px;
        background:rgba(5,12,20,.92);
        box-shadow:0 0 50px rgba(0,180,255,.16);
        text-align:center;
      ">
        <div style="
          font-size:11px;
          letter-spacing:.22em;
          opacity:.65;
          margin-bottom:8px;
        ">CYBER TRENCH ARCADE</div>

        <div style="
          font-size:clamp(34px,8vw,58px);
          line-height:.95;
          font-weight:900;
          letter-spacing:.04em;
          margin-bottom:10px;
        ">FISH FRENZY</div>

        <div style="
          font-size:13px;
          opacity:.72;
          margin-bottom:22px;
        ">ENTER THE TRENCH · LOAD YOUR WALLET · PLAY</div>

        <div id="ff-auth-status" style="
          padding:10px 12px;
          border-radius:10px;
          background:rgba(255,255,255,.05);
          font-size:12px;
          margin-bottom:16px;
        "></div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:16px;
        ">
          <div style="
            padding:14px;
            border-radius:12px;
            background:rgba(255,190,0,.08);
            border:1px solid rgba(255,190,0,.2);
          ">
            <div style="font-size:10px;opacity:.6;letter-spacing:.12em;">GOLD COINS</div>
            <div id="ff-lobby-gc" style="font-size:24px;font-weight:800;">—</div>
          </div>

          <div style="
            padding:14px;
            border-radius:12px;
            background:rgba(0,220,255,.08);
            border:1px solid rgba(0,220,255,.2);
          ">
            <div style="font-size:10px;opacity:.6;letter-spacing:.12em;">SWEEPSTAKES COINS</div>
            <div id="ff-lobby-sc" style="font-size:24px;font-weight:800;">—</div>
          </div>
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:12px;
        ">
          <button id="ff-deposit" style="
            padding:13px;
            border-radius:10px;
            border:1px solid rgba(0,230,255,.4);
            background:rgba(0,180,255,.13);
            color:#fff;
            font-weight:800;
            cursor:pointer;
          ">DEPOSIT</button>

          <button id="ff-withdraw" style="
            padding:13px;
            border-radius:10px;
            border:1px solid rgba(255,120,180,.4);
            background:rgba(255,80,150,.10);
            color:#fff;
            font-weight:800;
            cursor:pointer;
          ">WITHDRAW</button>
        </div>

        <div id="ff-wallet-status" style="
          min-height:18px;
          margin:6px 0 14px;
          font-size:11px;
          opacity:.72;
        "></div>

        <div style="
          display:flex;
          justify-content:center;
          gap:8px;
          margin-bottom:16px;
        ">
          <button data-theme="can-tech" id="ff-theme-can" style="
            padding:8px 12px;
            border-radius:8px;
            border:1px solid rgba(0,220,255,.3);
            background:rgba(0,180,255,.08);
            color:#fff;
            cursor:pointer;
          ">CAN-TECH</button>

          <button data-theme="horror" id="ff-theme-horror" style="
            padding:8px 12px;
            border-radius:8px;
            border:1px solid rgba(255,80,100,.3);
            background:rgba(255,60,80,.08);
            color:#fff;
            cursor:pointer;
          ">HORROR</button>
        </div>

        <button id="ff-play" style="
          width:100%;
          padding:16px;
          border:0;
          border-radius:12px;
          background:linear-gradient(135deg,#00d9ff,#176cff);
          color:#001018;
          font-size:18px;
          font-weight:900;
          letter-spacing:.08em;
          cursor:pointer;
          box-shadow:0 0 28px rgba(0,190,255,.25);
        ">PLAY</button>

        <div style="
          margin-top:16px;
          font-size:10px;
          line-height:1.5;
          opacity:.45;
        ">
          Hold to fire · Stake in Lobby · Wallet transactions are processed server-side · Terms
        </div>
      </div>
    `;

    document.body.appendChild(this.startScreenEl);

    const root = this.startScreenEl;

    const gcEl = root.querySelector<HTMLElement>('#ff-lobby-gc');
    const scEl = root.querySelector<HTMLElement>('#ff-lobby-sc');
    const authEl = root.querySelector<HTMLElement>('#ff-auth-status');
    const statusEl = root.querySelector<HTMLElement>('#ff-wallet-status');

    const renderWallet = () => {
      const b = wallet.getBalances();

      if (gcEl) gcEl.textContent = b.goldCoins.toLocaleString();
      if (scEl) scEl.textContent = b.sweepstakesCoins.toLocaleString();

      if (authEl) {
        const auth = AuthManager.getInstance();
        const state = auth.getState();

        authEl.textContent = state.displayName
          ? `SIGNED IN · ${state.displayName}`
          : 'GUEST / LOCAL SESSION';
      }
    };

    const unsubscribeWallet = wallet.subscribe(renderWallet);

    // Keep the subscription attached to this lobby only.
    (root as any).__walletUnsubscribe = unsubscribeWallet;

    void wallet.connect().then(renderWallet).catch((error) => {
      console.error('[Lobby] wallet connect failed', error);
      if (statusEl) statusEl.textContent = 'Wallet unavailable.';
    });

    root.querySelector<HTMLButtonElement>('#ff-deposit')
      ?.addEventListener('click', async () => {
        const amountText = window.prompt('Deposit amount (SC):', '10');
        if (amountText === null) return;

        const amount = Number(amountText);

        if (!Number.isFinite(amount) || amount <= 0) {
          if (statusEl) statusEl.textContent = 'Enter a valid amount.';
          return;
        }

        if (statusEl) statusEl.textContent = 'Creating deposit request…';

        try {
          const result = await wallet.requestDeposit(amount, 'SC');

          if (statusEl) {
            statusEl.textContent =
              `Deposit request ${result.requestId.slice(0, 8)}… pending confirmation.`;
          }
        } catch (error) {
          console.error('[Lobby] deposit failed', error);
          if (statusEl) {
            statusEl.textContent =
              error instanceof Error ? error.message : 'Deposit request failed.';
          }
        }
      });

    root.querySelector<HTMLButtonElement>('#ff-withdraw')
      ?.addEventListener('click', async () => {
        const balance = wallet.getBalance('SC');
        const amountText = window.prompt(
          `Withdraw SC amount (available: ${balance.toLocaleString()}):`,
          ''
        );

        if (amountText === null) return;

        const amount = Number(amountText);

        if (!Number.isFinite(amount) || amount <= 0) {
          if (statusEl) statusEl.textContent = 'Enter a valid amount.';
          return;
        }

        if (amount > balance) {
          if (statusEl) statusEl.textContent = 'Insufficient SC balance.';
          return;
        }

        if (statusEl) statusEl.textContent = 'Creating withdrawal request…';

        try {
          const result = await wallet.requestWithdrawal(amount, 'SC');

          if (statusEl) {
            statusEl.textContent =
              `Withdrawal ${result.requestId.slice(0, 8)}… pending processing.`;
          }

          renderWallet();
        } catch (error) {
          console.error('[Lobby] withdrawal failed', error);
          if (statusEl) {
            statusEl.textContent =
              error instanceof Error ? error.message : 'Withdrawal request failed.';
          }
        }
      });

    root.querySelector<HTMLButtonElement>('#ff-play')
      ?.addEventListener('click', () => {
        this.options.onPlay();
      });

    root.querySelector<HTMLButtonElement>('#ff-theme-can')
      ?.addEventListener('click', () => {
        this.options.onThemeChange?.('can-tech');
      });

    root.querySelector<HTMLButtonElement>('#ff-theme-horror')
      ?.addEventListener('click', () => {
        this.options.onThemeChange?.('horror');
      });
  }

  public hideStartScreen(): void {

    if (this.startScreenEl) {
      const unsubscribe = (this.startScreenEl as any).__walletUnsubscribe;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }


    if (this.startScreenEl) {
      this.startScreenEl.remove();
      this.startScreenEl = null;
    }
    this.isGameActive = true;
    this.container.style.visibility = 'visible';
  }

  private renderHUD(): void {
    this.container.innerHTML = `
      <!-- TOP NAVIGATION BAR -->
      <div id="hud-topbar" style="display: flex; justify-content: space-between; align-items: center; width: 100%; pointer-events: auto; gap: 6px; flex-wrap: wrap;">
        <!-- Wallets & Mode -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <!-- GC Wallet -->
          <div id="hud-gc-wallet" style="background: rgba(15, 23, 42, 0.88); border: 1px solid #3b82f6; padding: 6px 10px; border-radius: 8px; color: #ffffff; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
            <span style="color: #60a5fa; font-weight: 800; font-size: 11px;">GC</span>
            <span id="hud-gc-balance" style="font-size: 13px; font-weight: 700;">${this.gcBalance.toLocaleString()}</span>
          </div>

          <!-- SC Wallet -->
          <div id="hud-sc-wallet" style="background: rgba(15, 23, 42, 0.88); border: 2px solid #00ffcc; padding: 6px 10px; border-radius: 8px; color: #ffffff; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,255,204,0.15);">
            <span style="color: #00ffcc; font-weight: 800; font-size: 11px;">SC</span>
            <span id="hud-sc-balance" style="font-size: 13px; font-weight: 700; color: #00ffcc;">${this.scBalance.toFixed(2)}</span>
          </div>

          <!-- Read-only stake (change in Lobby) -->
          <div id="hud-stake-readonly" style="background: rgba(15, 23, 42, 0.88); border: 1px solid #475569; padding: 6px 10px; border-radius: 8px; color: #e2e8f0; font-size: 11px; font-weight: 700;">
            BET <span id="hud-bet-display">${this.getCurrentBet()} ${this.activeCurrency}</span>
          </div>
        </div>

        <!-- Lobby + essentials only (shop/streak/admin live in Lobby) -->
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <button id="hud-lobby-btn" title="Open Lobby" style="background: linear-gradient(135deg,#0f766e,#155e75); color: #ecfeff; border: 1px solid #22d3ee; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; box-shadow: 0 0 12px rgba(34,211,238,0.25);">
            ⌂ LOBBY
          </button>
          <button id="hud-sound-toggle" title="Audio" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🔊
          </button>
        </div>
      </div>

      <!-- BOTTOM TACTICAL WEAPON HUD -->
      <div id="hud-bottombar" style="display: flex; justify-content: center; align-items: center; width: 100%; pointer-events: none; padding-bottom: 8px;">
        <div style="font-size: 10px; color: #64748b; letter-spacing: 0.5px;">HOLD TO FIRE · stake set in LOBBY</div>
      </div>
    `;

    // Reference elements
    this.gcBalanceEl = document.getElementById('hud-gc-balance')!;
    this.scBalanceEl = document.getElementById('hud-sc-balance')!;
    this.betDisplayEl = document.getElementById('hud-bet-display');
    this.soundBtn = document.getElementById('hud-sound-toggle')!;

    // Event listeners

    this.soundBtn.addEventListener('click', () => this.toggleSound());

    document.getElementById('hud-lobby-btn')?.addEventListener('click', () => this.showLobby());

    // Operator shortcut still opens Admin from Lobby tools
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        this.showAdminPortalModal();
      }
    });
  }

  private createModalContainer(root: HTMLElement): void {
    this.modalContainer = document.createElement('div');
    this.modalContainer.id = 'hud-modal-layer';
    this.modalContainer.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(5, 5, 10, 0.75); backdrop-filter: blur(8px);
      display: none; justify-content: center; align-items: center;
      z-index: 50; padding: 20px; box-sizing: border-box;
    `;
    this.modalContainer.addEventListener('click', (e) => {
      if (e.target === this.modalContainer) {
        this.closeModal();
      }
    });
    root.appendChild(this.modalContainer);
  }

  public closeModal(): void {
    SoundManager.playUiSound('modal_close');
    this.modalContainer.style.display = 'none';
    this.modalContainer.innerHTML = '';
  }

  private openModal(html: string): void {
    SoundManager.playUiSound('modal_open');
    this.modalContainer.innerHTML = html;
    this.modalContainer.style.display = 'flex';
  }

  private modalCtx(): ModalContext {
    return {
      modalContainer: this.modalContainer,
      closeModal: () => this.closeModal(),
      openModal: (html: string) => this.openModal(html),
      addBalance: (gc, sc) => this.addBalance(gc, sc),
      getScBalance: () => this.scBalance
    };
  }


  /** Full-screen lobby: shop, streak, ranks, audit, operator tools — off the combat HUD. */
  public showLobby(): void {
    SoundManager.playUiSound('modal_open');
    const rtp = PayoutEngine.getTargetRtp();
    const profit = PayoutEngine.getProfitSnapshot();
    this.modalContainer.innerHTML = `
      <div style="background:linear-gradient(160deg,#0b1224 0%,#0f172a 40%,#081018 100%); border:2px solid #22d3ee; border-radius:18px; padding:22px; max-width:560px; width:100%; color:#e2e8f0; box-shadow:0 20px 50px rgba(0,0,0,0.75); max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <div style="font-size:11px; letter-spacing:3px; color:#22d3ee; font-weight:800;">FISH FRENZY</div>
            <h2 style="margin:4px 0 0; font-size:22px; font-weight:900;">LOBBY</h2>
          </div>
          <button id="lobby-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:22px;cursor:pointer;">✕</button>
        </div>
        <p style="margin:0 0 16px; font-size:12px; color:#94a3b8; line-height:1.45;">
          Combat HUD stays clean. Shop, rewards, and operator tools live here.
          Target RTP <strong style="color:#fbbf24;">${rtp}%</strong>
          · House edge ~<strong>${(100 - rtp).toFixed(0)}%</strong>
          · P&amp;L ${profit.isProfitable ? '<span style="color:#34d399">OK</span>' : '<span style="color:#f87171">REVIEW</span>'}
        </p>

        <div style="margin-bottom:16px;padding:14px;background:#0f172a;border:1px solid #334155;border-radius:12px;">
          <div style="font-size:10px;letter-spacing:2px;color:#64748b;font-weight:700;margin-bottom:10px;">STAKE · SET BEFORE RESUME</div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button type="button" id="lobby-cur-sc" style="flex:1;padding:10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;border:2px solid ${this.activeCurrency==='SC'?'#00ffcc':'#334155'};background:${this.activeCurrency==='SC'?'rgba(0,255,204,0.15)':'#1e293b'};color:${this.activeCurrency==='SC'?'#00ffcc':'#94a3b8'};">SC</button>
            <button type="button" id="lobby-cur-gc" style="flex:1;padding:10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;border:2px solid ${this.activeCurrency==='GC'?'#fbbf24':'#334155'};background:${this.activeCurrency==='GC'?'rgba(251,191,36,0.15)':'#1e293b'};color:${this.activeCurrency==='GC'?'#fbbf24':'#94a3b8'};">GC</button>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Bet amount <span style="color:#64748b">(resets to 1.00 when currency changes)</span></div>
          <div id="lobby-bet-chips" style="display:flex;flex-wrap:wrap;gap:6px;">
            ${this.betTiers.map((b, i) => `
              <button type="button" class="lobby-bet-chip" data-bet-index="${i}" style="
                padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:11px;
                border:1px solid ${i===this.currentBetIndex?'#00ffcc':'#334155'};
                background:${i===this.currentBetIndex?'rgba(0,255,204,0.2)':'#1e293b'};
                color:${i===this.currentBetIndex?'#00ffcc':'#e2e8f0'};
              ">${b} ${this.activeCurrency}</button>
            `).join('')}
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <button class="lobby-tile" data-lobby="shop" style="text-align:left; background:#1e293b; border:1px solid #e11d48; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">🎯</div>
            <div style="font-weight:800; color:#fb7185;">SHOP / ARMORY</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Unlock & equip turret chassis</div>
          </button>
          <button class="lobby-tile" data-lobby="streak" style="text-align:left; background:#1e293b; border:1px solid #f59e0b; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">⚡</div>
            <div style="font-weight:800; color:#fbbf24;">STREAK</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Daily login rewards</div>
          </button>
          <button class="lobby-tile" data-lobby="ranks" style="text-align:left; background:#1e293b; border:1px solid #7c3aed; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">🏆</div>
            <div style="font-weight:800; color:#c4b5fd;">RANKS</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Tournament leaderboard</div>
          </button>
          <button class="lobby-tile" data-lobby="audit" style="text-align:left; background:#1e293b; border:1px solid #0284c7; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">🛡️</div>
            <div style="font-weight:800; color:#38bdf8;">AUDIT</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Provably fair seed check</div>
          </button>
          <button class="lobby-tile" data-lobby="operator" style="grid-column:1 / -1; text-align:left; background:rgba(245,158,11,0.12); border:1px solid #f59e0b; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">⚙️</div>
            <div style="font-weight:800; color:#fbbf24;">OPERATOR · PAYOUTS & MONTE CARLO</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Set RTP (90% default), run sims, deposit vs payout P&amp;L</div>
          </button>
        </div>
        <button id="lobby-resume-btn" style="margin-top:16px; width:100%; background:linear-gradient(135deg,#00ffcc,#0891b2); color:#0a0f1d; border:none; padding:12px; border-radius:10px; font-weight:900; letter-spacing:1px; cursor:pointer;">
          ▶ RESUME TRENCH
        </button>
      </div>
    `;
    this.modalContainer.style.display = 'flex';
    document.getElementById('lobby-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('lobby-resume-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('lobby-cur-sc')?.addEventListener('click', () => {
      this.setCurrency('SC');
      this.showLobby();
    });
    document.getElementById('lobby-cur-gc')?.addEventListener('click', () => {
      this.setCurrency('GC');
      this.showLobby();
    });
    this.modalContainer.querySelectorAll('.lobby-bet-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).getAttribute('data-bet-index') || '0', 10);
        this.setBetIndex(idx);
        this.showLobby();
      });
    });
    this.modalContainer.querySelectorAll('.lobby-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-lobby');
        if (id === 'shop') this.showArmoryModal();
        else if (id === 'streak') this.showStreakModal();
        else if (id === 'ranks') this.showLeaderboardModal();
        else if (id === 'audit') this.showAuditModal();
        else if (id === 'operator') this.showAdminPortalModal();
      });
    });
  }

  private async showStreakModal(): Promise<void> {
    await openStreakModal(this.modalCtx());
  }


  private showArmoryModal(): void {
    const currentLoadout = LoadoutManager.getLoadout();
    const availableSkins = ARMORY_SKINS;

    this.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #e11d48; border-radius: 16px; padding: 24px; max-width: 520px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.85);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #f43f5e; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🎯</span> CANNON ARMORY & SPRITE SKINS
          </h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px; line-height: 1.4;">
          Equip specialized animated weapon chassis. Each skin features custom animated idle breathing, charge buildup, muzzle blast bursts, spent shell ejections, and matching ballistic projectiles.
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          ${availableSkins.map(skin => {
            const isEquipped = currentLoadout.activeCannonSkin === skin.id;
            const isUnlocked = currentLoadout.unlockedSkins.includes(skin.id);
            const price = SKIN_PRICES[skin.id] ?? 0;
            return `
              <div style="background: ${isEquipped ? 'rgba(225, 29, 72, 0.18)' : '#1e293b'}; border: 1.5px solid ${isEquipped ? '#f43f5e' : skin.border}; border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
                  <div style="width: 46px; height: 46px; border-radius: 8px; background: rgba(0,0,0,0.55); border: 1px solid ${skin.color}; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                    <img src="skins/${skin.id}/idle_0.png" alt="${skin.name}" style="width: 42px; height: 42px; object-fit: contain;" />
                  </div>
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                      <span style="font-size: 14px; font-weight: 800; color: ${skin.color};">${skin.name}</span>
                      <span style="font-size: 10px; font-weight: 700; background: rgba(0,0,0,0.4); border: 1px solid ${skin.color}; color: ${skin.color}; padding: 1px 6px; border-radius: 4px;">${skin.badge}</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">${skin.desc}</div>
                  </div>
                </div>
                <button class="armory-equip-btn" data-skin="${skin.id}" style="background: ${isEquipped ? '#f43f5e' : '#334155'}; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; white-space: nowrap; transition: background 0.15s;">
                  ${skinUnlockLabel(skin.id, isUnlocked, isEquipped)}
                </button>
              </div>
            `;
          }).join('')}
        </div>
        <button id="modal-close-btn-bottom" style="width: 100%; background: #334155; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          CLOSE ARMORY
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => this.closeModal());

    const equipButtons = this.modalContainer.querySelectorAll('.armory-equip-btn');
    equipButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        SoundManager.playUiSound('autofire_on');
        const targetSkin = (e.currentTarget as HTMLElement).getAttribute('data-skin')!;
        let loadout = LoadoutManager.getLoadout();
        if (!loadout.unlockedSkins.includes(targetSkin)) {
          const price = SKIN_PRICES[targetSkin] ?? 0;
          const result = LoadoutManager.unlockSkin(targetSkin, this.scBalance);
          if (!result.ok) {
            const status = document.getElementById('modal-armory-status');
            if (status) status.textContent = `Need ${price} SC to unlock (you have ${this.scBalance.toFixed(2)}).`;
            return;
          }
          this.setBalances(this.gcBalance, result.newSc);
          loadout = LoadoutManager.getLoadout();
        }
        LoadoutManager.saveLoadout({
          ...loadout,
          activeCannonSkin: targetSkin
        });
        if (this.onLoadoutChangeCallback) {
          this.onLoadoutChangeCallback();
        }
        this.showArmoryModal(); // re-render armory state
      });
    });
  }

  private async showAuditModal(): Promise<void> {
    await openAuditModal(this.modalCtx());
  }


  private showLeaderboardModal(): void {
    openLeaderboardModal(this.modalCtx());
  }


  public showAdminPortalModal(): void {
    openAdminPortalModal(this.modalCtx());
  }


  private refreshStakeHud(): void {
    const el = document.getElementById('hud-bet-display');
    if (el) el.textContent = `${this.getCurrentBet()} ${this.activeCurrency}`;
  }

  private adjustBet(direction: number): void {
    const newIndex = Math.max(0, Math.min(this.betTiers.length - 1, this.currentBetIndex + direction));
    if (newIndex !== this.currentBetIndex) {
      SoundManager.playUiSound(direction > 0 ? 'chip_up' : 'chip_down');
    }
    this.currentBetIndex = newIndex;
    this.refreshStakeHud();
    this.onBetChangeCallback?.(this.getCurrentBet(), this.activeCurrency);
  }

  private toggleCurrency(): void {
    this.setCurrency(this.activeCurrency === 'SC' ? 'GC' : 'SC');
  }

  private setBetIndex(index: number): void {
    this.currentBetIndex = Math.max(0, Math.min(this.betTiers.length - 1, index));
    SoundManager.playUiSound('chip_up');
    this.refreshStakeHud();
    this.onBetChangeCallback?.(this.getCurrentBet(), this.activeCurrency);
  }

  /** Lobby-only currency switch — resets bet to 1.00 */
  private setCurrency(currency: 'GC' | 'SC'): void {
    const changed = this.activeCurrency !== currency;
    this.activeCurrency = currency;
    if (changed) {
      const defaultIdx = this.betTiers.indexOf(1.0);
      this.currentBetIndex = defaultIdx >= 0 ? defaultIdx : 4;
      SoundManager.playUiSound('currency_toggle');
    }
    this.refreshStakeHud();
    this.onBetChangeCallback?.(this.getCurrentBet(), this.activeCurrency);
  }

  private toggleAutoFire(): void {
    /* hold-to-fire on canvas; no HUD toggle */
  }

  private toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.onThemeChangeCallback?.(this.currentTheme);
  }

  private toggleSound(): void {
    const enabled = SoundManager.toggleSound();
    if (enabled) {
      SoundManager.playUiSound('click');
    }
    this.soundBtn.textContent = enabled ? '🔊 ON' : '🔇 OFF';
    this.soundBtn.style.color = enabled ? '#e2e8f0' : '#ef4444';
  }

  public getCurrentBet(): number {
    return this.betTiers[this.currentBetIndex];
  }

  public setBalances(gc: number, sc: number): void {
    this.gcBalance = Math.max(0, gc);
    this.scBalance = Math.max(0, sc);
    if (this.gcBalanceEl) this.gcBalanceEl.textContent = this.gcBalance.toLocaleString();
    if (this.scBalanceEl) this.scBalanceEl.textContent = this.scBalance.toFixed(2);
  }

  public getCurrency(): 'GC' | 'SC' {
    return this.activeCurrency;
  }

  public deductBet(): boolean {
    const bet = this.getCurrentBet();
    if (this.activeCurrency === 'SC') {
      if (this.scBalance < bet) return false;
      this.scBalance -= bet;
      if (this.scBalanceEl) this.scBalanceEl.textContent = this.scBalance.toFixed(2);
    } else {
      if (this.gcBalance < bet * 100) return false;
      this.gcBalance -= bet * 100;
      this.gcBalanceEl.textContent = this.gcBalance.toLocaleString();
    }
    return true;
  }

  public addBalance(gc: number, sc: number): void {
    this.gcBalance += gc;
    this.scBalance += sc;
    this.gcBalanceEl.textContent = this.gcBalance.toLocaleString();
    this.scBalanceEl.textContent = this.scBalance.toFixed(2);
  }
}
