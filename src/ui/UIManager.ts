import { WalletService } from '../network/WalletService';
import { AuthManager } from '../network/AuthManager';
import { FeatureFlags } from '../config/FeatureFlags';
import { SoundManager } from '../audio/SoundManager';
import { AudioManager } from '../audio/AudioManager';
import { GameTheme, ThemeManager } from '../engine/systems/ThemeManager';
import { PayoutEngine } from '../engine/systems/PayoutEngine';
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
import { GameEventBus } from '../engine/core/GameEvents';
import { ARCADE } from './StyleConstants';
import { KillFeed } from './KillFeed';
import { StreetFighterBossBar } from './StreetFighterBossBar';
import { ArcadeCombatWidgets } from './ArcadeCombatWidgets';

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

  // Sub-widgets
  private killFeed: KillFeed | null = null;
  private bossBar: StreetFighterBossBar | null = null;
  private combatWidgets: ArcadeCombatWidgets | null = null;

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
      pointer-events: none; font-family: var(--font-display, 'Impact', sans-serif);
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

    // Subsystem widgets
    this.killFeed = new KillFeed(this.container);
    this.bossBar = new StreetFighterBossBar(this.container);
    this.combatWidgets = new ArcadeCombatWidgets(this.container);

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
          <button id="ff-start-how-to-play" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:8px; font-size:11px;">
            HOW TO PLAY
          </button>
          <button id="ff-start-options" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:8px; font-size:11px;">
            OPTIONS / AUDIO
          </button>
          <button id="ff-start-tables" type="button" class="ff-arcade-btn ff-arcade-btn-cyan" style="padding:8px; font-size:11px;">
            TABLE SELECT
          </button>
          <button id="ff-start-store" type="button" class="ff-arcade-btn ff-arcade-btn-slate" style="padding:8px; font-size:11px;">
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

    root.querySelector('#ff-start-options')?.addEventListener('click', () => {
      showOptionsModal(this.modalCtx(), (theme) => {
        this.currentTheme = theme;
        this.onThemeChangeCallback?.(theme);
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
    const activeTable = TableSelectionManager.getInstance().getActiveTable();

    this.container.innerHTML = `
      <!-- Street Fighter Arcade Top Bar -->
      <div id="hud-topbar" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        pointer-events: auto;
        gap: 10px;
        flex-wrap: wrap;
        padding: 6px 10px;
        background: rgba(3, 7, 18, 0.92);
        border: 2px solid #38bdf8;
        box-shadow: 0 4px 0 #020617, inset 0 1px 0 rgba(255, 255, 255, 0.1);
        border-radius: 2px;
      ">
        <!-- Top Left: Player Status, Balances & Bet -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <!-- Player Tag (Clickable for dossier) -->
          <div id="hud-player-tag" title="Click to view Pilot Dossier" style="
            background: #0f172a;
            border: 1px solid #475569;
            padding: 3px 8px;
            color: #f8fafc;
            font-size: 12px;
            font-weight: 900;
            font-style: italic;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
          ">
            <span style="color:#38bdf8;">P1</span>
            <span id="hud-player-name">PILOT</span>
          </div>

          <!-- Currency & Balance Pill (Click to toggle) -->
          <button id="hud-currency-toggle" type="button" title="Click to toggle GC / SC" style="
            background: #111827;
            border: 1px solid #38bdf8;
            padding: 3px 8px;
            cursor: pointer;
            display: flex;
            align-items: baseline;
            gap: 4px;
            color: #f8fafc;
            box-shadow: 1px 1px 0 #020617;
          ">
            <span id="hud-active-balance" style="font-size: 14px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono, monospace);">
              ${this.activeCurrency === 'SC' ? this.scBalance.toFixed(2) : this.gcBalance.toLocaleString()}
            </span>
            <span id="hud-active-currency" style="font-size: 10px; font-weight: 900; color: #fbbf24;">
              ${this.activeCurrency}
            </span>
          </button>

          <!-- Hidden balance elements for compatibility -->
          <span id="hud-gc-balance" style="display:none;"></span>
          <span id="hud-sc-balance" style="display:none;"></span>
          <div id="hud-gc-wallet" style="display:none;"></div>
          <div id="hud-sc-wallet" style="display:none;"></div>

          <!-- Bet Steppers -->
          <div style="
            display: flex;
            align-items: center;
            background: #0f172a;
            border: 1px solid #475569;
            border-radius: 2px;
            overflow: hidden;
          ">
            <button id="hud-bet-minus" type="button" style="
              background: #1e293b;
              color: #f8fafc;
              border: none;
              padding: 4px 8px;
              font-weight: 900;
              cursor: pointer;
            ">-</button>
            <span id="hud-bet-display" style="
              padding: 2px 8px;
              font-size: 13px;
              font-weight: 900;
              color: #fbbf24;
              font-family: var(--font-mono, monospace);
              min-width: 58px;
              text-align: center;
            ">${this.getCurrentBet()} ${this.activeCurrency}</span>
            <button id="hud-bet-plus" type="button" style="
              background: #1e293b;
              color: #f8fafc;
              border: none;
              padding: 4px 8px;
              font-weight: 900;
              cursor: pointer;
            ">+</button>
          </div>

          <!-- Level Badge -->
          <button id="hud-level-btn" title="Pilot Progression" style="
            background: #111827;
            border: 1px solid #64748b;
            padding: 3px 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            color: #f8fafc;
          ">
            <span style="font-size: 11px; font-weight: 900; font-style: italic;">LV <span id="hud-level-val">1</span></span>
            <div style="width: 32px; height: 6px; background: #020617; border: 1px solid #475569; overflow: hidden;">
              <div id="hud-level-bar" style="width: 0%; height: 100%; background: #22d3ee;"></div>
            </div>
          </button>
        </div>

        <!-- Top Center: Stage & Combat State -->
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <div style="font-size: 14px; font-weight: 900; font-style: italic; letter-spacing: 2px; color: #f8fafc; text-shadow: 0 2px 4px #000;">
            STAGE 1 // ABYSSAL TRENCH
          </div>
          <div id="hud-combat-status" style="font-size: 10px; font-weight: 900; letter-spacing: 1px; color: #38bdf8;">
            ROUND 1 // COMBAT ACTIVE
          </div>
        </div>

        <!-- Top Right: Action Controls -->
        <div style="display: flex; gap: 6px; align-items: center;">
          <button id="hud-table-btn" class="ff-arcade-btn ff-arcade-btn-slate" style="padding: 4px 8px; font-size: 11px;">
            TABLES
          </button>
          <button id="hud-store-btn" class="ff-arcade-btn ff-arcade-btn-green" style="padding: 4px 8px; font-size: 11px;">
            STORE
          </button>
          <button id="hud-options-btn" class="ff-arcade-btn ff-arcade-btn-slate" style="padding: 4px 8px; font-size: 11px;" title="Options & Audio">
            OPT ⚙
          </button>
          <button id="hud-sound-toggle" class="ff-arcade-btn ff-arcade-btn-slate" style="padding: 4px 8px; font-size: 11px;" title="Sound Output">
            🔊
          </button>
        </div>
      </div>

      <!-- Bottom Status Indicators (Above Turret) -->
      <div style="
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 12px;
        align-items: center;
        pointer-events: none;
        z-index: 20;
      ">
        <div id="hud-bet-badge" style="
          background: rgba(3, 7, 18, 0.88);
          border: 1px solid #38bdf8;
          padding: 3px 10px;
          border-radius: 2px;
          font-weight: 900;
          font-size: 13px;
          font-style: italic;
          color: #38bdf8;
          box-shadow: 2px 2px 0 #020617;
        ">×1.00 SC</div>

        <div id="hud-barrel-badge" style="
          background: rgba(3, 7, 18, 0.88);
          border: 1px solid #fbbf24;
          padding: 3px 8px;
          border-radius: 2px;
          font-weight: 900;
          font-size: 12px;
          font-style: italic;
          color: #fbbf24;
          box-shadow: 2px 2px 0 #020617;
        ">1× BARREL</div>
      </div>
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

    // Player name sync & Pilot Dossier modal
    const syncHudPilotName = () => {
      const pName = document.getElementById('hud-player-name');
      const authState = AuthManager.getInstance().getState();
      if (pName && authState.displayName) {
        pName.textContent = authState.displayName.toUpperCase();
      }
    };
    syncHudPilotName();
    AuthManager.getInstance().onChange(syncHudPilotName);

    document.getElementById('hud-player-tag')?.addEventListener('click', () => {
      showAuthModal(this.modalCtx(), syncHudPilotName);
    });

    this.soundBtn.addEventListener('click', () => this.cycleAudioMode());
    document.getElementById('hud-currency-toggle')?.addEventListener('click', () => this.toggleCurrency());
    document.getElementById('hud-bet-minus')?.addEventListener('click', () => this.adjustBet(-1));
    document.getElementById('hud-bet-plus')?.addEventListener('click', () => this.adjustBet(1));
    document.getElementById('hud-table-btn')?.addEventListener('click', () => this.showLobby());
    document.getElementById('hud-store-btn')?.addEventListener('click', () => this.openStore());
    document.getElementById('hud-options-btn')?.addEventListener('click', () => {
      showOptionsModal(this.modalCtx(), (theme) => {
        this.currentTheme = theme;
        this.onThemeChangeCallback?.(theme);
      });
    });
    document.getElementById('hud-level-btn')?.addEventListener('click', () => showProgressionModal(this.modalCtx()));

    // Subscribe to player progression updates
    if (!this.progressionUnsub) {
      this.progressionUnsub = PlayerProgressionManager.getInstance().subscribe((prog) => {
        this.updateProgressionHud(prog);
      });
    }

    // Subscribe to table changes
    if (!this.tableUnsub) {
      this.tableUnsub = TableSelectionManager.getInstance().onTableChange((tbl) => {
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

    // Operator shortcut
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        this.showAdminPortalModal();
      }
    });
  }

  private updateProgressionHud(prog: PlayerProgressionState): void {
    const lvlVal = document.getElementById('hud-level-val');
    const lvlBar = document.getElementById('hud-level-bar');

    if (lvlVal) lvlVal.textContent = prog.level.toString();
    if (lvlBar) lvlBar.style.width = `${prog.progressPct}%`;
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
    if (el) el.textContent = `${bet.toFixed(2)} ${this.activeCurrency}`;

    const badge = document.getElementById('hud-bet-badge');
    if (badge) {
      badge.textContent = `×${bet.toFixed(2)} ${this.activeCurrency}`;
    }

    const barrelEl = document.getElementById('hud-barrel-badge');
    if (barrelEl) {
      const n = this.getBarrelCount();
      barrelEl.textContent = n > 1 ? `${n}× BARREL` : '1× BARREL';
      barrelEl.style.opacity = n > 1 ? '1' : '0.6';
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

  /** Delegate boss overlay directly to StreetFighterBossBar and event bus */
  public setBossOverlay(
    active: boolean,
    secondsLeft?: number,
    hpPercent?: number,
    phase?: string,
    totalDamage?: number
  ): void {
    if (this.bossBar) {
      if (active) {
        this.bossBar.updateState({
          bossId: 'apex_leviathan',
          name: 'APEX LEVIATHAN',
          hp: hpPercent ?? 100,
          maxHp: 100,
          hpPercent: hpPercent ?? 100,
          phase: (phase as any) || 'engaged',
          timeRemainingSec: secondsLeft ?? 35,
          totalDamage: totalDamage ?? 0,
          multiplier: 2.5
        });
      } else {
        this.bossBar.hide();
      }
    }

    const combatStatus = document.getElementById('hud-combat-status');
    if (combatStatus) {
      if (active) {
        combatStatus.textContent = 'BOSS BATTLE // ENGAGED';
        combatStatus.style.color = phase === 'enraged' ? '#ef4444' : '#fbbf24';
      } else {
        combatStatus.textContent = 'ROUND 1 // COMBAT ACTIVE';
        combatStatus.style.color = '#38bdf8';
      }
    }
  }

  public showBossFrenzyTitle(): void {
    GameEventBus.getInstance().emit('BOSS_WARNING', {
      name: 'APEX LEVIATHAN',
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
}
