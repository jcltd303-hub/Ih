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
        '#02060e',
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
          0% { filter: drop-shadow(0 0 4px #fde047); }
          100% { filter: drop-shadow(0 0 14px #facc15) drop-shadow(0 0 22px #38bdf8); }
        }
        @keyframes ff-play-glow {
          0% { box-shadow: 0 6px 0 #a16207, 0 0 16px rgba(250,204,21,.45); }
          100% { box-shadow: 0 6px 0 #a16207, 0 0 32px rgba(250,204,21,.85), 0 0 48px rgba(56,189,248,.35); }
        }
        #fish-frenzy-start .ff-arcade-card {
          width: min(400px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
          box-sizing: border-box;
          padding: 20px 16px 16px;
          border-radius: 0;
          background:
            #082f49;
          box-shadow:
            0 0 0 5px #fbbf24,
            0 0 0 10px #0ea5e9,
            0 18px 48px rgba(0,0,0,.7);
          text-align: center;
          font-family: system-ui, -apple-system, sans-serif;
        }
        #fish-frenzy-start .ff-btn {
          border: none;
          border-radius: 0;
          cursor: pointer;
          font-weight: 900;
          letter-spacing: 0.04em;
          font-family: system-ui, sans-serif;
          box-shadow: 0 5px 0 rgba(0,0,0,.35);
          transition: transform .08s ease, filter .12s ease;
        }
        #fish-frenzy-start .ff-btn:active {
          transform: translateY(3px);
          box-shadow: 0 2px 0 rgba(0,0,0,.35);
          filter: brightness(.96);
        }
        #fish-frenzy-start .ff-btn-cyan {
          background: #0ea5e9;
          color: #0c4a6e;
          text-shadow: 0 1px 0 rgba(255,255,255,.35);
        }
        #fish-frenzy-start .ff-btn-pink {
          background: #ec4899;
          color: #831843;
          text-shadow: 0 1px 0 rgba(255,255,255,.3);
        }
        #fish-frenzy-start .ff-btn-green {
          background: #10b981;
          color: #064e3b;
        }
        #fish-frenzy-start .ff-btn-slate {
          background: #475569;
          color: #f8fafc;
        }
        #fish-frenzy-start .ff-btn-purple {
          background: #8b5cf6;
          color: #2e1065;
        }
        #fish-frenzy-start .ff-play {
          width: 100%;
          padding: 18px 14px;
          border: none;
          border-radius: 0;
          background: #facc15;
          color: #713f12;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.14em;
          cursor: pointer;
          text-transform: uppercase;
          font-family: system-ui, sans-serif;
          animation: ff-play-glow 1.2s ease-in-out infinite alternate;
          position: relative;
        }
        #fish-frenzy-start .ff-play:active {
          transform: translateY(4px);
          box-shadow: 0 2px 0 #a16207, 0 0 16px rgba(250,204,21,.5) !important;
        }
        #fish-frenzy-start .ff-title {
          font-size: clamp(36px, 10vw, 52px);
          line-height: 0.95;
          font-weight: 900;
          letter-spacing: 0.02em;
          margin-bottom: 4px;
          background: #22d3ee;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter: drop-shadow(0 3px 0 #0c4a6e);
        }
      </style>

      <div class="ff-arcade-card">
        <div style="font-size:11px; letter-spacing:.22em; color:#7dd3fc; font-weight:800; margin-bottom:4px;">SWEEPSTAKES CASINO</div>
        <div class="ff-title">FISH FRENZY</div>
        <div style="font-size:12px; color:#bae6fd; margin-bottom:16px; font-weight:700;">Aim · Hold to fire · Win big</div>

        <div id="ff-auth-row" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; align-items:center; margin-bottom:14px;">
          <div id="ff-auth-status" style="padding:10px 14px; border-radius:14px; font-size:12px; font-weight:800; color:#e0f2fe; flex:1; min-width:140px; background:rgba(0,0,0,.28);"></div>
          <button id="ff-auth-action" type="button" class="ff-btn ff-btn-cyan" style="padding:12px 16px; font-size:12px;">SIGN IN</button>
        </div>

        <div style="display:flex; justify-content:center; gap:28px; margin-bottom:14px; font-variant-numeric:tabular-nums;">
          <div style="text-align:center;">
            <div style="font-size:10px; letter-spacing:.12em; color:#fde68a; font-weight:800;">GC</div>
            <div id="ff-lobby-gc" style="font-size:20px; font-weight:900; color:#fbbf24; text-shadow:0 2px 0 #78350f;">—</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px; letter-spacing:.12em; color:#a5f3fc; font-weight:800;">SC</div>
            <div id="ff-lobby-sc" style="font-size:20px; font-weight:900; color:#22d3ee; text-shadow:0 2px 0 #0e7490;">—</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
          <button id="ff-deposit" type="button" class="ff-btn ff-btn-green" style="padding:14px 10px; font-size:13px;">DEPOSIT</button>
          <button id="ff-withdraw" type="button" class="ff-btn ff-btn-pink" style="padding:14px 10px; font-size:13px;">WITHDRAW</button>
        </div>
        <div id="ff-wallet-status" style="min-height:16px; margin:0 0 12px; font-size:11px; color:#94a3b8;"></div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
          <button id="ff-theme-open" type="button" class="ff-btn ff-btn-purple" style="padding:14px 10px; font-size:13px;">🎨 THEME</button>
          <div style="padding:14px 10px; border-radius:16px; font-size:11px; color:#bae6fd; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.25); font-weight:700;">
            Audio in-game ↑
          </div>
        </div>

        <div style="position:relative; margin-bottom:6px;">
          <div id="ff-train-hand" style="
            position:absolute; left:50%; bottom:100%; transform:translateX(-50%);
            font-size:36px; line-height:1; pointer-events:none; z-index:2;
            animation: ff-hand-bounce 0.7s ease-in-out infinite alternate, ff-hand-glow 0.7s ease-in-out infinite alternate;
            margin-bottom:4px;
          ">👇</div>
          <button id="ff-play" type="button" class="ff-play">▶ PLAY</button>
        </div>

        <div style="margin-top:12px; font-size:10px; line-height:1.45; color:#64748b; font-weight:600;">
          Hold to fire · Stake in Lobby
        </div>
      </div>

      <div id="ff-theme-modal" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.75); align-items:center; justify-content:center; padding:20px;">
        <div class="ff-arcade-card" style="width:min(320px,100%); max-height:none;">
          <div style="font-size:14px; letter-spacing:.16em; color:#fde68a; font-weight:900; margin-bottom:16px;">SELECT THEME</div>
          <div style="display:grid; gap:12px;">
            <button id="ff-theme-light" type="button" class="ff-btn ff-btn-cyan" style="padding:16px; font-size:15px;">☀ LIGHT</button>
            <button id="ff-theme-dark" type="button" class="ff-btn ff-btn-pink" style="padding:16px; font-size:15px;">☾ DARK</button>
            <button id="ff-theme-close" type="button" class="ff-btn ff-btn-slate" style="padding:12px; font-size:12px;">CLOSE</button>
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
        authBtn.className = signedIn ? 'ff-btn ff-btn-slate' : 'ff-btn ff-btn-cyan';
        authBtn.style.padding = '12px 16px';
        authBtn.style.fontSize = '12px';
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
      <!-- TOP NAV — flat, no boxed chrome -->
      <div id="hud-topbar" style="
  display:flex; justify-content:space-between; align-items:center;
  width:100%; pointer-events:auto; gap:8px; flex-wrap:wrap;
  padding:5px 7px;
  background:rgba(3,7,12,.88);
  border:2px solid rgba(148,163,184,.55);
  border-bottom:3px solid #020617;
  box-shadow:0 3px 0 #020617, inset 0 1px 0 rgba(255,255,255,.08);
  font-family:monospace;
  letter-spacing:.5px;
