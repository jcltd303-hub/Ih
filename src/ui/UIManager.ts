import { WalletService } from '../network/WalletService';
import { AuthManager } from '../network/AuthManager';
import { FeatureFlags } from '../config/FeatureFlags';
import { SoundManager } from '../audio/SoundManager';
import { AudioManager } from '../audio/AudioManager';
import { GameTheme, ThemeManager } from '../engine/systems/ThemeManager';
import { PayoutEngine } from '../engine/systems/PayoutEngine';
import { showGameOverModal } from './modals/gameOverModal';
import { showStreakModal as openStreakModal } from './modals/streakModal';
import { showLeaderboardModal as openLeaderboardModal } from './modals/leaderboardModal';
import { showAdminPortalModal as openAdminPortalModal } from './modals/adminPortalModal';
import { showProgressionModal } from './modals/progressionModal';
import type { ModalContext } from './modals/ModalContext';
import { showStoreModal } from './modals/storeModal';
import { showHowToPlayModal } from './modals/howToPlayModal';
import { showOptionsModal } from './modals/optionsModal';
import { showAuthModal } from './modals/authModal';
import { showDepositModal, showWithdrawModal } from './modals/walletModal';
import { TableSelectionManager, AVAILABLE_TABLES, TableConfig } from '../network/TableSelectionManager';
import { PlayerProgressionManager, PlayerProgressionState } from '../engine/systems/PlayerProgressionManager';
import { GameEventBus, GameOverEvent } from '../engine/core/GameEvents';
import { ARCADE } from './StyleConstants';

export class UIManager {
  private container: HTMLElement;
  private gcBalanceEl: HTMLElement | null = null;
  private scBalanceEl: HTMLElement | null = null;
  private betDisplayEl: HTMLElement | null = null;
  private soundBtn: HTMLElement | null = null;
  private modalContainer!: HTMLElement;

  private currentBetIndex: number = 4; // Default 1.00 SC
  private betTiers: number[] = [0.05, 0.10, 0.25, 0.50, 1.00, 2.50, 5.00, 10.00];
  private gcBalance: number = 10000;
  private scBalance: number = 50.00;
  private activeCurrency: 'GC' | 'SC' = 'SC';
  private currentTheme: GameTheme = 'light';
  private tableBadgeBtn: HTMLElement | null = null;
  private progressionUnsub: (() => void) | null = null;
  private tableUnsub: (() => void) | null = null;

  private onThemeChangeCallback?: (theme: GameTheme) => void;
  private onBetChangeCallback?: (bet: number, currency: 'GC' | 'SC') => void;
  private onLoadoutChangeCallback?: () => void;
  private onPlayCallback?: () => void;
  private startScreenEl: HTMLElement | null = null;
  private isGameActive: boolean = false;

