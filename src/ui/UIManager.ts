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
  private betDisplayEl!: HTMLElement;
  private autoFireBtn!: HTMLElement;
  private currencyBtn!: HTMLElement;
  private themeBtn!: HTMLElement;
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

    this.startScreenEl = document.createElement('div');
    this.startScreenEl.id = 'fish-frenzy-start';
    this.startScreenEl.style.cssText = `
      position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column;
      align-items: center; justify-content: center; pointer-events: auto;
      background: radial-gradient(ellipse at center, rgba(8,16,40,0.55) 0%, rgba(2,4,12,0.88) 70%);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #e2e8f0; text-align: center; padding: 24px; box-sizing: border-box;
    `;
    this.startScreenEl.innerHTML = `
      <div style="max-width: 520px; width: 100%;">
        <div style="font-size: 11px; letter-spacing: 4px; color: #00ffcc; font-weight: 700; margin-bottom: 10px;">
          CYBER TRENCH ARCADE
        </div>
        <h1 style="margin: 0 0 8px; font-size: clamp(28px, 6vw, 42px); font-weight: 900; line-height: 1.1;
          background: linear-gradient(135deg, #00f0ff 0%, #ff007f 50%, #fbbf24 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;">
          FISH FRENZY
        </h1>
        <p style="margin: 0 0 20px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Aim the modular turret. School the trench. Hunt the Leviathan.<br/>
          Provably fair RTP · 4 tactical chassis · Boid swarm physics
        </p>
        <div id="ff-auth-banner" style="
          margin: 0 auto 20px; max-width: 360px; padding: 10px 14px; border-radius: 10px;
          background: rgba(15,23,42,0.85); border: 1px solid #334155; font-size: 11px; color: #94a3b8;
        ">
          <div id="ff-auth-status">Playing as guest — progress is local until you sign in.</div>
          <button id="ff-google-btn" type="button" style="
            margin-top: 10px; background: #1e293b; color: #e2e8f0; border: 1px solid #475569;
            padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;
          ">Sign in with Google to save progress</button>
        </div>
        <button id="ff-play-btn" style="
          background: linear-gradient(135deg, #00ffcc 0%, #0891b2 100%);
          color: #0a0f1d; border: none; padding: 16px 48px; border-radius: 12px;
          font-size: 16px; font-weight: 900; letter-spacing: 2px; cursor: pointer;
          box-shadow: 0 0 28px rgba(0,255,204,0.45); transition: transform 0.15s, box-shadow 0.15s;
        ">▶  PLAY</button>
        <div style="margin-top: 22px; font-size: 11px; color: #64748b;">
          Click / tap to aim &amp; fire · Auto-fire available in HUD
        </div>
      </div>
    `;

    const root = this.container.parentElement || document.body;
    root.appendChild(this.startScreenEl);

    const playBtn = document.getElementById('ff-play-btn');
    playBtn?.addEventListener('click', () => {
      SoundManager.playUiSound('modal_open');
      this.onPlayCallback?.();
    });

    const googleBtn = document.getElementById('ff-google-btn');
    googleBtn?.addEventListener('click', async () => {
      try {
        const { AuthManager } = await import('../network/AuthManager');
        const state = await AuthManager.getInstance().linkGoogle();
        const status = document.getElementById('ff-auth-status');
        if (status) {
          status.textContent = state.isAnonymous
            ? 'Playing as guest — progress is local until you sign in.'
            : `Signed in as ${state.displayName} — wallet will sync when online.`;
        }
        if (googleBtn && !state.isAnonymous) {
          googleBtn.textContent = 'Progress linked';
          (googleBtn as HTMLButtonElement).disabled = true;
        }
        SoundManager.playUiSound('modal_open');
      } catch (e: any) {
        const status = document.getElementById('ff-auth-status');
        if (status) status.textContent = e?.message || 'Sign-in failed. You can still play as guest.';
      }
    });

    // Reflect current auth state on banner
    import('../network/AuthManager').then(({ AuthManager }) => {
      AuthManager.getInstance().ensureSignedIn().then((state) => {
        const status = document.getElementById('ff-auth-status');
        if (!status) return;
        if (!state.configured) {
          status.textContent = 'Offline arcade mode — set VITE_FIREBASE_* to enable cloud wallet.';
        } else if (state.isAnonymous) {
          status.textContent = `Guest · ${state.displayName} — sign in to save progress.`;
        } else {
          status.textContent = `Signed in as ${state.displayName}`;
          const btn = document.getElementById('ff-google-btn') as HTMLButtonElement | null;
          if (btn) { btn.textContent = 'Progress linked'; btn.disabled = true; }
        }
      }).catch(() => {});
    });
    playBtn?.addEventListener('mouseenter', () => {
      if (playBtn) {
        playBtn.style.transform = 'scale(1.05)';
        playBtn.style.boxShadow = '0 0 40px rgba(0,255,204,0.7)';
      }
    });
    playBtn?.addEventListener('mouseleave', () => {
      if (playBtn) {
        playBtn.style.transform = 'scale(1)';
        playBtn.style.boxShadow = '0 0 28px rgba(0,255,204,0.45)';
      }
    });
  }

  public hideStartScreen(): void {
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

          <!-- Currency Switcher Toggle -->
          <button id="hud-currency-toggle" style="background: #1e293b; color: #00ffcc; border: 1px solid #334155; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 11px; transition: all 0.2s;">
            MODE: SC
          </button>
        </div>

        <!-- Lobby + essentials only (shop/streak/admin live in Lobby) -->
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <button id="hud-lobby-btn" title="Open Lobby" style="background: linear-gradient(135deg,#0f766e,#155e75); color: #ecfeff; border: 1px solid #22d3ee; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; box-shadow: 0 0 12px rgba(34,211,238,0.25);">
            ⌂ LOBBY
          </button>
          <button id="hud-theme-toggle" title="Toggle theme" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🎨
          </button>
          <button id="hud-sound-toggle" title="Audio" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🔊
          </button>
        </div>
      </div>

      <!-- BOTTOM TACTICAL WEAPON HUD -->
      <div id="hud-bottombar" style="display: flex; justify-content: center; align-items: center; width: 100%; pointer-events: auto; padding-bottom: 8px; gap: 16px; flex-wrap: wrap;">
        <!-- Auto Fire Toggle -->
        <button id="hud-autofire-btn" style="background: #1e293b; color: #94a3b8; border: 1px solid #475569; padding: 12px 18px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; transition: all 0.2s;">
          AUTO-FIRE: OFF
        </button>

        <!-- Bet Selector Console -->
        <div style="background: rgba(15, 23, 42, 0.94); border: 1px solid #334155; padding: 10px 24px; border-radius: 14px; display: flex; align-items: center; gap: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
          <button id="hud-bet-decrease" style="background: #1e293b; color: #ffffff; border: 1px solid #475569; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center;">
            -
          </button>
          <div style="text-align: center; min-width: 90px;">
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">BET TIER</div>
            <div id="hud-bet-display" style="font-size: 20px; color: #ffb703; font-weight: 800;">
              ${this.getCurrentBet()} ${this.activeCurrency}
            </div>
          </div>
          <button id="hud-bet-increase" style="background: #1e293b; color: #ffffff; border: 1px solid #475569; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center;">
            +
          </button>
        </div>

        <!-- Target Lock Tip -->
        <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; text-align: left; max-width: 140px; line-height: 1.3;">
          CLICK TO TARGET<br/>
          <span style="color: #00ffcc;">APEX BOSS: 100x</span>
        </div>
      </div>
    `;

    // Reference elements
    this.gcBalanceEl = document.getElementById('hud-gc-balance')!;
    this.scBalanceEl = document.getElementById('hud-sc-balance')!;
    this.betDisplayEl = document.getElementById('hud-bet-display')!;
    this.autoFireBtn = document.getElementById('hud-autofire-btn')!;
    this.currencyBtn = document.getElementById('hud-currency-toggle')!;
    this.themeBtn = document.getElementById('hud-theme-toggle')!;
    this.soundBtn = document.getElementById('hud-sound-toggle')!;

    // Event listeners
    document.getElementById('hud-bet-decrease')?.addEventListener('click', () => this.adjustBet(-1));
    document.getElementById('hud-bet-increase')?.addEventListener('click', () => this.adjustBet(1));

    this.currencyBtn.addEventListener('click', () => this.toggleCurrency());
    this.autoFireBtn.addEventListener('click', () => this.toggleAutoFire());
    this.themeBtn.addEventListener('click', () => this.toggleTheme());
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


  private adjustBet(direction: number): void {
    const newIndex = Math.max(0, Math.min(this.betTiers.length - 1, this.currentBetIndex + direction));
    if (newIndex !== this.currentBetIndex) {
      SoundManager.playUiSound(direction > 0 ? 'chip_up' : 'chip_down');
    }
    this.currentBetIndex = newIndex;
    this.betDisplayEl.textContent = `${this.getCurrentBet()} ${this.activeCurrency}`;
    if (this.onBetChangeCallback) {
      this.onBetChangeCallback(this.getCurrentBet(), this.activeCurrency);
    }
  }

  private toggleCurrency(): void {
    SoundManager.playUiSound('currency_toggle');
    this.activeCurrency = this.activeCurrency === 'SC' ? 'GC' : 'SC';
    this.currencyBtn.textContent = `MODE: ${this.activeCurrency}`;
    this.currencyBtn.style.color = this.activeCurrency === 'SC' ? '#00ffcc' : '#fbbf24';
    this.betDisplayEl.textContent = `${this.getCurrentBet()} ${this.activeCurrency}`;
    if (this.onBetChangeCallback) {
      this.onBetChangeCallback(this.getCurrentBet(), this.activeCurrency);
    }
  }

  private toggleAutoFire(): void {
    this.autoFireEnabled = !this.autoFireEnabled;
    SoundManager.playUiSound(this.autoFireEnabled ? 'autofire_on' : 'autofire_off');
    this.autoFireBtn.textContent = `AUTO-FIRE: ${this.autoFireEnabled ? 'ON' : 'OFF'}`;
    this.autoFireBtn.style.background = this.autoFireEnabled ? '#00ffcc' : '#1e293b';
    this.autoFireBtn.style.color = this.autoFireEnabled ? '#000000' : '#94a3b8';

    if (this.onAutoFireToggleCallback) {
      this.onAutoFireToggleCallback(this.autoFireEnabled);
    }
  }

  private toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themeBtn.textContent = this.currentTheme === 'light' ? '🎨 CAN-TECH' : '💀 HORROR';
    if (this.onThemeChangeCallback) {
      this.onThemeChangeCallback(this.currentTheme);
    }
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
      this.scBalanceEl.textContent = this.scBalance.toFixed(2);
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