">
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <div id="hud-gc-wallet" style="display:${this.activeCurrency === 'GC' ? 'flex' : 'none'}; align-items:baseline; gap:3px; background:rgba(15,23,42,.72); border:1px solid rgba(148,163,184,.35);
padding:3px 7px; box-shadow:inset 0 -2px 0 rgba(0,0,0,.45);">
            <span id="hud-gc-balance" style="font-size:16px; font-weight:900; color:#fbbf24; text-shadow:0 1px 3px rgba(0,0,0,.85);">${this.gcBalance.toLocaleString()}<sub style="font-size:10px;color:#fcd34d;margin-left:2px;font-weight:800;">GC</sub></span>
          </div>
          <div id="hud-sc-wallet" style="display:${this.activeCurrency === 'SC' ? 'flex' : 'none'}; align-items:baseline; gap:3px; background:rgba(15,23,42,.72); border:1px solid rgba(148,163,184,.35);
padding:3px 7px; box-shadow:inset 0 -2px 0 rgba(0,0,0,.45);">
            <span id="hud-sc-balance" style="font-size:16px; font-weight:900; color:#5eead4; text-shadow:0 1px 3px rgba(0,0,0,.85);">${this.scBalance.toFixed(2)}<sub style="font-size:10px;color:#99f6e4;margin-left:2px;font-weight:800;">SC</sub></span>
          </div>
          ${activeTable.mode === 'tournament' ? `<span id="hud-tourney-shield" title="Tournament" style="font-size:18px; filter:drop-shadow(0 1px 2px rgba(0,0,0,.8)); line-height:1;">🛡️</span>` : ''}
          <button id="hud-level-btn" title="Level" style="
  background:#111827; border:2px solid #64748b; padding:3px 7px;
  cursor:pointer; display:flex; align-items:center; gap:6px;
  color:#f8fafc; box-shadow:0 2px 0 #020617;