  constructor(
    rootElement: HTMLElement,
    callbacks?: {
      onThemeChange?: (theme: GameTheme) => void;
      onBetChange?: (bet: number, currency: 'GC' | 'SC') => void;
      onLoadoutChange?: () => void;
      onPlay?: () => void;
    }
  ) {
    this.onThemeChangeCallback = callbacks?.onThemeChange;
    this.onBetChangeCallback = callbacks?.onBetChange;
    this.onLoadoutChangeCallback = callbacks?.onLoadoutChange;
    this.onPlayCallback = callbacks?.onPlay;

    this.container = document.createElement('div');
    this.container.id = 'fish-frenzy-hud';
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 20; display: flex; flex-direction: column; justify-content: space-between;
      box-sizing: border-box; padding: 12px 16px; overflow: hidden;
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

    GameEventBus.getInstance().on<GameOverEvent>('GAME_OVER', (data) => {
      this.showGameOverModal(data);
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

  /** Full-screen arcade cabinet title screen with Play CTA */
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
      background: 'radial-gradient(ellipse at center, #0a1120 0%, #030712 100%)',
      color: '#f8fafc',
      fontFamily: 'var(--font-display, "Impact", sans-serif)',
    });

    this.startScreenEl.innerHTML = `
      <style>
        @keyframes ff-play-pulse {
          0% { box-shadow: 0 4px 0 #92400e, 0 0 16px rgba(250,204,21,.4); }
          100% { box-shadow: 0 4px 0 #92400e, 0 0 32px rgba(250,204,21,.85), 0 0 48px rgba(56,189,248,.35); }
        }
        #fish-frenzy-start .ff-arcade-cabinet {
          width: min(440px, 100%);
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          box-sizing: border-box;
          padding: 24px 20px 20px;
          border-radius: 2px;
          background: #090e1a;
          border: 3px solid #38bdf8;
          box-shadow: 0 0 35px rgba(56, 189, 248, 0.25), 6px 6px 0 #020617;
          text-align: center;
          position: relative;
        }
        #fish-frenzy-start .ff-arcade-cabinet::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .05;
          background: repeating-linear-gradient(0deg, transparent 0, transparent 2px, #fff 3px);
        }
        #fish-frenzy-start .ff-cabinet-title {
          font-size: clamp(34px, 8vw, 48px);
          line-height: 0.95;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 2px;
          margin-bottom: 2px;
          color: #f8fafc;
          text-shadow: 0 3px 0 #0284c7, 0 0 20px rgba(56, 189, 248, 0.6);
        }
        #fish-frenzy-start .ff-cabinet-sub {
          font-size: 11px;
          letter-spacing: 3px;
          color: #38bdf8;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
      </style>

      <div class="ff-arcade-cabinet">
        <!-- Theme Toggle Button -->
        <button id="lobby-theme-toggle" type="button" title="Toggle Theme" style="
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid #334155;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${this.currentTheme === 'light' ? '#fde047' : '#a855f7'};
          font-size: 14px;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          z-index: 10;
        ">
          ${this.currentTheme === 'light' ? '☀️' : '🌙'}
        </button>

        <div style="font-size:10px; letter-spacing:4px; color:#fbbf24; font-weight:900; margin-bottom:2px;">SYS.ONLINE // COMBAT SIMULATOR</div>
        <div class="ff-cabinet-title">FISH FRENZY</div>
        <div class="ff-cabinet-sub">ARCADE COMBAT // PREDATOR TRENCH</div>

        <!-- Auth row -->
        <div id="ff-auth-row" style="display:flex; gap:8px; justify-content:center; align-items:center; margin-bottom:14px;">
          <div id="ff-auth-status" style="padding:6px 10px; border-radius:2px; font-size:11px; font-weight:900; color:#e0f2fe; flex:1; background:#0f172a; border:1px solid #334155; font-family:var(--font-mono, monospace);">
            GUEST // REEF HUNTER
          </div>
          <button id="ff-auth-action" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:6px 12px; font-size:11px;">
            SIGN IN
          </button>
        </div>

        <!-- Credits / Balance Display -->
        <div style="background:#0f172a; border:1px solid #334155; padding:12px; margin-bottom:14px; display:flex; justify-content:space-around; align-items:center;">
          <div style="text-align:center;">
            <div style="font-size:10px; letter-spacing:2px; color:#fde68a; font-weight:900;">GOLD COINS</div>
            <div id="ff-lobby-gc" style="font-size:20px; font-weight:900; color:#fbbf24; text-shadow:0 2px 0 #78350f;">—</div>
          </div>
          <div style="width:1px; height:28px; background:#334155;"></div>
          <div style="text-align:center;">
            <div style="font-size:10px; letter-spacing:2px; color:#a5f3fc; font-weight:900;">SWEEPS COINS</div>
            <div id="ff-lobby-sc" style="font-size:20px; font-weight:900; color:#38bdf8; text-shadow:0 2px 0 #0e7490;">—</div>
          </div>
        </div>

        <!-- Deposit / Withdraw -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
          <button id="ff-deposit" type="button" class="ff-arcade-btn ff-arcade-btn-green" style="padding:10px 8px; font-size:12px;">+ DEPOSIT</button>
          <button id="ff-withdraw" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:10px 8px; font-size:12px;">- WITHDRAW</button>
        </div>
        <div id="ff-wallet-status" style="min-height:16px; margin:0 0 10px; font-size:11px; color:#94a3b8; font-family:var(--font-mono, monospace);"></div>

        <!-- Primary Action: INSERT COIN / PLAY -->
        <div style="margin-bottom:14px;">
          <button id="ff-play" type="button" class="ff-arcade-btn ff-arcade-btn-primary" style="
            width: 100%;
            padding: 16px 12px;
            font-size: 22px;
            letter-spacing: 3px;
            font-style: italic;
            animation: ff-play-pulse 1.2s ease-in-out infinite alternate;
          ">
            INSERT COIN // START COMBAT
          </button>
        </div>

        <!-- Cabinet Utility Menu -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
          <button id="ff-start-how-to-play" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:10px; font-size:12px;">
            HOW TO PLAY
          </button>
          <button id="ff-start-tables" type="button" class="ff-arcade-btn ff-arcade-btn-cyan" style="padding:10px; font-size:12px;">
            TABLE SELECT
          </button>
          <button id="ff-start-options" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:10px; font-size:12px;">
            OPTIONS / AUDIO
          </button>
          <button id="ff-start-store" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:10px; font-size:12px;">
            STORE & PERKS
          </button>
        </div>

        <div style="font-size:10px; color:#64748b; font-family:var(--font-mono, monospace);">
          PROVABLY FAIR · HMAC-SHA256 DETERMINISTIC
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

    const renderAuth = () => {
      const state = AuthManager.getInstance().getState();
      const signedIn = !state.isAnonymous || !!(state.user && !state.user.isAnonymous);
      if (authEl) {
        authEl.textContent = signedIn
          ? `P1 // ${state.displayName || 'PILOT'}`
          : state.displayName
          ? `GUEST // ${state.displayName}`
          : 'P1 // REEF HUNTER';
      }
      if (authBtn) {
        authBtn.textContent = signedIn ? 'PILOT ID' : 'SIGN IN';
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
      console.warn('[Lobby] wallet connect fallback to local storage', error?.message || error);
      if (statusEl) statusEl.textContent = 'Local credits active.';
    });

    AuthManager.getInstance().onChange(() => renderAuth());
    renderAuth();

    const openPilotModal = () => {
      showAuthModal(this.modalCtx(), () => {
        renderAuth();
        renderWallet();
      });
    };

    authBtn?.addEventListener('click', openPilotModal);
    authEl?.addEventListener('click', openPilotModal);
    if (authEl) {
      authEl.style.cursor = 'pointer';
      authEl.title = 'Click to edit Pilot Callsign';
    }

    root.querySelector<HTMLButtonElement>('#ff-deposit')?.addEventListener('click', () => {
      showDepositModal(this.modalCtx(), wallet, () => {
        renderWallet();
        if (statusEl) statusEl.textContent = 'Deposit confirmed.';
      });
    });

    root.querySelector<HTMLButtonElement>('#ff-withdraw')?.addEventListener('click', () => {
      showWithdrawModal(this.modalCtx(), wallet, () => {
        renderWallet();
        if (statusEl) statusEl.textContent = 'Withdrawal processed.';
      });
    });

    root.querySelector('#ff-start-how-to-play')?.addEventListener('click', () => {
      showHowToPlayModal(this.modalCtx());
    });

    root.querySelector('#lobby-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    root.querySelector('#ff-start-options')?.addEventListener('click', () => {
      showOptionsModal(this.modalCtx(), (theme) => {
        this.currentTheme = theme;
        this.onThemeChangeCallback?.(theme);
        this.updateThemeToggleUI();
      });
    });

    root.querySelector('#ff-start-tables')?.addEventListener('click', () => {
      this.showLobby();
    });

    root.querySelector('#ff-start-store')?.addEventListener('click', () => {
      this.openStore();
    });

    const playBtn = root.querySelector<HTMLButtonElement>('#ff-play');
    playBtn?.addEventListener('click', () => {
      try {
        SoundManager.playUiSound('click');
        AudioManager.getInstance().transitionTo('GAMEPLAY');
        if (this.currentTheme === 'dark') {
          SoundManager.playHorrorWhisper(0.8);
        }
        SoundManager.startBgm();
      } catch (err) {
        console.warn('[StartScreen] Audio initialization warning:', err);
      }
      this.onPlayCallback?.();
    });
  }

  public hideStartScreen(): void {
    if (this.startScreenEl) {
      const unsubscribe = (this.startScreenEl as any).__walletUnsubscribe;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      this.startScreenEl.remove();
      this.startScreenEl = null;
    }
    this.isGameActive = true;
    this.container.style.visibility = 'visible';
    GameEventBus.getInstance().emit('GAME_START');
  }

  private renderHUD(): void {
    const isLight = this.currentTheme === 'light';
    const bet = this.getCurrentBet();
    const isSc = this.activeCurrency === 'SC';

    this.container.innerHTML = `
      <style id="ff-streamlined-ui-styles">
        .ff-pill-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.5px;
          cursor: pointer;
          user-select: none;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
          box-sizing: border-box;
          text-decoration: none;
          outline: none;
        }
        .ff-pill-btn:active {
          transform: scale(0.96);
        }
        
        /* Light Theme Metallic Pill Styling (Bright & Lustrous) */
        .theme-light .ff-metal-pill {
          background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 45%, #cbd5e1 100%);
          border: 1px solid rgba(148, 163, 184, 0.8);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95);
          color: #0f172a;
        }
        .theme-light .ff-metal-pill:hover {
          background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 45%, #e2e8f0 100%);
          border-color: #94a3b8;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.16), inset 0 1px 0 #ffffff;
        }
        
        /* Dark / Abyssal Theme Metallic Pill Styling (Scary, Obsidian, Biomech) */
        .theme-dark .ff-metal-pill {
          background: linear-gradient(180deg, #1e1b2e 0%, #0d0b14 50%, #05040a 100%);
          border: 1px solid rgba(168, 85, 247, 0.35);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7), 0 0 12px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(192, 132, 252, 0.3);
          color: #e9d5ff;
        }
        .theme-dark .ff-metal-pill:hover {
          background: linear-gradient(180deg, #2b1f3d 0%, #151124 50%, #090712 100%);
          border-color: rgba(239, 68, 68, 0.6);
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3), 0 0 16px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(248, 113, 113, 0.4);
          color: #fca5a5;
        }

        /* Currency Badge (SC Green / GC Gold) */
        .ff-coin-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: 900;
          font-size: 11px;
          user-select: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .ff-coin-sc {
          background: linear-gradient(135deg, #4ade80 0%, #16a34a 60%, #15803d 100%);
          border: 1.5px solid #86efac;
          color: #052e16;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        .ff-coin-gc {
          background: linear-gradient(135deg, #fde047 0%, #ca8a04 60%, #a16207 100%);
          border: 1.5px solid #fef08a;
          color: #422006;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }

        /* Turret Bet Stepper Button (+ / -) */
        .ff-step-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          border: none;
          outline: none;
        }
        .theme-light .ff-step-btn {
          background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%);
          border: 1.5px solid #94a3b8;
          color: #0f172a;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 #fff;
        }
        .theme-light .ff-step-btn:hover {
          background: #ffffff;
          border-color: #3b82f6;
          color: #2563eb;
          transform: scale(1.08);
        }
        .theme-dark .ff-step-btn {
          background: linear-gradient(180deg, #241433 0%, #0d0714 100%);
          border: 1.5px solid rgba(168, 85, 247, 0.5);
          color: #c084fc;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(192, 132, 252, 0.3);
        }
        .theme-dark .ff-step-btn:hover {
          background: #331445;
          border-color: #ef4444;
          color: #f87171;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
          transform: scale(1.08);
        }
        .ff-step-btn:active {
          transform: scale(0.92);
        }

        /* Turret Core Controller Widget Container */
        .theme-light .ff-turret-plate {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 2px solid #cbd5e1;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18), inset 0 1px 0 #ffffff;
          color: #0f172a;
        }
        .theme-light .ff-turret-plate * {
          color: #0f172a !important;
          text-shadow: none !important;
        }
        .theme-light .ff-turret-plate .ff-coin-badge {
          color: #052e16 !important;
        }
        .theme-light .ff-turret-plate .ff-coin-gc {
          color: #422006 !important;
        }
        .theme-dark .ff-turret-plate {
          background: linear-gradient(180deg, rgba(26,16,37,0.95) 0%, rgba(10,6,18,0.98) 100%);
          border: 2px solid rgba(168,85,247,0.5);
          box-shadow: 0 8px 30px rgba(0,0,0,0.85), 0 0 20px rgba(168,85,247,0.25), inset 0 1px 0 rgba(192,132,252,0.3);
          color: #f8fafc;
        }
        .theme-dark .ff-turret-plate * {
          color: #f8fafc;
          text-shadow: 0 0 8px rgba(168,85,247,0.5);
        }
        .theme-dark .ff-turret-plate .ff-coin-badge {
          color: #052e16 !important;
          text-shadow: none !important;
        }
        .theme-dark .ff-turret-plate .ff-coin-gc {
          color: #422006 !important;
          text-shadow: none !important;
        }

        /* Integrated Turret Base Controller Styling */
        #hud-turret-controller {
          position: absolute;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          z-index: 40;
        }

        /* Mobile & responsive viewport adjustments */
        @media (max-width: 680px) {
          #hud-topbar {
            padding: 4px 6px !important;
          }
          .ff-pill-btn {
            height: 32px !important;
            padding: 0 8px !important;
            font-size: 11px !important;
            gap: 4px !important;
          }
          .ff-pill-btn .pill-text {
            display: none !important;
          }
          #hud-currency-toggle {
            height: 32px !important;
            padding: 0 8px !important;
          }
          #hud-currency-toggle .swap-text {
            display: none !important;
          }
          #hud-active-balance {
            font-size: 13px !important;
          }
          #hud-turret-controller {
            bottom: 4px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
          }
          .ff-turret-plate {
            padding: 3px 8px !important;
            gap: 6px !important;
          }
          #hud-turret-bet-display {
            padding: 2px 6px !important;
            gap: 6px !important;
          }
          #hud-turret-coin {
            width: 28px !important;
            height: 28px !important;
            font-size: 10px !important;
          }
          #hud-bet-display {
            font-size: 16px !important;
          }
          .ff-step-btn {
            width: 28px !important;
            height: 28px !important;
            font-size: 16px !important;
          }
          #hud-bet-max {
            width: 32px !important;
            height: 28px !important;
            font-size: 8px !important;
          }
          .ff-pill-btn {
            padding: 0 8px !important;
            min-width: 32px !important;
          }
        }
      </style>

      <div id="hud-root-wrapper" class="${isLight ? 'theme-light' : 'theme-dark'}" style="
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: 100%;
        height: 100%;
        pointer-events: none;
      ">
        <!-- TOP UTILITY BAR (Streamlined Metallic Pills) -->
        <div id="hud-topbar" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          pointer-events: auto;
          padding: 4px 8px;
          z-index: 50;
        ">
          <!-- Top Left: Currency Toggle Pill + Live Balance + Room Badge -->
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <!-- Currency Mode Switcher Pill -->
            <button id="hud-currency-toggle" type="button" class="ff-pill-btn ff-metal-pill" style="
              height: 38px;
              padding: 0 14px;
            " title="Switch between SC and GC">
              <span id="hud-coin-badge" class="ff-coin-badge ${isSc ? 'ff-coin-sc' : 'ff-coin-gc'}" style="width: 24px; height: 24px;">
                ${this.activeCurrency}
              </span>
              <span id="hud-active-balance" style="font-family: monospace; font-size: 15px; font-weight: 800;">
                ${isSc ? this.scBalance.toFixed(2) : this.gcBalance.toLocaleString()}
              </span>
              <span class="swap-text" style="font-size: 9px; opacity: 0.7; letter-spacing: 1px;">SWAP</span>
            </button>
            <span id="hud-active-currency" style="display: none;">${this.activeCurrency}</span>

            <!-- Table / Room Quick Switch Badge -->
            <button id="hud-room-badge" type="button" class="ff-pill-btn ff-metal-pill" style="
              height: 38px;
              padding: 0 12px;
            " title="Active Room / Table (Click to switch tables)">
              <span style="font-size: 13px;">🌊</span>
              <span id="hud-room-name" class="pill-text" style="font-size: 11px; font-weight: 800;">REEF</span>
            </button>
          </div>

          <!-- Top Right: Audio Toggles, Theme Toggle, Rules, Store, Redeem, Lobby -->
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            max-width: calc(100vw - 140px);
            padding-bottom: 2px;
          ">
            <!-- Sound SFX Toggle Pill -->
            <button id="hud-sfx-btn" type="button" class="ff-pill-btn ff-metal-pill" style="height: 36px; padding: 0 12px;" title="SFX Sound Effects On/Off">
              <span style="font-size: 14px;">🔊</span>
              <span id="hud-sfx-label" class="pill-text" style="font-size: 11px;">SFX ON</span>
            </button>

            <!-- Sound Music Toggle Pill -->
            <button id="hud-music-btn" type="button" class="ff-pill-btn ff-metal-pill" style="height: 36px; padding: 0 12px;" title="Music On/Off">
              <span style="font-size: 14px;">🎵</span>
              <span id="hud-music-label" class="pill-text" style="font-size: 11px;">BGM ON</span>
            </button>

            <!-- Theme Toggle Pill (Bright Light / Abyssal Scary) -->
            <button id="hud-theme-toggle" type="button" class="ff-pill-btn ff-metal-pill" style="height: 36px; padding: 0 12px;" title="Toggle Light / Abyssal Theme">
              <span style="font-size: 14px;">${isLight ? '☀️' : '🌙'}</span>
              <span class="pill-text" style="font-size: 11px;">${isLight ? 'LIGHT' : 'ABYSS'}</span>
            </button>

            <!-- Rules / Manual Pill -->
            <button id="hud-help-btn" type="button" class="ff-pill-btn ff-metal-pill" style="height: 36px; padding: 0 12px;" title="Arcade Combat Manual & Rules">
              <span style="font-size: 13px;">❓</span>
              <span class="pill-text" style="font-size: 11px;">RULES</span>
            </button>

            <!-- Store Pill -->
            <button id="hud-store-btn" type="button" class="ff-pill-btn ff-metal-pill" style="
              height: 36px;
              padding: 0 14px;
              color: ${isLight ? '#059669' : '#34d399'};
              border-color: ${isLight ? '#34d399' : '#059669'};
            " title="Open Store">
              <span>🛒</span>
              <span class="pill-text">STORE</span>
            </button>

            <!-- Redeem / Withdrawal Pill -->
            <button id="hud-redeem-btn" type="button" class="ff-pill-btn ff-metal-pill" style="
              height: 36px;
              padding: 0 12px;
            " title="Redeem / Cash Out">
              <span>💎</span>
              <span class="pill-text">REDEEM</span>
            </button>

            <!-- Lobby Pill -->
            <button id="hud-lobby-btn" type="button" class="ff-pill-btn ff-metal-pill" style="
              height: 36px;
              padding: 0 12px;
            " title="Return to Lobby">
              <span>🏠</span>
              <span class="pill-text">LOBBY</span>
            </button>
          </div>
        </div>

        <!-- INTEGRATED TURRET BASE CONTROLLER (Centered directly on Turret Pedestal) -->
        <div id="hud-turret-controller" style="
          position: absolute;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          z-index: 40;
        ">
          <div class="ff-turret-plate" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 12px;
            border-radius: 9999px;
            backdrop-filter: blur(12px);
            user-select: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25);
          ">
            <!-- Stepper Minus Button (Left Wing) -->
            <button id="hud-bet-minus" type="button" class="ff-step-btn" style="
              width: 32px;
              height: 32px;
              font-size: 18px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
            " title="Decrease Stake (−)">−</button>

            <!-- Integrated Turret Base Stake Display (Center Mount) -->
            <div id="hud-turret-bet-display" style="
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 2px 10px;
              border-radius: 12px;
              cursor: pointer;
              background: rgba(0, 0, 0, 0.12);
            " title="Current Stake Amount (Click to cycle)">
              <!-- Round Coin Indicator -->
              <div id="hud-turret-coin" class="ff-coin-badge ${isSc ? 'ff-coin-sc' : 'ff-coin-gc'}" style="
                width: 32px;
                height: 32px;
                font-size: 12px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                flex-shrink: 0;
              ">
                ${this.activeCurrency}
              </div>

              <!-- Numerical Bet Stake Readout -->
              <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: 68px;">
                <span style="font-size: 8px; font-weight: 800; letter-spacing: 1.2px; opacity: 0.65; line-height: 1;">STAKE</span>
                <div style="display: flex; align-items: baseline; gap: 3px;">
                  <span id="hud-bet-display" style="font-family: monospace; font-size: 18px; font-weight: 900; line-height: 1.2;">
                    ${bet.toFixed(2)}
                  </span>
                  <span id="hud-bet-currency-label" style="font-size: 10px; font-weight: 800; opacity: 0.85;">
                    ${this.activeCurrency}
                  </span>
                </div>
              </div>
            </div>

            <!-- Stepper Plus Button (Right Wing) -->
            <button id="hud-bet-plus" type="button" class="ff-step-btn" style="
              width: 32px;
              height: 32px;
              font-size: 18px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
            " title="Increase Stake (+)">+</button>

            <!-- MAX Bet Button -->
            <button id="hud-bet-max" type="button" class="ff-step-btn" style="
              width: 36px;
              height: 32px;
              border-radius: 8px;
              font-size: 9px;
              letter-spacing: 0.5px;
              font-weight: 900;
              display: flex;
              align-items: center;
              justify-content: center;
            " title="Maximum Stake">MAX</button>
          </div>
        </div>
      </div>

      <!-- Hidden compatibility elements to maintain backwards system compatibility -->
      <span id="hud-gc-balance" style="display:none;"></span>
      <span id="hud-sc-balance" style="display:none;"></span>
      <div id="hud-gc-wallet" style="display:none;"></div>
      <div id="hud-sc-wallet" style="display:none;"></div>
      <span id="hud-player-name" style="display:none;"></span>
      <div id="hud-player-tag" style="display:none;"></div>
      <button id="hud-table-btn" style="display:none;"></button>
      <button id="hud-paper-rig-btn" style="display:none;"></button>
      <button id="hud-options-btn" style="display:none;"></button>
      <button id="hud-diag-btn" style="display:none;"></button>
      <button id="hud-level-btn" style="display:none;"></button>
      <span id="hud-level-val" style="display:none;"></span>
      <div id="hud-level-bar" style="display:none;"></div>
      <div id="hud-bet-badge" style="display:none;"></div>
      <div id="hud-barrel-badge" style="display:none;"></div>
    `;

    // Reference elements
    this.gcBalanceEl = document.getElementById('hud-gc-balance');
    this.scBalanceEl = document.getElementById('hud-sc-balance');
    this.betDisplayEl = document.getElementById('hud-bet-display');
    this.tableBadgeBtn = document.getElementById('hud-table-btn');

    // Event listeners
    this.updateAudioTogglesUI();
    this.refreshStakeHud();

    // Sound toggle buttons
    document.getElementById('hud-sfx-btn')?.addEventListener('click', () => {
      SoundManager.toggleSound();
      SoundManager.playUiSound('click');
      this.updateAudioTogglesUI();
    });

    document.getElementById('hud-music-btn')?.addEventListener('click', () => {
      const current = SoundManager.isBgmEnabled();
      SoundManager.toggleBgm(!current);
      if (!current) SoundManager.startBgm();
      SoundManager.playUiSound('click');
      this.updateAudioTogglesUI();
    });

    // Theme toggle
    document.getElementById('hud-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Currency toggle (SC / GC)
    document.getElementById('hud-currency-toggle')?.addEventListener('click', () => {
      this.toggleCurrency();
    });

    // Room badge (Table Select)
    document.getElementById('hud-room-badge')?.addEventListener('click', () => {
      this.showLobby();
    });

    // Rules & Manual
    document.getElementById('hud-help-btn')?.addEventListener('click', () => {
      showHowToPlayModal(this.modalCtx());
    });

    // Stake stepper (+ and -), MAX bet, and direct display cycle
    document.getElementById('hud-bet-plus')?.addEventListener('click', () => this.adjustBet(1));
    document.getElementById('hud-bet-minus')?.addEventListener('click', () => this.adjustBet(-1));
    document.getElementById('hud-bet-max')?.addEventListener('click', () => {
      this.setBetIndex(this.betTiers.length - 1);
    });
    document.getElementById('hud-turret-bet-display')?.addEventListener('click', () => {
      this.adjustBet(1);
    });

    // Lobby, Store, Redeem
    document.getElementById('hud-lobby-btn')?.addEventListener('click', () => this.showLobby());
    document.getElementById('hud-store-btn')?.addEventListener('click', () => this.openStore());
    document.getElementById('hud-redeem-btn')?.addEventListener('click', () => {
      showWithdrawModal(this.modalCtx(), WalletService.getInstance());
    });

    // Table room name sync
    const activeTbl = TableSelectionManager.getInstance().getActiveTable();
    const roomNameEl = document.getElementById('hud-room-name');
    if (roomNameEl && activeTbl) roomNameEl.textContent = activeTbl.name.toUpperCase();

    // Subscribe to table changes
    if (!this.tableUnsub) {
      this.tableUnsub = TableSelectionManager.getInstance().onTableChange((tbl) => {
        const rName = document.getElementById('hud-room-name');
        if (rName) rName.textContent = tbl.name.toUpperCase();

        if (!tbl.allowedCurrencies.includes(this.activeCurrency)) {
          this.activeCurrency = tbl.allowedCurrencies[0];
        }

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

    // Subscribe to player progression updates
    if (!this.progressionUnsub) {
      this.progressionUnsub = PlayerProgressionManager.getInstance().subscribe((prog) => {
        this.updateProgressionHud(prog);
      });
    }
    this.updateProgressionHud(PlayerProgressionManager.getInstance().getState());

    // Keyboard shortcuts for arcade combat
    window.addEventListener('keydown', (e) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      if (this.modalContainer && this.modalContainer.style.display === 'flex') return;

      if (e.shiftKey && (e.key === '`' || e.key === '~')) {
        this.showAdminPortalModal();
      } else if (e.key === '+' || e.key === '=') {
        this.adjustBet(1);
      } else if (e.key === '-' || e.key === '_') {
        this.adjustBet(-1);
      } else if (e.key === 'c' || e.key === 'C') {
        this.toggleCurrency();
      } else if (e.key === 't' || e.key === 'T') {
        this.toggleTheme();
      }
    });
  }

  private updateAudioTogglesUI(): void {
    const sfxBtn = document.getElementById('hud-sfx-btn');
    const sfxLabel = document.getElementById('hud-sfx-label');
    const musicBtn = document.getElementById('hud-music-btn');
    const musicLabel = document.getElementById('hud-music-label');

    const sfxOn = SoundManager.isSoundEnabled();
    const bgmOn = SoundManager.isBgmEnabled();

    if (sfxBtn && sfxLabel) {
      sfxLabel.textContent = sfxOn ? 'SFX ON' : 'SFX OFF';
      sfxBtn.style.opacity = sfxOn ? '1' : '0.55';
    }
    if (musicBtn && musicLabel) {
      musicLabel.textContent = bgmOn ? 'BGM ON' : 'BGM OFF';
      musicBtn.style.opacity = bgmOn ? '1' : '0.55';
    }
  }

  private updateProgressionHud(prog: PlayerProgressionState): void {
    const lvlVal = document.getElementById('hud-hunter-level') || document.getElementById('hud-level-val');
    const lvlBar = document.getElementById('hud-hunter-bar') || document.getElementById('hud-level-bar');

    if (lvlVal) lvlVal.textContent = prog.level.toString();
    if (lvlBar) lvlBar.style.width = `${Math.min(100, Math.max(0, prog.progressPct))}%`;
  }

  private createModalContainer(_root: HTMLElement): void {
    this.modalContainer = document.createElement('div');
    this.modalContainer.id = 'hud-modal-layer';
    this.modalContainer.style.cssText = `
      position: fixed; inset: 0; width: 100vw; height: 100vh;
      background: rgba(3, 7, 18, 0.88); backdrop-filter: blur(8px);
      display: none; justify-content: center; align-items: center;
      z-index: 100000; padding: 20px; box-sizing: border-box;
      pointer-events: auto;
    `;
    this.modalContainer.addEventListener('click', (e) => {
      if (e.target === this.modalContainer) {
        this.closeModal();
      }
    });
    document.body.appendChild(this.modalContainer);
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

  /** Full-screen lobby: rooms, ranks, operator tools — styled in arcade cabinet aesthetic. */
  public showLobby(): void {
    SoundManager.playUiSound('modal_open');
    const tables = TableSelectionManager.getInstance().getTables();

    const panel = (active: boolean, accent: string) =>
      active
        ? `background:#111827;color:#f8fafc;border:2px solid ${accent};box-shadow:2px 2px 0 #020617;`
        : `background:#0f172a;color:#94a3b8;border:2px solid #475569;box-shadow:2px 2px 0 #020617;`;

    this.modalContainer.innerHTML = `
      <div class="ff-arcade-cabinet" style="
        position: relative;
        width: min(440px, 100%);
        max-height: 90vh;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 20px;
        border: 3px solid #38bdf8;
        background: #090d18;
        box-shadow: 4px 4px 0 #020617;
        color: #fff;
        font-family: var(--font-display, 'Impact', sans-serif);
        text-align: center;
        border-radius: 2px;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:2px solid #1e293b; padding-bottom:8px;">
          <span style="font-size:18px; font-weight:900; font-style:italic; letter-spacing:1px; color:#38bdf8;">
            COMBAT ROOM SELECTION
          </span>
          <button id="lobby-close-btn" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:4px 8px; font-size:11px;">[X]</button>
        </div>

        <!-- Currency Switcher -->
        <div style="margin-bottom:14px;">
          <div style="font-size:10px; letter-spacing:2px; color:#94a3b8; margin-bottom:4px; text-align:left;">CURRENCY</div>
          <div style="display:flex; gap:8px;">
            <button type="button" id="lobby-cur-sc" class="ff-arcade-btn" style="flex:1; padding:8px; ${panel(this.activeCurrency === 'SC', '#38bdf8')}">
              SWEEPS COINS (SC)
            </button>
            <button type="button" id="lobby-cur-gc" class="ff-arcade-btn" style="flex:1; padding:8px; ${panel(this.activeCurrency === 'GC', '#fbbf24')}">
              GOLD COINS (GC)
            </button>
          </div>
        </div>

        <!-- Stake Tiers -->
        <div style="margin-bottom:14px;">
          <div style="font-size:10px; letter-spacing:2px; color:#94a3b8; margin-bottom:4px; text-align:left;">STAKE SELECTION</div>
          <div id="lobby-bet-chips" style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">
            ${this.betTiers.map((b, i) => {
              const on = i === this.currentBetIndex;
              return `<button type="button" class="lobby-bet-chip ff-arcade-btn" data-bet-index="${i}" style="
                ${on
                  ? 'background:#facc15;color:#422006;border-color:#fde047;box-shadow:2px 2px 0 #92400e;'
                  : 'background:#1e293b;color:#e2e8f0;border-color:#475569;'}
                padding: 6px 12px; font-size: 13px; font-family: var(--font-mono, monospace);
              ">${b}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- Quick actions -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
          <button class="lobby-tile ff-arcade-btn ff-arcade-btn-green" data-lobby="store" style="padding:10px;">
            STORE & UPGRADES
          </button>
          <button class="lobby-tile ff-arcade-btn ff-arcade-btn-amber" data-lobby="operator" style="padding:10px;">
            OPERATOR OPS
          </button>
        </div>

        <button id="lobby-resume-btn" class="ff-arcade-btn ff-arcade-btn-primary" style="
          width: 100%;
          padding: 12px;
          font-size: 16px;
          letter-spacing: 2px;
          font-style: italic;
        ">
          ▶ RETURN TO COMBAT
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
        const bet = this.getCurrentBet();
        const cur = this.activeCurrency;
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
        this.closeModal();
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

  public showGameOverModal(data: any): void {
    showGameOverModal({
      ...data,
      onPlayAgain: () => {
        if (this.onPlayCallback) this.onPlayCallback();
      }
    });
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
    const live = WalletService.getInstance().getBalances();
    this.gcBalance = live.goldCoins;
    this.scBalance = live.sweepstakesCoins;

    const bet = this.getCurrentBet();
    const el = document.getElementById('hud-bet-display');
    if (el) el.textContent = bet.toFixed(2);

    const curLabel = document.getElementById('hud-bet-currency-label');
    if (curLabel) curLabel.textContent = this.activeCurrency;

    const turretCoin = document.getElementById('hud-turret-coin');
    if (turretCoin) {
      turretCoin.textContent = this.activeCurrency;
      turretCoin.className = `ff-coin-badge ${this.activeCurrency === 'SC' ? 'ff-coin-sc' : 'ff-coin-gc'}`;
    }

    const coinBadge = document.getElementById('hud-coin-badge');
    if (coinBadge) {
      coinBadge.textContent = this.activeCurrency;
      coinBadge.className = `ff-coin-badge ${this.activeCurrency === 'SC' ? 'ff-coin-sc' : 'ff-coin-gc'}`;
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

  private setCurrency(currency: 'GC' | 'SC'): void {
    const changed = this.activeCurrency !== currency;
    this.activeCurrency = currency;
    if (changed) {
      const defaultIdx = this.betTiers.indexOf(1.0);
      this.currentBetIndex = defaultIdx >= 0 ? defaultIdx : 4;
      SoundManager.playUiSound('currency_toggle');
    }

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
    this.onBetChangeCallback?.(this.getCurrentBet(), this.activeCurrency);
  }

  private audioMode: number = (() => {
    try {
      const v = parseInt(localStorage.getItem('fish_frenzy_audio_mode') || '0', 10);
      return Number.isFinite(v) ? ((v % 4) + 4) % 4 : 0;
    } catch {
      return 0;
    }
  })();

  private applyAudioMode(mode: number): void {
    this.audioMode = ((mode % 4) + 4) % 4;
    try {
      localStorage.setItem('fish_frenzy_audio_mode', String(this.audioMode));
    } catch { /* ignore */ }
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
    this.soundBtn.textContent = icons[this.audioMode] || '🔊';
  }

  private cycleAudioMode(): void {
    this.applyAudioMode(this.audioMode + 1);
    if (this.audioMode !== 1) {
      SoundManager.playUiSound('click');
    }
  }

  /** Clean boss overlay handling without cluttered fighter bars */
  public setBossOverlay(
    active: boolean,
    _secondsLeft?: number,
    _hpPercent?: number,
    _phase?: string,
    _totalDamage?: number
  ): void {
    // Cluttered fighting game boss bars removed per specification
  }

  public showBossFrenzyTitle(): void {
    GameEventBus.getInstance().emit('BOSS_WARNING', {
      name: 'ABYSSAL HORROR BOSS',
      warningMs: 2500
    });
  }

  public setBossBashActive(active: boolean, _sub?: string): void {
    if (active) this.showBossFrenzyTitle();
    else this.setBossOverlay(false);
  }

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

  private paintBalances(): void {
    const activeBalEl = document.getElementById('hud-active-balance');
    const activeCurEl = document.getElementById('hud-active-currency');

    if (activeBalEl) {
      activeBalEl.textContent =
        this.activeCurrency === 'SC'
          ? this.scBalance.toFixed(2)
          : this.gcBalance.toLocaleString();
    }
    if (activeCurEl) {
      activeCurEl.textContent = this.activeCurrency;
      activeCurEl.style.color = this.activeCurrency === 'SC' ? '#38bdf8' : '#fbbf24';
    }

    const lobbyGc = document.getElementById('ff-lobby-gc');
    const lobbySc = document.getElementById('ff-lobby-sc');
    if (lobbyGc) lobbyGc.textContent = this.gcBalance.toLocaleString();
    if (lobbySc) lobbySc.textContent = this.scBalance.toFixed(2);
  }

  public getCurrency(): 'GC' | 'SC' {
    return this.activeCurrency;
  }

  public getStakeCost(): number {
    const units = this.getCurrentBet();
    return this.activeCurrency === 'SC'
      ? WalletService.roundSc(units)
      : Math.max(1, Math.round(units));
  }

  public deductBet(): boolean {
    const wallet = WalletService.getInstance();
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

  private toggleTheme(): void {
    const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.currentTheme = nextTheme;
    this.onThemeChangeCallback?.(nextTheme);
    const hudWrapper = document.getElementById('hud-root-wrapper');
    if (hudWrapper) {
      hudWrapper.className = nextTheme === 'light' ? 'theme-light' : 'theme-dark';
    }
    this.updateThemeToggleUI();
  }

  private updateThemeToggleUI(): void {
    const isLight = this.currentTheme === 'light';
    const lobbyToggle = document.getElementById('lobby-theme-toggle');
    if (lobbyToggle) {
      lobbyToggle.textContent = isLight ? '☀️' : '🌙';
      lobbyToggle.title = `Switch to ${isLight ? 'Dark' : 'Light'} Mode`;
      if (isLight) {
        lobbyToggle.style.color = '#fde047';
        lobbyToggle.style.borderColor = '#e2e8f0';
      } else {
        lobbyToggle.style.color = '#a855f7';
        lobbyToggle.style.borderColor = '#c084fc';
      }
    }

    const hudToggle = document.getElementById('hud-theme-toggle');
    if (hudToggle) {
      hudToggle.innerHTML = `
        <span style="font-size: 14px;">${isLight ? '☀️' : '🌙'}</span>
        <span class="pill-text" style="font-size: 11px;">${isLight ? 'LIGHT' : 'ABYSS'}</span>
      `;
      hudToggle.title = `Switch to ${isLight ? 'Dark' : 'Light'} Mode`;
    }
  }
}
