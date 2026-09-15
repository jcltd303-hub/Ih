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

        <!-- LOBBY SETTINGS: AUDIO & THEME -->
        <style>
          @keyframes ff-insistent-bounce {
            0% {
              transform: translateY(-8px) scale(0.95);
              filter: drop-shadow(0 0 6px rgba(0, 255, 204, 0.6));
            }
            50% {
              transform: translateY(6px) scale(1.22);
              filter: drop-shadow(0 0 18px rgba(0, 255, 204, 1)) drop-shadow(0 0 28px rgba(255, 215, 0, 0.9));
            }
            100% {
              transform: translateY(-8px) scale(0.95);
              filter: drop-shadow(0 0 6px rgba(0, 255, 204, 0.6));
            }
          }
          @keyframes ff-pulse-border {
            0% { box-shadow: 0 0 12px rgba(0, 220, 255, 0.3), inset 0 0 10px rgba(0, 220, 255, 0.1); }
            100% { box-shadow: 0 0 28px rgba(0, 255, 204, 0.65), inset 0 0 18px rgba(0, 255, 204, 0.25); }
          }
          @keyframes ff-hand-beacon {
            0% { transform: scale(0.85); opacity: 0.85; }
            100% { transform: scale(1.6); opacity: 0; }
          }
        </style>

        <div style="
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(56, 189, 248, 0.3);
          margin-bottom: 14px;
          text-align: left;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.15em; color: #38bdf8;">
              LOBBY SETTINGS · AUDIO &amp; ENVIRONMENT
            </div>
            <div style="font-size: 10px; color: #94a3b8;" id="ff-active-theme-label">CAN-TECH THEME</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <button id="ff-lobby-bgm" style="
              padding: 9px 12px;
              border-radius: 8px;
              border: 1.5px solid ${SoundManager.isBgmEnabled() ? '#00ffcc' : '#475569'};
              background: ${SoundManager.isBgmEnabled() ? 'rgba(0, 255, 204, 0.18)' : 'rgba(30, 41, 59, 0.8)'};
              color: ${SoundManager.isBgmEnabled() ? '#00ffcc' : '#94a3b8'};
              font-size: 11px;
              font-weight: 800;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">
              <span>🎵</span> <span id="ff-lobby-bgm-text">MUSIC: ${SoundManager.isBgmEnabled() ? 'ON' : 'OFF'}</span>
            </button>

            <button id="ff-lobby-sfx" style="
              padding: 9px 12px;
              border-radius: 8px;
              border: 1.5px solid ${SoundManager.isSoundEnabled() ? '#38bdf8' : '#475569'};
              background: ${SoundManager.isSoundEnabled() ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.8)'};
              color: ${SoundManager.isSoundEnabled() ? '#38bdf8' : '#94a3b8'};
              font-size: 11px;
              font-weight: 800;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">
              <span>🔊</span> <span id="ff-lobby-sfx-text">SFX: ${SoundManager.isSoundEnabled() ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button data-theme="can-tech" id="ff-theme-can" style="
              padding: 8px 10px;
              border-radius: 8px;
              border: 1.5px solid #00d9ff;
              background: rgba(0, 217, 255, 0.22);
              color: #ffffff;
              font-size: 11px;
              font-weight: 800;
              cursor: pointer;
            ">⚡ CAN-TECH (ARCADE)</button>

            <button data-theme="horror" id="ff-theme-horror" style="
              padding: 8px 10px;
              border-radius: 8px;
              border: 1.5px solid rgba(255, 60, 80, 0.35);
              background: rgba(255, 60, 80, 0.08);
              color: #ff99aa;
              font-size: 11px;
              font-weight: 800;
              cursor: pointer;
            ">🩸 HORROR (DREAD)</button>
          </div>
        </div>

        <!-- INTRO TUTORIAL WITH INSISTENT HAND ICON PULSING ABOVE -->
        <div id="ff-intro-tutorial" style="
          position: relative;
          margin: 14px 0 10px;
          padding: 14px 16px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(0, 220, 255, 0.14), rgba(16, 185, 129, 0.12));
          border: 1.5px solid #00ffcc;
          animation: ff-pulse-border 1.5s infinite alternate ease-in-out;
          text-align: center;
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.16em;
            color: #00ffcc;
            margin-bottom: 6px;
            text-transform: uppercase;
          ">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#00ffcc;box-shadow:0 0 10px #00ffcc;"></span>
            TUTORIAL BRIEFING · CADET PROTOCOL
          </div>

          <div id="ff-tutorial-text" style="
            font-size: 13px;
            font-weight: 700;
            color: #f8fafc;
            line-height: 1.4;
            margin-bottom: 8px;
          ">
            Click the button directly under the insistent pulsing hand below to begin!
          </div>

          <!-- The insistent hand icon pulsing above the button -->
          <div id="ff-insistent-hand-container" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: 4px;
            cursor: pointer;
          ">
            <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
              <div style="
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background: rgba(0, 255, 204, 0.3);
                animation: ff-hand-beacon 1.2s infinite ease-out;
              "></div>
              <div id="ff-insistent-hand" style="
                font-size: 38px;
                line-height: 1;
                display: inline-block;
                animation: ff-insistent-bounce 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
                user-select: none;
              ">👇</div>
            </div>
            <div style="
              font-size: 10px;
              font-weight: 900;
              letter-spacing: 0.2em;
              color: #00ffcc;
              text-shadow: 0 0 10px rgba(0, 255, 204, 0.85);
              margin-top: 2px;
            ">CLICK BUTTON UNDER HAND</div>
          </div>
        </div>

        <button id="ff-play" style="
          width:100%;
          padding:17px;
          border:2px solid #00ffcc;
          border-radius:12px;
          background:linear-gradient(135deg,#00d9ff,#176cff);
          color:#001018;
          font-size:18px;
          font-weight:900;
          letter-spacing:.08em;
          cursor:pointer;
          box-shadow:0 0 35px rgba(0,220,255,.45);
          transition:transform 0.1s ease, box-shadow 0.2s ease;
        ">▶ ENTER TRENCH · START HUNT</button>

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

    const playBtn = root.querySelector<HTMLButtonElement>('#ff-play');
    const tutorialText = root.querySelector<HTMLElement>('#ff-tutorial-text');
    const handContainer = root.querySelector<HTMLElement>('#ff-insistent-hand-container');
    const bgmBtn = root.querySelector<HTMLButtonElement>('#ff-lobby-bgm');
    const bgmText = root.querySelector<HTMLElement>('#ff-lobby-bgm-text');
    const sfxBtn = root.querySelector<HTMLButtonElement>('#ff-lobby-sfx');
    const sfxText = root.querySelector<HTMLElement>('#ff-lobby-sfx-text');
    const themeCanBtn = root.querySelector<HTMLButtonElement>('#ff-theme-can');
    const themeHorrorBtn = root.querySelector<HTMLButtonElement>('#ff-theme-horror');
    const activeThemeLabel = root.querySelector<HTMLElement>('#ff-active-theme-label');

    const executeTutorialPlay = () => {
      if (!this.startScreenEl) return;
      if (tutorialText) {
        tutorialText.innerHTML = '<span style="color:#00ffcc;font-weight:900;">✓ TUTORIAL PASSED · TURRET ARMED · COMMENCING COMBAT!</span>';
      }
      SoundManager.playUiSound('click');
      if (this.currentTheme === 'dark') {
        SoundManager.playHorrorWhisper(0.8);
      }
      SoundManager.startBgm();
      setTimeout(() => {
        this.onPlayCallback?.();
      }, 200);
    };

    playBtn?.addEventListener('click', executeTutorialPlay);
    handContainer?.addEventListener('click', executeTutorialPlay);

    bgmBtn?.addEventListener('click', () => {
      const enabled = SoundManager.toggleBgm();
      if (bgmText) bgmText.textContent = `MUSIC: ${enabled ? 'ON' : 'OFF'}`;
      if (bgmBtn) {
        bgmBtn.style.border = `1.5px solid ${enabled ? '#00ffcc' : '#475569'}`;
        bgmBtn.style.background = enabled ? 'rgba(0, 255, 204, 0.18)' : 'rgba(30, 41, 59, 0.8)';
        bgmBtn.style.color = enabled ? '#00ffcc' : '#94a3b8';
      }
    });

    sfxBtn?.addEventListener('click', () => {
      const enabled = SoundManager.toggleSound();
      if (sfxText) sfxText.textContent = `SFX: ${enabled ? 'ON' : 'OFF'}`;
      if (sfxBtn) {
        sfxBtn.style.border = `1.5px solid ${enabled ? '#38bdf8' : '#475569'}`;
        sfxBtn.style.background = enabled ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.8)';
        sfxBtn.style.color = enabled ? '#38bdf8' : '#94a3b8';
      }
    });

    themeCanBtn?.addEventListener('click', () => {
      this.currentTheme = 'light';
      this.onThemeChangeCallback?.('light');
      SoundManager.setTheme('light');
      if (activeThemeLabel) activeThemeLabel.textContent = 'CAN-TECH THEME (ACTIVE)';
      if (themeCanBtn) {
        themeCanBtn.style.border = '1.5px solid #00d9ff';
        themeCanBtn.style.background = 'rgba(0, 217, 255, 0.25)';
        themeCanBtn.style.color = '#ffffff';
      }
      if (themeHorrorBtn) {
        themeHorrorBtn.style.border = '1px solid rgba(255, 60, 80, 0.35)';
        themeHorrorBtn.style.background = 'rgba(255, 60, 80, 0.08)';
        themeHorrorBtn.style.color = '#ff99aa';
      }
    });

    themeHorrorBtn?.addEventListener('click', () => {
      this.currentTheme = 'dark';
      this.onThemeChangeCallback?.('dark');
      SoundManager.setTheme('dark');
      if (activeThemeLabel) activeThemeLabel.textContent = 'ABYSSAL HORROR THEME (ACTIVE)';
      if (themeHorrorBtn) {
        themeHorrorBtn.style.border = '1.5px solid #ff4d6d';
        themeHorrorBtn.style.background = 'rgba(255, 77, 109, 0.25)';
        themeHorrorBtn.style.color = '#ffffff';
      }
      if (themeCanBtn) {
        themeCanBtn.style.border = '1px solid rgba(0, 220, 255, 0.3)';
        themeCanBtn.style.background = 'rgba(0, 180, 255, 0.08)';
        themeCanBtn.style.color = '#94a3b8';
      }
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
          <!-- GC Wallet -->
          <div id="hud-gc-wallet" style="background: rgba(15, 23, 42, 0.88); border: 1px solid #3b82f6; padding: 6px 10px; border-radius: 8px; color: #ffffff; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
            <span id="hud-gc-balance" style="font-size: 13px; font-weight: 700;">${this.gcBalance.toLocaleString()}<sub style="font-size:9px;color:#60a5fa;margin-left:2px;">GC</sub></span>
          </div>

          <!-- SC Wallet -->
          <div id="hud-sc-wallet" style="background: rgba(15, 23, 42, 0.88); border: 2px solid #00ffcc; padding: 6px 10px; border-radius: 8px; color: #ffffff; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,255,204,0.15);">
            <span id="hud-sc-balance" style="font-size: 13px; font-weight: 700; color: #00ffcc;">${this.scBalance.toFixed(2)}<sub style="font-size:9px;color:#00ffcc;margin-left:2px;">SC</sub></span>
          </div>

          <!-- Read-only stake (change in Lobby) -->
          <div id="hud-stake-readonly" style="background: rgba(15, 23, 42, 0.88); border: 1px solid #475569; padding: 6px 10px; border-radius: 8px; color: #e2e8f0; font-size: 11px; font-weight: 700;">
            BET <span id="hud-bet-display">${this.getCurrentBet()} ${this.activeCurrency}</span>
          </div>

          <!-- Table Badge / Switcher -->
          <button id="hud-table-btn" title="Current Arena Table (Click to switch in Lobby)" style="background: rgba(15, 23, 42, 0.88); border: 1.5px solid ${activeTable.badgeColor}; color: ${activeTable.badgeColor}; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <span>🏟️</span>
            <span id="hud-table-btn-label">${activeTable.badge}</span>
          </button>

          <!-- Player Skill Level & Turret Pill -->
          <button id="hud-level-btn" title="Player Skill Level & Progression (Click to view)" style="background: rgba(15, 23, 42, 0.88); border: 1.5px solid #a855f7; padding: 4px 10px; border-radius: 8px; color: #ffffff; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(168,85,247,0.25);">
            <span style="font-size: 12px;">⭐</span>
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
              <div style="display: flex; gap: 4px; font-size: 10px; font-weight: 800;">
                <span style="color: #c084fc;">LVL <span id="hud-level-val">1</span></span>
                <span id="hud-level-name" style="color: #cbd5e1;">GUNNER</span>
              </div>
              <div style="width: 52px; height: 3px; background: #334155; border-radius: 2px; overflow: hidden;">
                <div id="hud-level-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #a855f7, #ec4899); transition: width 0.3s ease;"></div>
              </div>
            </div>
          </button>
        </div>

        <!-- Lobby + essentials only (shop/streak/admin live in Lobby) -->
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <button id="hud-lobby-btn" title="Open Lobby" style="background: linear-gradient(135deg,#0f766e,#155e75); color: #ecfeff; border: 1px solid #22d3ee; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; box-shadow: 0 0 12px rgba(34,211,238,0.25);">
            ⌂ LOBBY
          </button>
          <button id="hud-bgm-toggle" title="Toggle Music" style="background: #1e293b; color: ${SoundManager.isBgmEnabled() ? '#00ffcc' : '#94a3b8'}; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            ${SoundManager.isBgmEnabled() ? '🎵' : '🔇🎵'}
          </button>
          <button id="hud-sound-toggle" title="Toggle Audio Effects" style="background: #1e293b; color: ${SoundManager.isSoundEnabled() ? '#e2e8f0' : '#ef4444'}; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            ${SoundManager.isSoundEnabled() ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      <!-- OVERCHARGE & BOSS OVERDRIVE STATUS PILL -->
      <div id="hud-overcharge-badge" style="display: none; width: fit-content; margin: 6px auto 0; background: linear-gradient(90deg, rgba(239,68,68,0.3), rgba(245,158,11,0.3)); border: 1.5px solid #f59e0b; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 800; color: #fbbf24; box-shadow: 0 0 16px rgba(245,158,11,0.4); pointer-events: none;">
        <span id="hud-overcharge-text">⚡ OVERCHARGE ACTIVE</span>
      </div>

      <!-- ELECTRIC RAGE: BOSS BASH -->
      <div id="hud-boss-bash" style="display:none; position:absolute; left:50%; top:18%; transform:translateX(-50%); z-index:25; pointer-events:none; text-align:center;">
        <div style="font-size:clamp(28px,7vw,52px); font-weight:900; letter-spacing:4px; color:#ff0033;
          text-shadow:0 0 20px #ff0033, 0 0 40px #ff0055, 0 4px 0 #450a0a;
          animation: bossBashPulse 0.6s ease-in-out infinite alternate;">BOSS BASH</div>
        <div id="hud-boss-bash-sub" style="margin-top:6px; font-size:12px; color:#fecaca; font-weight:700;">DEFEAT THE LEVIATHAN</div>
      </div>
      <style>
        @keyframes bossBashPulse {
          from { transform: scale(1); filter: brightness(1); }
          to { transform: scale(1.06); filter: brightness(1.25); }
        }
      </style>

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
    this.tableBadgeBtn = document.getElementById('hud-table-btn');

    // Event listeners
    this.soundBtn.addEventListener('click', () => this.toggleSound());
    document.getElementById('hud-bgm-toggle')?.addEventListener('click', () => this.toggleBgm());
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

    if (ocBadge && ocText) {
      if (prog.isBossUpgradeActive) {
        ocBadge.style.display = 'block';
        ocBadge.style.borderColor = '#ff0055';
        ocBadge.style.background = 'linear-gradient(90deg, rgba(255,0,85,0.35), rgba(244,63,94,0.25))';
        ocBadge.style.boxShadow = '0 0 18px rgba(255,0,85,0.5)';
        ocText.innerHTML = `⚡ BOSS OVERDRIVE ACTIVE <span style="color:#ffffff;font-size:10px;">(+60% DMG · 2x RICOCHET)</span>`;
      } else if (prog.isOvercharged) {
        ocBadge.style.display = 'block';
        ocBadge.style.borderColor = '#f59e0b';
        ocBadge.style.background = 'linear-gradient(90deg, rgba(245,158,11,0.35), rgba(234,179,8,0.25))';
        ocBadge.style.boxShadow = '0 0 16px rgba(245,158,11,0.4)';
        ocText.innerHTML = `⚡ LUCKY OVERCHARGE (${prog.overchargeRemainingSec}s) <span style="color:#ffffff;font-size:10px;">(2x FIRE RATE · +40% DMG)</span>`;
      } else {
        ocBadge.style.display = 'none';
      }
    }
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
    const activeTable = TableSelectionManager.getInstance().getActiveTable();
    const availableTables = TableSelectionManager.getInstance().getTables();

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
          Combat HUD stays clean. Shop, rewards, tables, and operator tools live here.
          Target RTP <strong style="color:#fbbf24;">${rtp}%</strong>
          · House edge ~<strong>${(100 - rtp).toFixed(0)}%</strong>
          · P&amp;L ${profit.isProfitable ? '<span style="color:#34d399">OK</span>' : '<span style="color:#f87171">REVIEW</span>'}
        </p>

        <!-- TABLE SELECTION / ARENA -->
        <div style="margin-bottom:16px;padding:14px;background:#0f172a;border:1px solid #334155;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-size:10px;letter-spacing:2px;color:#22d3ee;font-weight:700;">ARENA SELECTION · MULTIPLAYER &amp; PRACTICE</div>
            <div style="font-size:10px;color:#94a3b8;">ACTIVE: <strong style="color:${activeTable.badgeColor};">${activeTable.name.toUpperCase()}</strong></div>
          </div>
          <div id="lobby-table-notice" style="display:none; padding:8px 10px; margin-bottom:8px; border-radius:8px; font-size:11px; font-weight:700; background:rgba(244,63,94,0.15); border:1px solid #f43f5e; color:#fca5a5;"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${availableTables.map((tbl) => {
              const isSelected = tbl.id === activeTable.id;
              return `
                <div class="lobby-table-card" data-table-id="${tbl.id}" style="
                  padding:12px; border-radius:10px; cursor:pointer;
                  border:1.5px solid ${isSelected ? tbl.badgeColor : '#334155'};
                  background:${isSelected ? 'rgba(30,41,59,0.95)' : '#1e293b'};
                  box-shadow:${isSelected ? `0 0 16px ${tbl.badgeColor}33` : 'none'};
                  transition:all 0.15s ease;
                ">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-weight:900; font-size:13px; color:#ffffff;">${tbl.name}</span>
                      <span style="
                        font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px;
                        background:${tbl.badgeColor}22; color:${tbl.badgeColor}; border:1px solid ${tbl.badgeColor}66;
                      ">${tbl.badge}</span>
                    </div>
                    <span style="font-size:11px; color:#94a3b8;">${tbl.activePlayersCount}/${tbl.maxPlayers} Players</span>
                  </div>
                  <div style="font-size:11px; color:#94a3b8; margin-bottom:8px; line-height:1.35;">${tbl.description}</div>
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px;">
                    <div style="display:flex; gap:10px; color:#cbd5e1;">
                      <span>Stake: <strong style="color:#f8fafc;">${tbl.minStake} ${tbl.allowedCurrencies.join('/')}</strong></span>
                      <span>${tbl.bossRaidEnabled ? '<span style="color:#f43f5e;font-weight:700;">⚡ 90s Boss Raid</span>' : '<span style="color:#64748b;">Solo Sandbox</span>'}</span>
                    </div>
                    <button type="button" class="lobby-table-select-btn" data-table-id="${tbl.id}" style="
                      padding:5px 12px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer;
                      border:${isSelected ? `1px solid ${tbl.badgeColor}` : '1px solid #475569'};
                      background:${isSelected ? tbl.badgeColor : '#0f172a'};
                      color:${isSelected ? '#0b1120' : '#e2e8f0'};
                    ">${isSelected ? '✓ ACTIVE ARENA' : 'JOIN ARENA'}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- LOBBY SETTINGS: AUDIO & THEME CONTROLS -->
        <div style="margin-bottom:16px;padding:14px;background:#0f172a;border:1px solid #334155;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:10px;letter-spacing:2px;color:#22d3ee;font-weight:700;">LOBBY SETTINGS · AUDIO &amp; THEME</div>
            <div style="font-size:10px;color:#94a3b8;">${this.currentTheme === 'dark' ? 'ABYSSAL HORROR' : 'CAN-TECH ARCADE'}</div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" id="lobby-bgm-toggle" style="flex:1;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;border:1.5px solid ${SoundManager.isBgmEnabled()?'#00ffcc':'#475569'};background:${SoundManager.isBgmEnabled()?'rgba(0,255,204,0.16)':'#1e293b'};color:${SoundManager.isBgmEnabled()?'#00ffcc':'#94a3b8'};">
              🎵 MUSIC: ${SoundManager.isBgmEnabled() ? 'ON' : 'OFF'}
            </button>
            <button type="button" id="lobby-sfx-toggle" style="flex:1;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;border:1.5px solid ${SoundManager.isSoundEnabled()?'#38bdf8':'#475569'};background:${SoundManager.isSoundEnabled()?'rgba(56,189,248,0.16)':'#1e293b'};color:${SoundManager.isSoundEnabled()?'#38bdf8':'#94a3b8'};">
              🔊 SFX: ${SoundManager.isSoundEnabled() ? 'ON' : 'OFF'}
            </button>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="lobby-theme-can" style="flex:1;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;border:1.5px solid ${this.currentTheme==='light'?'#00d9ff':'#334155'};background:${this.currentTheme==='light'?'rgba(0,217,255,0.22)':'#1e293b'};color:${this.currentTheme==='light'?'#ffffff':'#94a3b8'};">
              ⚡ CAN-TECH (ARCADE)
            </button>
            <button type="button" id="lobby-theme-horror" style="flex:1;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;border:1.5px solid ${this.currentTheme==='dark'?'#ff4d6d':'#334155'};background:${this.currentTheme==='dark'?'rgba(255,77,109,0.22)':'#1e293b'};color:${this.currentTheme==='dark'?'#ffffff':'#ff99aa'};">
              🩸 HORROR (DREAD)
            </button>
          </div>
        </div>

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
          <button class="lobby-tile" data-lobby="streak" style="text-align:left; background:#1e293b; border:1px solid #f59e0b; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">⚡</div>
            <div style="font-weight:800; color:#fbbf24;">STREAK</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Daily login rewards</div>
          </button>
          ${this.isTournamentSession() ? `
          <button class="lobby-tile" data-lobby="ranks" style="text-align:left; background:#1e293b; border:1px solid #7c3aed; border-radius:12px; padding:14px; cursor:pointer; color:#fff;">
            <div style="font-size:18px; margin-bottom:4px;">🏆</div>
            <div style="font-weight:800; color:#c4b5fd;">RANKS</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Tournament leaderboard</div>
          </button>` : `
          <div style="text-align:left; background:#0f172a; border:1px dashed #334155; border-radius:12px; padding:14px; color:#64748b;">
            <div style="font-size:18px; margin-bottom:4px;">🏆</div>
            <div style="font-weight:800;">RANKS</div>
            <div style="font-size:11px; margin-top:4px;">Join a tournament table to unlock</div>
          </div>`}
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
    document.getElementById('lobby-bgm-toggle')?.addEventListener('click', () => {
      SoundManager.toggleBgm();
      this.showLobby();
    });
    document.getElementById('lobby-sfx-toggle')?.addEventListener('click', () => {
      SoundManager.toggleSound();
      this.showLobby();
    });
    document.getElementById('lobby-theme-can')?.addEventListener('click', () => {
      this.currentTheme = 'light';
      this.onThemeChangeCallback?.('light');
      SoundManager.setTheme('light');
      this.showLobby();
    });
    document.getElementById('lobby-theme-horror')?.addEventListener('click', () => {
      this.currentTheme = 'dark';
      this.onThemeChangeCallback?.('dark');
      SoundManager.setTheme('dark');
      this.showLobby();
    });
    this.modalContainer.querySelectorAll('.lobby-bet-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).getAttribute('data-bet-index') || '0', 10);
        this.setBetIndex(idx);
        this.showLobby();
      });
    });

    // Table selection click handlers
    this.modalContainer.querySelectorAll('.lobby-table-card, .lobby-table-select-btn').forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tid = (el as HTMLElement).getAttribute('data-table-id');
        if (!tid) return;
        const res = await TableSelectionManager.getInstance().switchTable(tid);
        if (res.success) {
          SoundManager.playUiSound('click');
          this.showLobby();
        } else {
          const notice = document.getElementById('lobby-table-notice');
          if (notice) {
            notice.textContent = res.reason || 'Could not switch table.';
            notice.style.display = 'block';
          }
        }
      });
    });

    this.modalContainer.querySelectorAll('.lobby-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-lobby');
        if (id === 'store') void showStoreModal(this.modalCtx());
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
    this.soundBtn.textContent = enabled ? '🔊' : '🔇';
    this.soundBtn.style.color = enabled ? '#e2e8f0' : '#ef4444';
  }

  private toggleBgm(): void {
    const enabled = SoundManager.toggleBgm();
    if (enabled) {
      SoundManager.playUiSound('click');
    }
    const bgmBtn = document.getElementById('hud-bgm-toggle');
    if (bgmBtn) {
      bgmBtn.textContent = enabled ? '🎵' : '🔇🎵';
      bgmBtn.style.color = enabled ? '#00ffcc' : '#94a3b8';
    }
  }

  /** Giant BOSS BASH title during raid (Electric Rage). */
  public setBossBashActive(active: boolean, sub?: string): void {
    const el = document.getElementById('hud-boss-bash');
    const subEl = document.getElementById('hud-boss-bash-sub');
    if (el) el.style.display = active ? 'block' : 'none';
    if (subEl && sub) subEl.textContent = sub;
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
    const bet = this.getCurrentBet();
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
      this.gcBalanceEl.innerHTML = `${this.gcBalance.toLocaleString()}<sub style="font-size:9px;color:#60a5fa;margin-left:2px;">GC</sub>`;
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
