import { WalletService } from '../network/WalletService';
import { AuthManager } from '../network/AuthManager';
import { FeatureFlags } from '../config/FeatureFlags';
import { SoundManager } from '../audio/SoundManager';
import { GameTheme } from '../engine/systems/ThemeManager';
import { PayoutEngine } from '../engine/systems/PayoutEngine';
import { showStreakModal as openStreakModal } from './modals/streakModal';
import { showLeaderboardModal as openLeaderboardModal } from './modals/leaderboardModal';
import { showAdminPortalModal as openAdminPortalModal } from './modals/adminPortalModal';
import { showProgressionModal } from './modals/progressionModal';
import type { ModalContext } from './modals/ModalContext';
import { showStoreModal } from './modals/storeModal';
import { TableSelectionManager, AVAILABLE_TABLES, TableConfig } from '../network/TableSelectionManager';
import { PlayerProgressionManager, PlayerProgressionState } from '../engine/systems/PlayerProgressionManager';

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
  private tableBadgeBtn: HTMLElement | null = null;
  private progressionUnsub: (() => void) | null = null;
  private tableUnsub: (() => void) | null = null;

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

    // Synchronize initial currency and bet amount with selected table
    const initialTable = TableSelectionManager.getInstance().getActiveTable();
    if (!initialTable.allowedCurrencies.includes(this.activeCurrency)) {
      this.activeCurrency = initialTable.allowedCurrencies[0];
    }
    let initIdx = this.betTiers.findIndex((b) => Math.abs(b - initialTable.minStake) < 0.001);
    if (initIdx === -1) {
      initIdx = this.betTiers.findIndex((b) => b >= initialTable.minStake);
    }
    if (initIdx !== -1) {
      this.currentBetIndex = initIdx;
    }

    this.renderHUD();
    this.createModalContainer(rootElement);
    window.addEventListener('ff-show-streak', () => {
      void this.showStreakModal();
    });
    window.addEventListener('ff-open-store', () => {
      this.openStore();
    });

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

  /** Full-screen arcade title card with Play CTA */
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
      padding: '20px',
      boxSizing: 'border-box',
      background:
        'radial-gradient(ellipse at 50% 20%, rgba(0,80,120,.55), rgba(2,6,14,.98) 70%)',
      color: '#fff',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    });

    this.startScreenEl.innerHTML = `
      <style>
        @keyframes ff-hand-bounce {
          0% { transform: translateY(-6px) scale(0.95); }
          100% { transform: translateY(4px) scale(1.08); }
        }
        @keyframes ff-hand-glow {
          0% { filter: drop-shadow(0 0 4px #00ffcc); }
          100% { filter: drop-shadow(0 0 14px #00ffcc) drop-shadow(0 0 22px #22d3ee); }
        }
        @keyframes ff-arcade-pulse {
          0% { box-shadow: 0 0 12px rgba(0,255,204,.35), 0 4px 0 #0e7490, 0 8px 0 #083344; }
          100% { box-shadow: 0 0 28px rgba(0,255,204,.7), 0 4px 0 #0e7490, 0 8px 0 #083344; }
        }
        #fish-frenzy-start .ff-arcade-card {
          width: min(420px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
          box-sizing: border-box;
          padding: 22px 20px 18px;
          border: 4px solid #22d3ee;
          border-radius: 6px;
          background: linear-gradient(180deg, #0a1628 0%, #061018 100%);
          box-shadow: 0 0 0 2px #083344, 0 12px 40px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.06);
          text-align: center;
        }
        #fish-frenzy-start .ff-bevel {
          border: 3px solid #334155;
          border-top-color: #64748b;
          border-left-color: #475569;
          border-bottom-color: #0f172a;
          border-right-color: #0f172a;
          background: #1e293b;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
        }
        #fish-frenzy-start .ff-play {
          width: 100%;
          padding: 16px 12px;
          border: 3px solid #00ffcc;
          border-radius: 4px;
          background: linear-gradient(180deg, #22d3ee 0%, #0891b2 45%, #0e7490 100%);
          color: #021018;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.12em;
          cursor: pointer;
          text-transform: uppercase;
          animation: ff-arcade-pulse 1.4s ease-in-out infinite alternate;
          position: relative;
        }
        #fish-frenzy-start .ff-play:active { transform: translateY(2px); }
      </style>

      <div class="ff-arcade-card">
        <div style="font-size:10px; letter-spacing:.28em; color:#22d3ee; font-weight:800; margin-bottom:6px;">ARCADE · SWEEPSTAKES</div>
        <div style="font-size:clamp(32px,9vw,48px); line-height:.92; font-weight:900; letter-spacing:.06em; margin-bottom:6px;
          text-shadow:0 0 20px rgba(34,211,238,.45), 0 3px 0 #0c4a6e;">FISH FRENZY</div>
        <div style="font-size:11px; color:#94a3b8; margin-bottom:14px; letter-spacing:.08em;">LOAD WALLET · AIM · HOLD TO FIRE</div>

        <div id="ff-auth-row" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; align-items:center; margin-bottom:12px;">
          <div id="ff-auth-status" class="ff-bevel" style="padding:8px 12px; border-radius:4px; font-size:11px; font-weight:700; color:#e2e8f0; flex:1; min-width:140px;"></div>
          <button id="ff-auth-action" type="button" class="ff-bevel" style="padding:8px 12px; border-radius:4px; font-size:11px; font-weight:800; color:#ecfeff; cursor:pointer; border-color:#22d3ee; background:#0e7490;">SIGN IN</button>
        </div>

        <div style="display:flex; justify-content:center; gap:16px; margin-bottom:12px; font-variant-numeric:tabular-nums;">
          <div style="text-align:center;">
            <div style="font-size:9px; letter-spacing:.14em; color:#64748b;">GC</div>
            <div id="ff-lobby-gc" style="font-size:15px; font-weight:800; color:#fbbf24;">—</div>
          </div>
          <div style="width:1px; background:#334155;"></div>
          <div style="text-align:center;">
            <div style="font-size:9px; letter-spacing:.14em; color:#64748b;">SC</div>
            <div id="ff-lobby-sc" style="font-size:15px; font-weight:800; color:#67e8f9;">—</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
          <button id="ff-deposit" type="button" class="ff-bevel" style="padding:10px; border-radius:4px; font-weight:800; font-size:11px; color:#ecfeff; cursor:pointer; border-color:#22d3ee;">DEPOSIT</button>
          <button id="ff-withdraw" type="button" class="ff-bevel" style="padding:10px; border-radius:4px; font-weight:800; font-size:11px; color:#fce7f3; cursor:pointer; border-color:#f472b6;">WITHDRAW</button>
        </div>
        <div id="ff-wallet-status" style="min-height:16px; margin:0 0 10px; font-size:10px; color:#64748b;"></div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
          <button id="ff-theme-open" type="button" class="ff-bevel" style="padding:10px; border-radius:4px; font-weight:800; font-size:11px; color:#e2e8f0; cursor:pointer;">🎨 THEME</button>
          <div class="ff-bevel" style="padding:10px; border-radius:4px; font-size:10px; color:#94a3b8; display:flex; align-items:center; justify-content:center;">
            Audio in-game ↑
          </div>
        </div>

        <div style="position:relative; margin-bottom:6px;">
          <div id="ff-train-hand" style="
            position:absolute; left:50%; bottom:100%; transform:translateX(-50%);
            font-size:34px; line-height:1; pointer-events:none; z-index:2;
            animation: ff-hand-bounce 0.7s ease-in-out infinite alternate, ff-hand-glow 0.7s ease-in-out infinite alternate;
            margin-bottom:2px;
          ">👇</div>
          <button id="ff-play" type="button" class="ff-play">▶ START GAME</button>
        </div>

        <div style="margin-top:12px; font-size:9px; line-height:1.45; color:#475569;">
          Hold to fire · Stake in Lobby · Server-side wallet
        </div>
      </div>

      <div id="ff-theme-modal" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.72); align-items:center; justify-content:center; padding:20px;">
        <div class="ff-arcade-card" style="width:min(340px,100%); max-height:none;">
          <div style="font-size:12px; letter-spacing:.2em; color:#22d3ee; font-weight:900; margin-bottom:14px;">SELECT THEME</div>
          <div style="display:grid; gap:10px;">
            <button id="ff-theme-light" type="button" class="ff-bevel" style="padding:14px; border-radius:4px; font-weight:900; font-size:13px; color:#ecfeff; cursor:pointer; border-color:#22d3ee; background:#0e7490;">☀ LIGHT</button>
            <button id="ff-theme-dark" type="button" class="ff-bevel" style="padding:14px; border-radius:4px; font-weight:900; font-size:13px; color:#fecaca; cursor:pointer; border-color:#f43f5e; background:#3f0a12;">☾ DARK</button>
            <button id="ff-theme-close" type="button" class="ff-bevel" style="padding:10px; border-radius:4px; font-weight:700; font-size:11px; color:#94a3b8; cursor:pointer;">CLOSE</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.startScreenEl);

    const root = this.startScreenEl;

    const gcEl = root.querySelector<HTMLElement>('#ff-lobby-gc');
    const scEl = root.querySelector<HTMLElement>('#ff-lobby-sc');
    const authEl = root.querySelector<HTMLElement>('#ff-auth-status');
    const authBtn = root.querySelector<HTMLButtonElement>('#ff-auth-action');
    const statusEl = root.querySelector<HTMLElement>('#ff-wallet-status');
    const themeModal = root.querySelector<HTMLElement>('#ff-theme-modal');

    const renderAuth = () => {
      const state = AuthManager.getInstance().getState();
      const signedIn = !!(state.user && !state.isAnonymous);
      if (authEl) {
        authEl.textContent = signedIn
          ? `SIGNED IN · ${state.displayName}`
          : state.displayName
            ? `GUEST · ${state.displayName}`
            : 'GUEST SESSION';
      }
      if (authBtn) {
        authBtn.textContent = signedIn ? 'LOG OUT' : 'SIGN IN / SIGN UP';
        authBtn.style.background = signedIn ? '#1e293b' : '#0e7490';
        authBtn.style.borderColor = signedIn ? '#64748b' : '#22d3ee';
      }
    };

    const renderWallet = () => {
      const b = wallet.getBalances();
      if (gcEl) gcEl.textContent = b.goldCoins.toLocaleString();
      if (scEl) scEl.textContent = b.sweepstakesCoins.toLocaleString();
      renderAuth();
    };

    const unsubscribeWallet = wallet.subscribe(renderWallet);
    (root as any).__walletUnsubscribe = unsubscribeWallet;

    void wallet.connect().then(renderWallet).catch((error) => {
      console.error('[Lobby] wallet connect failed', error);
      if (statusEl) statusEl.textContent = 'Wallet unavailable.';
    });

    AuthManager.getInstance().onChange(() => renderAuth());
    renderAuth();

    authBtn?.addEventListener('click', async () => {
      const auth = AuthManager.getInstance();
      const state = auth.getState();
      try {
        if (state.user && !state.isAnonymous) {
          if (statusEl) statusEl.textContent = 'Signing out…';
          await auth.signOut();
          if (statusEl) statusEl.textContent = 'Signed out.';
        } else {
          if (statusEl) statusEl.textContent = 'Opening Google sign-in…';
          await auth.linkGoogle();
          if (statusEl) statusEl.textContent = 'Signed in.';
        }
        renderAuth();
        renderWallet();
      } catch (e) {
        if (statusEl) statusEl.textContent = e instanceof Error ? e.message : 'Auth failed.';
      }
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
            statusEl.textContent = `Deposit request ${result.requestId.slice(0, 8)}… pending.`;
          }
        } catch (error) {
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
            statusEl.textContent = `Withdrawal ${result.requestId.slice(0, 8)}… pending.`;
          }
          renderWallet();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent =
              error instanceof Error ? error.message : 'Withdrawal request failed.';
          }
        }
      });

    const openTheme = () => {
      if (themeModal) themeModal.style.display = 'flex';
    };
    const closeTheme = () => {
      if (themeModal) themeModal.style.display = 'none';
    };
    root.querySelector('#ff-theme-open')?.addEventListener('click', openTheme);
    root.querySelector('#ff-theme-close')?.addEventListener('click', closeTheme);
    themeModal?.addEventListener('click', (e) => {
      if (e.target === themeModal) closeTheme();
    });
    root.querySelector('#ff-theme-light')?.addEventListener('click', () => {
      this.currentTheme = 'light';
      this.onThemeChangeCallback?.('light');
      SoundManager.setTheme('light');
      closeTheme();
    });
    root.querySelector('#ff-theme-dark')?.addEventListener('click', () => {
      this.currentTheme = 'dark';
      this.onThemeChangeCallback?.('dark');
      SoundManager.setTheme('dark');
      closeTheme();
    });

    const playBtn = root.querySelector<HTMLButtonElement>('#ff-play');
    playBtn?.addEventListener('click', () => {
      SoundManager.playUiSound('click');
      if (this.currentTheme === 'dark') {
        SoundManager.playHorrorWhisper(0.8);
      }
      SoundManager.startBgm();
      setTimeout(() => {
        this.onPlayCallback?.();
      }, 150);
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
    const activeTable = TableSelectionManager.getInstance().getActiveTable();
    this.container.innerHTML = `
      <!-- TOP NAVIGATION BAR -->
      <div id="hud-topbar" style="display: flex; justify-content: space-between; align-items: center; width: 100%; pointer-events: auto; gap: 6px; flex-wrap: wrap;">
        <!-- Wallets & Mode & Player Level -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <div id="hud-gc-wallet" style="display:${this.activeCurrency === 'GC' ? 'flex' : 'none'}; background: rgba(15, 23, 42, 0.88); border: 1px solid #3b82f6; padding: 6px 10px; border-radius: 8px; color: #ffffff; align-items: center; gap: 6px;">
            <span id="hud-gc-balance" style="font-size: 13px; font-weight: 700;">${this.gcBalance.toLocaleString()}<sub style="font-size:9px;color:#60a5fa;margin-left:2px;">GC</sub></span>
          </div>
          <div id="hud-sc-wallet" style="display:${this.activeCurrency === 'SC' ? 'flex' : 'none'}; background: rgba(15, 23, 42, 0.88); border: 2px solid #00ffcc; padding: 6px 10px; border-radius: 8px; color: #ffffff; align-items: center; gap: 6px;">
            <span id="hud-sc-balance" style="font-size: 13px; font-weight: 700; color: #00ffcc;">${this.scBalance.toFixed(2)}<sub style="font-size:9px;color:#00ffcc;margin-left:2px;">SC</sub></span>
          </div>
          ${activeTable.mode === 'tournament' ? `<div id="hud-tourney-shield" title="Tournament" style="background:rgba(15,23,42,0.9);border:1.5px solid #f59e0b;padding:6px 9px;border-radius:8px;font-size:14px;">🛡️</div>` : ''}
          <button id="hud-level-btn" title="Level" style="background: rgba(15, 23, 42, 0.88); border: 1.5px solid #a855f7; padding: 4px 10px; border-radius: 8px; color: #ffffff; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 10px; font-weight: 800; color: #c084fc;">LVL <span id="hud-level-val">1</span></span>
            <div style="width: 40px; height: 3px; background: #334155; border-radius: 2px; overflow: hidden;">
              <div id="hud-level-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #a855f7, #ec4899);"></div>
            </div>
          </button>
          <span id="hud-bet-display" style="display:none;">${this.getCurrentBet()}</span>
          <button id="hud-table-btn" style="display:none;"></button>
        </div>

        <!-- Lobby + essentials only (shop/streak/admin live in Lobby) -->
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <button id="hud-lobby-btn" title="Open Lobby" style="background: linear-gradient(135deg,#0f766e,#155e75); color: #ecfeff; border: 1px solid #22d3ee; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; box-shadow: 0 0 12px rgba(34,211,238,0.25);">
            ⌂ LOBBY
          </button>
          <button id="hud-sound-toggle" title="Audio: cycle On / Mute / SFX / No FX" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 700; min-width: 36px;">
            🔊
          </button>
        </div>
      </div>

      <!-- Boss red wash + corner timer -->
      <div id="hud-boss-overlay" style="display:none; position:absolute; inset:0; z-index:15; pointer-events:none;
        background:rgba(180,0,20,0.18);"></div>
      <div id="hud-boss-timer" style="display:none; position:absolute; top:10px; right:12px; z-index:30; pointer-events:none;
        font-size:18px; font-weight:900; color:#fecaca; text-shadow:0 0 12px #ff0033; font-variant-numeric:tabular-nums;">30</div>

      <!-- Brief FISH FRENZY title (boss start only) -->
      <div id="hud-boss-bash" style="display:none; position:absolute; left:50%; top:16%; transform:translateX(-50%); z-index:25; pointer-events:none; text-align:center;">
        <div id="hud-boss-bash-title" style="font-size:clamp(30px,8vw,56px); font-weight:900; letter-spacing:6px; color:#ff0033;
          text-shadow:0 0 18px #ff0033, 0 0 36px #22d3ee, 0 4px 0 #450a0a;
          animation: bossFrenzyPulse 0.45s ease-in-out infinite alternate;">FISH FRENZY</div>
      </div>
      <style>
        @keyframes bossFrenzyPulse {
          from { transform: scale(1); filter: brightness(1) drop-shadow(0 0 8px #22d3ee); }
          to { transform: scale(1.08); filter: brightness(1.35) drop-shadow(0 0 22px #ff0033); }
        }
      </style>

      <!-- Bet badge near turret (bottom-center, slightly right) -->
      <div id="hud-bet-badge" style="position:absolute; left:58%; bottom:72px; transform:translateX(-50%); z-index:20; pointer-events:none;
        padding:6px 12px; border-radius:999px; font-weight:900; letter-spacing:1px;
        border:2px solid #22d3ee; background:rgba(8,20,36,0.85); color:#67e8f9; font-size:13px;
        box-shadow:0 0 14px rgba(34,211,238,0.35);">×1.00</div>
    `;

    // Reference elements
    this.gcBalanceEl = document.getElementById('hud-gc-balance')!;
    this.scBalanceEl = document.getElementById('hud-sc-balance')!;
    this.betDisplayEl = document.getElementById('hud-bet-display');
    this.soundBtn = document.getElementById('hud-sound-toggle')!;
    this.tableBadgeBtn = document.getElementById('hud-table-btn');

    // Event listeners
    this.applyAudioModeIcon();
    this.refreshStakeHud();
    this.soundBtn.addEventListener('click', () => this.cycleAudioMode());
    document.getElementById('hud-lobby-btn')?.addEventListener('click', () => this.showLobby());
    this.tableBadgeBtn?.addEventListener('click', () => this.showLobby());
    document.getElementById('hud-level-btn')?.addEventListener('click', () => this.showProgressionModal());

    // Subscribe to player progression updates
    if (!this.progressionUnsub) {
      this.progressionUnsub = PlayerProgressionManager.getInstance().subscribe((prog) => {
        this.updateProgressionHud(prog);
      });
    }

    // Subscribe to table changes with full currency & minStake synchronization
    if (!this.tableUnsub) {
      this.tableUnsub = TableSelectionManager.getInstance().onTableChange((tbl) => {
        const lbl = document.getElementById('hud-table-btn-label');
        if (lbl) lbl.textContent = tbl.badge;
        if (this.tableBadgeBtn) {
          this.tableBadgeBtn.style.borderColor = tbl.badgeColor;
          this.tableBadgeBtn.style.color = tbl.badgeColor;
        }

        // Adjust currency to table-allowed currency if necessary
        if (!tbl.allowedCurrencies.includes(this.activeCurrency)) {
          this.activeCurrency = tbl.allowedCurrencies[0];
        }

        // Adjust bet amount to table minStake
        let targetIdx = this.betTiers.findIndex((b) => Math.abs(b - tbl.minStake) < 0.001);
        if (targetIdx === -1) {
          targetIdx = this.betTiers.findIndex((b) => b >= tbl.minStake);
        }
        if (targetIdx === -1) targetIdx = 0;
        this.currentBetIndex = targetIdx;

        this.refreshStakeHud();
        this.onBetChangeCallback?.(this.getCurrentBet(), this.activeCurrency);
      });
    }

    // Operator shortcut still opens Admin from Lobby tools
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        this.showAdminPortalModal();
      }
    });
  }

  private updateProgressionHud(prog: PlayerProgressionState): void {
    const lvlVal = document.getElementById('hud-level-val');
    const lvlName = document.getElementById('hud-level-name');
    const lvlBar = document.getElementById('hud-level-bar');
    const ocBadge = document.getElementById('hud-overcharge-badge');
    const ocText = document.getElementById('hud-overcharge-text');

    if (lvlVal) lvlVal.textContent = prog.level.toString();
    if (lvlName) lvlName.textContent = prog.title.split(' ')[0].toUpperCase();
    if (lvlBar) lvlBar.style.width = `${prog.progressPct}%`;

    // Overdrive/overcharge banners removed — boss uses red overlay only
    void ocBadge; void ocText;
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


  /** Full-screen lobby: shop, streak, ranks, operator tools — off the combat HUD. */
  public showLobby(): void {
    SoundManager.playUiSound('modal_open');
    const tables = TableSelectionManager.getInstance().getTables();
    this.modalContainer.innerHTML = `
      <div style="background:#0a1628; border:4px solid #22d3ee; border-radius:6px; padding:18px; max-width:420px; width:100%; max-height:90vh; overflow-y:auto; color:#fff; font-family:ui-monospace,monospace; box-shadow:0 0 0 2px #083344, 0 16px 40px rgba(0,0,0,.7);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-size:10px; letter-spacing:2px; color:#22d3ee;">FISH FRENZY</div>
            <div style="font-size:20px; font-weight:900;">LOBBY</div>
          </div>
          <button id="lobby-close-btn" style="background:#1e293b;border:2px solid #475569;color:#94a3b8;width:36px;height:36px;border-radius:4px;cursor:pointer;font-size:16px;">✕</button>
        </div>

        <div style="margin-bottom:14px;padding:12px;background:#0f172a;border:3px solid #334155;border-radius:4px;">
          <div style="font-size:10px;letter-spacing:2px;color:#64748b;font-weight:700;margin-bottom:8px;">CURRENCY</div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button type="button" id="lobby-cur-sc" style="flex:1;padding:10px;border-radius:4px;cursor:pointer;font-weight:900;font-size:12px;border:3px solid ${this.activeCurrency==='SC'?'#00ffcc':'#334155'};background:${this.activeCurrency==='SC'?'rgba(0,255,204,0.15)':'#1e293b'};color:${this.activeCurrency==='SC'?'#00ffcc':'#94a3b8'};">SC</button>
            <button type="button" id="lobby-cur-gc" style="flex:1;padding:10px;border-radius:4px;cursor:pointer;font-weight:900;font-size:12px;border:3px solid ${this.activeCurrency==='GC'?'#fbbf24':'#334155'};background:${this.activeCurrency==='GC'?'rgba(251,191,36,0.15)':'#1e293b'};color:${this.activeCurrency==='GC'?'#fbbf24':'#94a3b8'};">GC</button>
          </div>
          <div style="font-size:10px;letter-spacing:2px;color:#64748b;font-weight:700;margin-bottom:8px;">BET · JOINS MATCHING ROOM</div>
          <div id="lobby-bet-chips" style="display:flex;flex-wrap:wrap;gap:6px;">
            ${this.betTiers.map((b, i) => `
              <button type="button" class="lobby-bet-chip" data-bet-index="${i}" style="
                padding:10px 12px;border-radius:4px;cursor:pointer;font-weight:900;font-size:12px;
                border:3px solid ${i===this.currentBetIndex?'#00ffcc':'#334155'};
                background:${i===this.currentBetIndex?'rgba(0,255,204,0.2)':'#1e293b'};
                color:${i===this.currentBetIndex?'#00ffcc':'#e2e8f0'};
              ">${b}</button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom:14px;padding:12px;background:#0f172a;border:3px solid #334155;border-radius:4px;">
          <div style="font-size:10px;letter-spacing:2px;color:#22d3ee;font-weight:700;margin-bottom:8px;">THEME</div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="lobby-theme-light" style="flex:1;padding:10px;border-radius:4px;cursor:pointer;font-weight:900;font-size:12px;border:3px solid ${this.currentTheme==='light'?'#22d3ee':'#334155'};background:${this.currentTheme==='light'?'#0e7490':'#1e293b'};color:#ecfeff;">☀ LIGHT</button>
            <button type="button" id="lobby-theme-dark" style="flex:1;padding:10px;border-radius:4px;cursor:pointer;font-weight:900;font-size:12px;border:3px solid ${this.currentTheme==='dark'?'#f43f5e':'#334155'};background:${this.currentTheme==='dark'?'#3f0a12':'#1e293b'};color:#fecaca;">☾ DARK</button>
          </div>
        </div>

        <button class="lobby-tile" data-lobby="store" style="width:100%;text-align:left;background:#1e293b;border:3px solid #22d3ee;border-radius:4px;padding:12px;cursor:pointer;color:#fff;margin-bottom:8px;">
          <div style="font-weight:900;color:#67e8f9;">STORE</div>
          <div style="font-size:11px;color:#94a3b8;">Buy GC packages</div>
        </button>
        <button class="lobby-tile" data-lobby="operator" style="width:100%;text-align:left;background:rgba(245,158,11,0.12);border:3px solid #f59e0b;border-radius:4px;padding:12px;cursor:pointer;color:#fff;margin-bottom:12px;">
          <div style="font-weight:900;color:#fbbf24;">OPERATOR</div>
          <div style="font-size:11px;color:#94a3b8;">Packages & P&amp;L</div>
        </button>

        <button id="lobby-resume-btn" style="width:100%; background:linear-gradient(180deg,#22d3ee,#0e7490); color:#021018; border:3px solid #00ffcc; padding:14px; border-radius:4px; font-weight:900; letter-spacing:2px; cursor:pointer; font-size:14px;">
          ▶ RESUME
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
    document.getElementById('lobby-theme-light')?.addEventListener('click', () => {
      this.currentTheme = 'light';
      this.onThemeChangeCallback?.('light');
      SoundManager.setTheme('light');
      this.showLobby();
    });
    document.getElementById('lobby-theme-dark')?.addEventListener('click', () => {
      this.currentTheme = 'dark';
      this.onThemeChangeCallback?.('dark');
      SoundManager.setTheme('dark');
      this.showLobby();
    });
    this.modalContainer.querySelectorAll('.lobby-bet-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).getAttribute('data-bet-index') || '0', 10);
        this.setBetIndex(idx);
        // Auto-pick a table that matches stake currency / min stake
        const bet = this.getCurrentBet();
        const match = tables.find((t) => Math.abs(t.minStake - bet) < 0.001)
          || tables.find((t) => t.minStake <= bet)
          || tables[0];
        if (match) {
          void TableSelectionManager.getInstance().switchTable(match.id);
        }
        this.renderHUD();
        this.closeModal();
        if (match?.mode === 'tournament') {
          this.showLeaderboardModal();
        }
      });
    });
    this.modalContainer.querySelectorAll('.lobby-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-lobby');
        this.closeModal();
        if (id === 'store') void showStoreModal(this.modalCtx());
        else if (id === 'operator') this.showAdminPortalModal();
      });
    });
  }

  private async showStreakModal(): Promise<void> {
    await openStreakModal(this.modalCtx());
  }


  private showLeaderboardModal(): void {
    if (!this.isTournamentSession()) {
      SoundManager.playUiSound('modal_close');
      return;
    }
    openLeaderboardModal(this.modalCtx());
  }


  public showAdminPortalModal(): void {
    openAdminPortalModal(this.modalCtx());
  }


  private refreshStakeHud(): void {
    const el = document.getElementById('hud-bet-display');
    const bet = this.getCurrentBet();
    if (el) el.textContent = `${bet} ${this.activeCurrency}`;
    const badge = document.getElementById('hud-bet-badge');
    if (badge) {
      const scale = 0.85 + Math.min(0.55, Math.log10(bet * 20 + 1) * 0.35);
      const colors: Array<[number, string, string]> = [
        [0.25, '#67e8f9', '#0e7490'],
        [1, '#22d3ee', '#155e75'],
        [2.5, '#fbbf24', '#92400e'],
        [5, '#f97316', '#7c2d12'],
        [10, '#f43f5e', '#881337'],
      ];
      let fg = '#67e8f9';
      let border = '#0e7490';
      for (const [t, f, b] of colors) {
        if (bet >= t) {
          fg = f;
          border = b;
        }
      }
      badge.textContent = `×${bet.toFixed(2)}`;
      badge.style.transform = `translateX(-50%) scale(${scale})`;
      badge.style.color = fg;
      badge.style.borderColor = border;
      badge.style.boxShadow = `0 0 ${10 + bet * 2}px ${fg}55`;
    }
    const gcW = document.getElementById('hud-gc-wallet');
    const scW = document.getElementById('hud-sc-wallet');
    if (gcW) gcW.style.display = this.activeCurrency === 'GC' ? 'flex' : 'none';
    if (scW) scW.style.display = this.activeCurrency === 'SC' ? 'flex' : 'none';
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

  /** 0=all on 🔊 · 1=mute 🔇 · 2=sfx only 📢 · 3=no fx (bgm only) 🎵 */
  private audioMode: number = (() => {
    try {
      const v = parseInt(localStorage.getItem('fish_frenzy_audio_mode') || '0', 10);
      return Number.isFinite(v) ? ((v % 4) + 4) % 4 : 0;
    } catch {
      return 0;
    }
  })();

  private loadAudioMode(): number {
    try {
      const v = parseInt(localStorage.getItem('fish_frenzy_audio_mode') || '0', 10);
      return Number.isFinite(v) ? ((v % 4) + 4) % 4 : 0;
    } catch {
      return 0;
    }
  }

  private applyAudioMode(mode: number): void {
    this.audioMode = ((mode % 4) + 4) % 4;
    try {
      localStorage.setItem('fish_frenzy_audio_mode', String(this.audioMode));
    } catch { /* ignore */ }
    // Force underlying flags without relying on toggle side-effects
    const wantSfx = this.audioMode === 0 || this.audioMode === 2;
    const wantBgm = this.audioMode === 0 || this.audioMode === 3;
    if (SoundManager.isSoundEnabled() !== wantSfx) SoundManager.toggleSound();
    if (SoundManager.isBgmEnabled() !== wantBgm) SoundManager.toggleBgm(wantBgm);
    if (wantBgm && wantSfx) SoundManager.startBgm();
    this.applyAudioModeIcon();
  }

  private applyAudioModeIcon(): void {
    if (!this.soundBtn) return;
    const icons = ['🔊', '🔇', '📢', '🎵'];
    const labels = ['All on', 'Muted', 'SFX only', 'No FX (music)'];
    this.soundBtn.textContent = icons[this.audioMode] || '🔊';
    this.soundBtn.title = `Audio: ${labels[this.audioMode]} — tap to cycle`;
    this.soundBtn.style.color =
      this.audioMode === 1 ? '#ef4444' : this.audioMode === 2 ? '#38bdf8' : this.audioMode === 3 ? '#00ffcc' : '#e2e8f0';
  }

  private cycleAudioMode(): void {
    if (this.audioMode === undefined || this.audioMode === null) {
      this.audioMode = this.loadAudioMode();
    }
    this.applyAudioMode(this.audioMode + 1);
    if (this.audioMode !== 1) {
      SoundManager.playUiSound('click');
    }
  }

  private toggleSound(): void {
    this.cycleAudioMode();
  }

  private toggleBgm(): void {
    this.cycleAudioMode();
  }

  /** @deprecated use showBossFrenzyTitle / setBossOverlay */
  public setBossBashActive(active: boolean, _sub?: string): void {
    if (active) this.showBossFrenzyTitle();
    else this.setBossOverlay(false);
  }

  /** Brief pulsing FISH FRENZY title at boss start. */
  public showBossFrenzyTitle(): void {
    const el = document.getElementById('hud-boss-bash');
    if (!el) return;
    el.style.display = 'block';
    // Spawn lightweight CSS “electric” flashes via title animation only
    window.setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 2200);
  }

  public setBossOverlay(active: boolean, secondsLeft?: number): void {
    const overlay = document.getElementById('hud-boss-overlay');
    const timer = document.getElementById('hud-boss-timer');
    if (overlay) overlay.style.display = active ? 'block' : 'none';
    if (timer) {
      timer.style.display = active ? 'block' : 'none';
      if (active && typeof secondsLeft === 'number') {
        timer.textContent = String(Math.max(0, secondsLeft));
      }
    }
  }

  /** Barrel count from level / temporary upgrade (1–3). Multiplies stake & payout. */
  public getBarrelCount(): number {
    try {
      const prog = PlayerProgressionManager.getInstance().getState();
      if (prog.isBossUpgradeActive || prog.isOvercharged) return 3;
      if (prog.level >= 10) return 3;
      if (prog.level >= 5) return 2;
    } catch { /* ignore */ }
    return 1;
  }

  public openStore(): void {
    void showStoreModal(this.modalCtx());
  }

  public isTournamentSession(): boolean {
    try {
      return TableSelectionManager.getInstance().getActiveTable().mode === 'tournament';
    } catch {
      return false;
    }
  }

  public getCurrentBet(): number {
    return this.betTiers[this.currentBetIndex];
  }

  public setBalances(gc: number, sc: number): void {
    this.gcBalance = Math.max(0, gc);
    this.scBalance = Math.max(0, sc);
    if (this.gcBalanceEl) {
      this.gcBalanceEl.innerHTML = `${this.gcBalance.toLocaleString()}<sub style="font-size:9px;color:#60a5fa;margin-left:2px;">GC</sub>`;
    }
    if (this.scBalanceEl) {
      this.scBalanceEl.innerHTML = `${this.scBalance.toFixed(2)}<sub style="font-size:9px;color:#00ffcc;margin-left:2px;">SC</sub>`;
    }
  }

  public getCurrency(): 'GC' | 'SC' {
    return this.activeCurrency;
  }

  public deductBet(): boolean {
    const barrels = this.getBarrelCount();
    const bet = this.getCurrentBet() * barrels;
    if (this.activeCurrency === 'SC') {
      if (this.scBalance < bet) {
        this.openStore();
        return false;
      }
      this.scBalance -= bet;
      if (this.scBalanceEl) this.scBalanceEl.innerHTML = `${this.scBalance.toFixed(2)}<sub style="font-size:9px;color:#00ffcc;margin-left:2px;">SC</sub>`;
    } else {
      if (this.gcBalance < bet * 100) {
        this.openStore();
        return false;
      }
      this.gcBalance -= bet * 100;
      if (this.gcBalanceEl) {
        this.gcBalanceEl.innerHTML = `${this.gcBalance.toLocaleString()}<sub style="font-size:9px;color:#60a5fa;margin-left:2px;">GC</sub>`;
      }
    }
    return true;
  }

  public addBalance(gc: number, sc: number): void {
    this.gcBalance += gc;
    this.scBalance += sc;
    this.gcBalanceEl.innerHTML = `${this.gcBalance.toLocaleString()}<sub style="font-size:9px;color:#60a5fa;margin-left:2px;">GC</sub>`;
    this.scBalanceEl.innerHTML = `${this.scBalance.toFixed(2)}<sub style="font-size:9px;color:#00ffcc;margin-left:2px;">SC</sub>`;
  }
}