">
  <span style="font-size:12px; font-weight:900; color:#f8fafc;">LV <span id="hud-level-val">1</span></span>
  <div style="width:44px; height:7px; background:#020617; border:1px solid #475569; overflow:hidden;">
    <div id="hud-level-bar" style="width:0%; height:100%; background:#22d3ee;"></div>
  </div>
</button>
          <span id="hud-bet-display" style="display:none;">${this.getCurrentBet()}</span>
          <button id="hud-table-btn" style="display:none;"></button>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button id="hud-lobby-btn" title="Lobby" style="background:none; border:none; padding:0; cursor:pointer; font-size:22px; line-height:1; filter:drop-shadow(0 1px 3px rgba(0,0,0,.8));">⌂</button>
          <button id="hud-sound-toggle" title="Audio: cycle On / Mute / SFX / No FX" style="background:none; border:none; padding:0; cursor:pointer; font-size:20px; line-height:1; filter:drop-shadow(0 1px 3px rgba(0,0,0,.8)); min-width:auto;">🔊</button>
        </div>
      </div>

      <!-- Boss combat HUD -->
      <div id="hud-boss-overlay" style="display:none; position:absolute; inset:0; z-index:15; pointer-events:none;
        background:rgba(180,0,20,0.10);"></div>

      <div id="hud-boss-combat" style="display:none; position:absolute; left:50%; top:8px;
        transform:translateX(-50%); width:min(680px,calc(100% - 28px)); z-index:31;
        pointer-events:none; font-family:monospace;">

        <div style="display:flex; align-items:center; justify-content:space-between;
          padding:4px 8px; background:#09090b; border:2px solid #ef4444;
          border-bottom:none; text-transform:uppercase; letter-spacing:2px;">
          <span style="font-size:11px; font-weight:900; color:#f87171;">BOSS</span>
          <span id="hud-boss-name" style="font-size:13px; font-weight:900; letter-spacing:1.5px; color:#f8fafc; font-family:monospace;">ABYSSAL BOSS</span>
          <span id="hud-boss-phase" style="font-size:10px; font-weight:900; letter-spacing:1px; color:#fbbf24; font-family:monospace;">ENGAGED</span>
        </div>

        <div style="height:18px; padding:2px; background:#020617; border:2px solid #f8fafc;
          box-sizing:border-box;">
          <div id="hud-boss-hp-segments" style="display:flex; gap:2px; height:100%;"></div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;
          padding:3px 6px; background:#111827; border:2px solid #374151; border-top:none;
          font-size:10px; font-weight:900; letter-spacing:1px;">
          <span id="hud-boss-damage">DMG 0</span>
          <span id="hud-boss-timer">30</span>
          <span id="hud-boss-hp-text">HP 100%</span>
        </div>
      </div>

      <!-- Brief FISH FRENZY title (boss start only) -->
      <div id="hud-boss-bash" style="display:none; position:absolute; left:50%; top:16%; transform:translateX(-50%); z-index:25; pointer-events:none; text-align:center;">
        <div id="hud-boss-bash-title" style="font-size:clamp(30px,8vw,56px); font-weight:900; letter-spacing:6px; color:#ff0033;
          text-shadow:0 0 18px #ff0033, 0 0 36px #22d3ee, 0 4px 0 #450a0a;
          animation: bossFrenzyPulse 0.45s ease-in-out infinite alternate;">FISH FRENZY</div>
      </div>
      <style>
        @keyframes bossFrenzyPulse {
          from { opacity: .92; }
          to { opacity: 1; }
        }
      </style>

      <!-- Bet badge near turret (bottom-center, slightly right) -->
      <div id="hud-bet-badge" style="position:absolute; left:58%; bottom:72px; transform:translateX(-50%); z-index:20; pointer-events:none;
        padding:3px 8px; border:2px solid rgba(248,250,252,.55); font-weight:900; letter-spacing:1px; font-family:monospace; background:rgba(2,6,23,.88);
        border:none; background:rgba(0,0,0,0.45); color:#67e8f9; font-size:13px;
        text-shadow:0 0 8px rgba(34,211,238,0.8);">×1.00</div>
      <div id="hud-barrel-badge" style="position:absolute; left:42%; bottom:72px; transform:translateX(-50%); z-index:20; pointer-events:none;
        padding:3px 7px; border:2px solid #fbbf24; font-weight:900; font-size:12px; color:#fbbf24; font-family:monospace; background:rgba(2,6,23,.88);
        text-shadow:0 0 8px rgba(251,191,36,.7); background:rgba(0,0,0,.4);">1×</div>
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
    document.getElementById('hud-level-btn')?.addEventListener('click', () => showProgressionModal(this.modalCtx()));

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

    const panel = (active: boolean, accent: string) =>
      active
        ? `background:#111827;color:#f8fafc;border:2px solid ${accent};box-shadow:2px 2px 0 #020617,inset 0 0 0 1px ${accent}55;`
        : `background:#0f172a;color:#94a3b8;border:2px solid #475569;box-shadow:2px 2px 0 #020617;`;

    this.modalContainer.innerHTML = `
      <style>
        .ff-arc-btn {
          border:2px solid #64748b;
          border-radius:0;
          cursor:pointer;
          font-weight:900;
          letter-spacing:.06em;
          font-family:monospace;
          transition:transform .06s ease, filter .08s ease;
        }

        .ff-arc-btn:hover {
          filter:brightness(1.12);
        }

        .ff-arc-btn:active {
          transform:translate(2px,2px) !important;
          filter:brightness(.92);
        }

        .ff-arc-chip {
          border:2px solid #475569;
          border-radius:0;
          cursor:pointer;
          font-weight:900;
          font-family:monospace;
          font-size:13px;
          padding:9px 12px;
          min-width:52px;
          box-shadow:2px 2px 0 #020617;
        }

        .ff-arc-chip:active {
          transform:translate(2px,2px);
          box-shadow:none;
        }

        .ff-cabinet {
          position:relative;
          width:min(430px,100%);
          max-height:90vh;
          overflow:auto;
          box-sizing:border-box;
          padding:0;
          border:3px solid #94a3b8;
          background:#080d16;
          box-shadow:
            5px 5px 0 #020617,
            inset 0 0 0 2px #1e293b;
          color:#fff;
          font-family:monospace;
          text-align:center;
        }

        .ff-cabinet::before {
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          opacity:.09;
          background:repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent 3px,
            #fff 4px
          );
          z-index:5;
        }

        .ff-cabinet-content {
          position:relative;
          z-index:6;
          padding:0 14px 14px;
        }

        .ff-title-strip {
          display:flex;
          justify-content:space-between;
          align-items:center;
          min-height:58px;
          padding:0 10px;
          margin-bottom:14px;
          box-sizing:border-box;
          background:#111827;
          border-bottom:3px solid #22d3ee;
          box-shadow:inset 0 -1px 0 #020617;
          text-align:left;
        }

        .ff-section-label {
          font-size:11px;
          letter-spacing:.15em;
          color:#94a3b8;
          font-weight:900;
          margin-bottom:7px;
        }
      </style>

      <div class="ff-cabinet">
        <div class="ff-title-strip">
          <div>
            <div style="font-size:10px;letter-spacing:.22em;color:#22d3ee;font-weight:900;">FISH FRENZY // SYSTEM</div>
            <div style="font-size:21px;letter-spacing:.08em;color:#f8fafc;font-weight:900;">LOBBY</div>
          </div>

          <button id="lobby-close-btn" class="ff-arc-btn" style="
            width:34px;height:34px;
            background:#1e293b;color:#f8fafc;
            font-size:16px;border-color:#64748b;
          ">✕</button>
        </div>

        <div class="ff-cabinet-content">
          <div style="margin-bottom:14px;">
            <div class="ff-section-label">CURRENCY</div>
            <div style="display:flex;gap:8px;">
              <button type="button" id="lobby-cur-sc" class="ff-arc-btn" style="flex:1;padding:10px;${panel(this.activeCurrency === 'SC', '#2dd4bf')}">SC</button>
              <button type="button" id="lobby-cur-gc" class="ff-arc-btn" style="flex:1;padding:10px;${panel(this.activeCurrency === 'GC', '#fbbf24')}">GC</button>
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <div class="ff-section-label">BET // TAP TO PLAY</div>
            <div id="lobby-bet-chips" style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center;">
              ${this.betTiers.map((b, i) => {
                const on = i === this.currentBetIndex;
                return `<button type="button" class="lobby-bet-chip ff-arc-chip" data-bet-index="${i}" style="
                  ${on
                    ? 'background:#facc15;color:#422006;border-color:#fde047;box-shadow:2px 2px 0 #92400e;'
                    : 'background:#1e293b;color:#e2e8f0;'}
                ">${b}</button>`;
              }).join('')}
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <div class="ff-section-label">THEME</div>
            <div style="display:flex;gap:8px;">
              <button type="button" id="lobby-theme-light" class="ff-arc-btn" style="flex:1;padding:10px;${panel(this.currentTheme === 'light', '#38bdf8')}">☀ LIGHT</button>
              <button type="button" id="lobby-theme-dark" class="ff-arc-btn" style="flex:1;padding:10px;${panel(this.currentTheme === 'dark', '#fb7185')}">☾ DARK</button>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="lobby-tile ff-arc-btn" data-lobby="store" style="
              flex:1;padding:12px 10px;
              background:#064e3b;color:#a7f3d0;border-color:#10b981;
              box-shadow:2px 2px 0 #020617;
            ">STORE</button>

            <button class="lobby-tile ff-arc-btn" data-lobby="operator" style="
              flex:1;padding:12px 10px;
              background:#78350f;color:#fde68a;border-color:#f59e0b;
              box-shadow:2px 2px 0 #020617;
            ">OPS</button>
          </div>

          <button id="lobby-resume-btn" class="ff-arc-btn" style="
            width:100%;
            padding:13px;
            font-size:17px;
            letter-spacing:.12em;
            background:#facc15;
            color:#422006;
            border-color:#fde047;
            box-shadow:3px 3px 0 #92400e;
          ">▶ PLAY</button>
        </div>
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
        const bet = this.getCurrentBet();
        const cur = this.activeCurrency;
        // Prefer rooms that allow the selected currency, then match stake
        const match =
          tables.find((t) => t.allowedCurrencies.includes(cur) && Math.abs(t.minStake - bet) < 0.001) ||
          tables.find((t) => t.allowedCurrencies.includes(cur) && t.minStake <= bet) ||
          tables.find((t) => t.allowedCurrencies.includes(cur)) ||
          tables[0];
        if (match) {
          void TableSelectionManager.getInstance().switchTable(match.id);
          if (!match.allowedCurrencies.includes(this.activeCurrency)) {
            this.activeCurrency = match.allowedCurrencies[0];
          }
        }
        this.refreshStakeHud();
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
    // Always mirror wallet → HUD so currency/bet switches never show stale amounts
    const live = WalletService.getInstance().getBalances();
    this.gcBalance = live.goldCoins;
    this.scBalance = live.sweepstakesCoins;

    const el = document.getElementById('hud-bet-display');
    const bet = this.getCurrentBet();
    if (el) el.textContent = `${bet} ${this.activeCurrency}`;
    const badge = document.getElementById('hud-bet-badge');
    if (badge) {
      const scale = 0.85 + Math.min(0.55, Math.log10(bet * 20 + 1) * 0.35);
      const colors: Array<[number, string]> = [
        [0.25, '#67e8f9'],
        [1, '#22d3ee'],
        [2.5, '#fbbf24'],
        [5, '#f97316'],
        [10, '#f43f5e'],
      ];
      let fg = '#67e8f9';
      for (const [t, f] of colors) {
        if (bet >= t) fg = f;
      }
      badge.textContent = `×${bet.toFixed(2)} ${this.activeCurrency}`;
      badge.style.transform = `translateX(-50%) scale(${scale})`;
      badge.style.color = fg;
      badge.style.boxShadow = `2px 2px 0 #020617, inset 0 0 0 1px ${fg}55`;
    }
    const barrelEl = document.getElementById('hud-barrel-badge');
    if (barrelEl) {
      const n = this.getBarrelCount();
      barrelEl.textContent = n > 1 ? `${n} BAR` : '1×';
      barrelEl.style.opacity = n > 1 ? '1' : '0.55';
    }
    this.paintBalances();
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

  /** Lobby currency switch — picks a room that allows it, refreshes HUD. */
  private setCurrency(currency: 'GC' | 'SC'): void {
    const changed = this.activeCurrency !== currency;
    this.activeCurrency = currency;
    if (changed) {
      const defaultIdx = this.betTiers.indexOf(1.0);
      this.currentBetIndex = defaultIdx >= 0 ? defaultIdx : 4;
      SoundManager.playUiSound('currency_toggle');
    }

    // Practice is GC-only; SC must land on public/tournament
    const tables = TableSelectionManager.getInstance().getTables();
    const active = TableSelectionManager.getInstance().getActiveTable();
    if (!active.allowedCurrencies.includes(currency)) {
      const match =
        tables.find((t) => t.allowedCurrencies.includes(currency) && Math.abs(t.minStake - this.getCurrentBet()) < 0.001) ||
        tables.find((t) => t.allowedCurrencies.includes(currency) && t.minStake <= this.getCurrentBet()) ||
        tables.find((t) => t.allowedCurrencies.includes(currency));
      if (match) {
        void TableSelectionManager.getInstance().switchTable(match.id);
      }
    }

    this.refreshStakeHud();
    this.renderHUD();
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

  public setBossOverlay(
    active: boolean,
    secondsLeft?: number,
    hpPercent?: number,
    phase?: string,
    totalDamage?: number
  ): void {
    const overlay = document.getElementById('hud-boss-overlay');
    const combat = document.getElementById('hud-boss-combat');
    const timer = document.getElementById('hud-boss-timer');
    const phaseEl = document.getElementById('hud-boss-phase');
    const hpText = document.getElementById('hud-boss-hp-text');
    const damage = document.getElementById('hud-boss-damage');
    const segments = document.getElementById('hud-boss-hp-segments');

    if (overlay) overlay.style.display = active ? 'block' : 'none';
    if (combat) combat.style.display = active ? 'block' : 'none';

    if (!active) return;

    const hp = Math.max(0, Math.min(100, Math.round(hpPercent ?? 100)));

    if (timer && typeof secondsLeft === 'number') {
      timer.textContent = `${Math.max(0, secondsLeft)}s`;
    }

    if (phaseEl) {
      phaseEl.textContent = String(phase ?? 'engaged').toUpperCase();
      phaseEl.style.color =
        phase === 'enraged' ? '#ef4444' :
        phase === 'approaching' ? '#fbbf24' : '#22d3ee';
    }

    if (hpText) hpText.textContent = `HP ${hp}%`;
    if (damage) damage.textContent = `DMG ${Math.max(0, Math.floor(totalDamage ?? 0))}`;

    if (segments) {
      const count = 24;
      segments.innerHTML = '';
      const filled = Math.ceil((hp / 100) * count);

      for (let i = 0; i < count; i++) {
        const segment = document.createElement('span');
        segment.style.flex = '1';
        segment.style.height = '100%';
        segment.style.background = i < filled
          ? (phase === 'enraged' ? '#ef4444' : '#22d3ee')
          : '#1f2937';
        segment.style.border = '1px solid #374151';
        segments.appendChild(segment);
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
    this.gcBalance = Math.max(0, Math.floor(gc));
    this.scBalance = WalletService.roundSc(sc);
    this.paintBalances();
  }

  /** Single paint path so GC/SC switch and spends stay consistent. */
  private paintBalances(): void {
    // Re-query in case HUD was rebuilt
    this.gcBalanceEl = document.getElementById('hud-gc-balance') as HTMLElement;
    this.scBalanceEl = document.getElementById('hud-sc-balance') as HTMLElement;
    if (this.gcBalanceEl) {
      this.gcBalanceEl.innerHTML = `${this.gcBalance.toLocaleString()}<sub style="font-size:10px;color:#fcd34d;margin-left:2px;font-weight:800;">GC</sub>`;
    }
    if (this.scBalanceEl) {
      this.scBalanceEl.innerHTML = `${this.scBalance.toFixed(2)}<sub style="font-size:10px;color:#99f6e4;margin-left:2px;font-weight:800;">SC</sub>`;
    }
    const gcW = document.getElementById('hud-gc-wallet');
    const scW = document.getElementById('hud-sc-wallet');
    if (gcW) gcW.style.display = this.activeCurrency === 'GC' ? 'flex' : 'none';
    if (scW) scW.style.display = this.activeCurrency === 'SC' ? 'flex' : 'none';

    // Start-screen mirrors (if open)
    const lobbyGc = document.getElementById('ff-lobby-gc');
    const lobbySc = document.getElementById('ff-lobby-sc');
    if (lobbyGc) lobbyGc.textContent = this.gcBalance.toLocaleString();
    if (lobbySc) lobbySc.textContent = this.scBalance.toFixed(2);
  }

  public getCurrency(): 'GC' | 'SC' {
    return this.activeCurrency;
  }

  /**
   * Stake cost in wallet units for the active currency.
   * SC: bet amount (2dp). GC: bet amount as whole coins (1.00 → 1 GC).
   * Barrel count multiplies damage/payout, not the stake charge.
   */
  public getStakeCost(): number {
    const units = this.getCurrentBet();
    return this.activeCurrency === 'SC'
      ? WalletService.roundSc(units)
      : Math.max(1, Math.round(units));
  }

  public deductBet(): boolean {
    const wallet = WalletService.getInstance();
    // Prefer live wallet balances so we never fight a second copy
    const live = wallet.getBalances();
    this.gcBalance = live.goldCoins;
    this.scBalance = live.sweepstakesCoins;

    const cost = this.getStakeCost();
    const ok = wallet.trySpend(this.activeCurrency, cost);
    if (!ok) {
      this.openStore();
      this.paintBalances();
      return false;
    }
    const after = wallet.getBalances();
    this.gcBalance = after.goldCoins;
    this.scBalance = after.sweepstakesCoins;
    this.paintBalances();
    return true;
  }

  public addBalance(gc: number, sc: number): void {
    WalletService.getInstance().credit(gc, sc);
    const b = WalletService.getInstance().getBalances();
    this.gcBalance = b.goldCoins;
    this.scBalance = b.sweepstakesCoins;
    this.paintBalances();
  }
}
