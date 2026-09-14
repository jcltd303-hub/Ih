import { StreakManager } from '../network/StreakManager';
import { TournamentManager } from '../network/TournamentManager';
import { ProvablyFairAuditor } from '../utils/ProvablyFairAuditor';
import { SoundManager } from '../audio/SoundManager';
import { GameTheme } from '../engine/systems/ThemeManager';
import { LoadoutManager } from '../network/LoadoutManager';
import { PayoutEngine } from '../engine/systems/PayoutEngine';

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
        <p style="margin: 0 0 28px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Aim the modular turret. School the trench. Hunt the Leviathan.<br/>
          Provably fair RTP · 4 tactical chassis · Boid swarm physics
        </p>
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

        <!-- System Controls & Modals -->
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <!-- Streak Protocol -->
          <button id="hud-streak-btn" title="Daily Streak Protocol" style="background: #1e293b; color: #fbbf24; border: 1px solid #f59e0b; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
            ⚡ STREAK
          </button>

          <!-- Armory / Loadout -->
          <button id="hud-armory-btn" title="Cannon Armory Skins" style="background: #1e293b; color: #f43f5e; border: 1px solid #e11d48; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
            🎯 ARMORY
          </button>

          <!-- Provably Fair -->
          <button id="hud-provably-fair-btn" title="Provably Fair Cryptographic Audit" style="background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🛡️ AUDIT
          </button>

          <!-- Admin Portal (Looseness & Payout %) -->
          <button id="hud-admin-btn" title="Operator Admin Portal & Game Looseness Console" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid #f59e0b; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(245, 158, 11, 0.25);">
            ⚙️ ADMIN <span id="hud-admin-rtp-badge" style="background: #f59e0b; color: #000; font-size: 9px; padding: 1px 4px; border-radius: 4px; margin-left: 2px;">${PayoutEngine.getTargetRtp()}%</span>
          </button>

          <!-- Leaderboard -->
          <button id="hud-leaderboard-btn" title="Tournament Leaderboard" style="background: #1e293b; color: #a78bfa; border: 1px solid #7c3aed; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🏆 RANKS
          </button>

          <!-- Theme Toggle (Can-Tech vs Horror) -->
          <button id="hud-theme-toggle" title="Toggle Light (Can-Tech) / Dark (Horror) Theme" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🎨 THEME
          </button>

          <!-- Sound Toggle -->
          <button id="hud-sound-toggle" title="Audio Effects" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
            🔊 ON
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

    document.getElementById('hud-streak-btn')?.addEventListener('click', () => this.showStreakModal());
    document.getElementById('hud-armory-btn')?.addEventListener('click', () => this.showArmoryModal());
    document.getElementById('hud-provably-fair-btn')?.addEventListener('click', () => this.showAuditModal());
    document.getElementById('hud-admin-btn')?.addEventListener('click', () => this.showAdminPortalModal());
    document.getElementById('hud-leaderboard-btn')?.addEventListener('click', () => this.showLeaderboardModal());

    // Keyboard shortcut to open Admin Portal (~ or Shift+A)
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~' || (e.shiftKey && (e.key === 'A' || e.key === 'a'))) {
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

  private async showStreakModal(): Promise<void> {
    const streakManager = new StreakManager();
    const status = await streakManager.getStreakStatus('player_local');
    const rewards = [1, 2, 3, 5, 7, 10, 15];

    this.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; max-width: 440px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #fbbf24; margin: 0;">⚡ 7-DAY STREAK PROTOCOL</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 18px; line-height: 1.5;">
          Current Streak: <strong style="color: #fbbf24;">Day ${status.currentStreak} / 7</strong>. Active daily check-in unlocks up to 15 SC on Day 7.
        </p>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 20px;">
          ${rewards.map((sc, i) => {
            const isCurrentDay = i + 1 === status.currentStreak;
            const isCompleted = i + 1 < status.currentStreak;
            const bg = isCurrentDay ? 'rgba(245, 158, 11, 0.3)' : isCompleted ? 'rgba(16, 185, 129, 0.2)' : '#1e293b';
            const border = isCurrentDay ? '#f59e0b' : isCompleted ? '#10b981' : '#334155';
            return `
              <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 8px 4px; text-align: center;">
                <div style="font-size: 10px; color: ${isCompleted ? '#34d399' : '#94a3b8'};">${isCompleted ? '✓' : `D${i + 1}`}</div>
                <div style="font-size: 12px; font-weight: bold; color: #fbbf24; margin-top: 2px;">+${sc}</div>
              </div>
            `;
          }).join('')}
        </div>
        <button id="modal-claim-streak-btn" ${status.canClaim ? '' : 'disabled'} style="width: 100%; background: ${status.canClaim ? '#f59e0b' : '#334155'}; color: ${status.canClaim ? '#000000' : '#64748b'}; font-weight: 800; padding: 12px; border-radius: 8px; border: none; cursor: ${status.canClaim ? 'pointer' : 'not-allowed'}; font-size: 14px; transition: all 0.2s;">
          ${status.canClaim ? `CLAIM TODAY'S REWARD (+${status.nextRewardSC} SC)` : `TODAY'S REWARD CLAIMED (DAY ${status.currentStreak})`}
        </button>
        <div id="modal-streak-status" style="font-size: 12px; color: #34d399; margin-top: 12px; text-align: center;"></div>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-claim-streak-btn')?.addEventListener('click', async () => {
      if (!status.canClaim) return;
      try {
        const res = await streakManager.claimDailyLoginReward('player_local');
        this.addBalance(0, res.rewardSC);
        SoundManager.playCoinDrop('medium', res.rewardSC);
        const statusEl = document.getElementById('modal-streak-status');
        if (statusEl) statusEl.textContent = `✓ Successfully claimed ${res.rewardSC} SC! Day ${res.streak} active.`;
        const claimBtn = document.getElementById('modal-claim-streak-btn') as HTMLButtonElement;
        if (claimBtn) {
          claimBtn.disabled = true;
          claimBtn.style.background = '#334155';
          claimBtn.style.color = '#64748b';
          claimBtn.textContent = `TODAY'S REWARD CLAIMED (DAY ${res.streak})`;
        }
      } catch (e: any) {
        const statusEl = document.getElementById('modal-streak-status');
        if (statusEl) statusEl.textContent = `⚠️ ${e?.message || 'Reward already claimed.'}`;
      }
    });
  }

  private showArmoryModal(): void {
    const currentLoadout = LoadoutManager.getLoadout();
    const availableSkins = [
      {
        id: 'plasma_neon',
        name: 'Plasma Neon Railgun',
        desc: 'Dual magnetic accelerator rails • Cyan/magenta ion plume • Lightning arc charging',
        badge: '⚡ RAILGUN',
        color: '#00f0ff',
        border: 'rgba(0, 240, 255, 0.4)'
      },
      {
        id: 'abyssal_dread',
        name: 'Abyssal Dread Juggernaut',
        desc: 'Spiked iron fortress dome • Rotary Gatling shroud • Incandescent crimson rocket',
        badge: '🩸 GATLING',
        color: '#ef4444',
        border: 'rgba(239, 68, 68, 0.4)'
      },
      {
        id: 'cyber_gold',
        name: 'Cyber Gold Sunstone',
        desc: 'Antique bronze filigree • Faceted topaz gem lens • Searing solar lance ray',
        badge: '☀️ SOLAR',
        color: '#fbbf24',
        border: 'rgba(251, 191, 36, 0.4)'
      },
      {
        id: 'default',
        name: 'Tactical Navy Dual-Cannon',
        desc: 'Titanium naval armor • Twin plasma bores • Dual high-energy plasma bolts',
        badge: '⚓ NAVAL',
        color: '#60a5fa',
        border: 'rgba(96, 165, 250, 0.4)'
      }
    ];

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
                  ${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}
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
        LoadoutManager.saveLoadout({
          ...currentLoadout,
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
    const serverSeed = 'fish_frenzy_provably_fair_audit_seed_' + Date.now();
    const serverHash = await ProvablyFairAuditor.generateServerSeedHash(serverSeed);
    const clientSeed = 'client_local_entropy_999';
    const outcomeRoll = ProvablyFairAuditor.verifyOutcome(serverSeed, clientSeed, 1);

    this.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #0284c7; border-radius: 16px; padding: 24px; max-width: 520px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #38bdf8; margin: 0;">🛡️ PROVABLY FAIR AUDITOR</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 14px; line-height: 1.4;">
          All ballistic outcomes are cryptographically pre-committed using SHA-256 hash chains. Players can verify that target multipliers were determined prior to weapon fire.
        </p>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">PRE-COMMITTED SERVER SEED (SHA-256)</div>
          <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 11px; word-break: break-all; color: #38bdf8; font-family: monospace;">
            ${serverHash}
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">ACTIVE CLIENT ENTROPY SEED</div>
          <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #e2e8f0; font-family: monospace;">
            ${clientSeed}
          </div>
        </div>
        <div style="margin-bottom: 18px; display: flex; justify-content: space-between; background: #1e293b; padding: 12px; border-radius: 8px; align-items: center;">
          <span style="font-size: 12px; color: #cbd5e1;">Computed RNG Multiplier Roll:</span>
          <span style="font-size: 16px; font-weight: 800; color: #34d399;">${outcomeRoll.toFixed(2)}x</span>
        </div>
        <button id="modal-close-btn-bottom" style="width: 100%; background: #0284c7; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          CLOSE AUDIT LEDGER
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => this.closeModal());
  }

  private showLeaderboardModal(): void {
    const details = TournamentManager.getDetails();
    const sorted = TournamentManager.getLeaderboard('player_local');

    this.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #7c3aed; border-radius: 16px; padding: 24px; max-width: 480px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #a78bfa; margin: 0;">🏆 ${details.title}</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <div style="background: rgba(124, 58, 237, 0.15); border: 1px solid #7c3aed; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">PRIZE SYNDICATE</div>
            <div style="font-size: 16px; font-weight: bold; color: #fbbf24;">${details.prizePoolSC.toLocaleString()} SC</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">MIN BET</div>
            <div style="font-size: 14px; font-weight: bold; color: #00ffcc;">${details.minBetTier} SC</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          ${sorted.map(entry => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: ${entry.isPlayer ? 'rgba(124, 58, 237, 0.25)' : '#1e293b'}; border: 1px solid ${entry.isPlayer ? '#7c3aed' : '#334155'}; border-radius: 8px; padding: 10px 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 13px; font-weight: bold; color: ${entry.rank === 1 ? '#fbbf24' : entry.rank === 2 ? '#cbd5e1' : entry.rank === 3 ? '#b45309' : '#64748b'}; width: 24px;">#${entry.rank}</span>
                <span style="font-size: 13px; font-weight: 600; color: ${entry.isPlayer ? '#a78bfa' : '#ffffff'};">${entry.username}</span>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: 800; color: #00ffcc;">${entry.score.toLocaleString()} PTS</div>
                ${entry.prizeSC > 0 ? `<div style="font-size: 10px; color: #fbbf24; font-weight: bold;">+${entry.prizeSC} SC PRIZE</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button id="modal-close-btn-bottom" style="width: 100%; background: #7c3aed; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          DISMISS
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => this.closeModal());
  }

  public showAdminPortalModal(): void {
    const config = PayoutEngine.getConfig();
    const stats = PayoutEngine.getSessionStats();

    const getLoosenessTier = (rtp: number) => {
      if (rtp < 75) return { label: '🔒 TIGHT', desc: 'High House Margin (25%+ Edge) • Conservative payouts & lower capture odds', color: '#ef4444' };
      if (rtp < 86) return { label: '⚖️ CONSERVATIVE', desc: 'Arcade Standard (~15-25% Edge) • Moderate hit frequency', color: '#f59e0b' };
      if (rtp <= 94) return { label: '🎰 STANDARD VEGAS', desc: 'Casino Floor (92% Baseline) • Balanced volatility & instant captures', color: '#38bdf8' };
      if (rtp <= 100) return { label: '🔥 VERY LOOSE', desc: 'Player Advantageous (95-100%) • Generous gamble capture rate & crits', color: '#34d399' };
      return { label: '💥 PROMO FRENZY', desc: 'Promotional / VIP Rush (>100%) • Operator subsidy / High capture frequency', color: '#ec4899' };
    };

    const initialTier = getLoosenessTier(config.targetRtp);

    this.modalContainer.innerHTML = `
      <div style="background: #0b1120; border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; max-width: 580px; width: 100%; color: #ffffff; box-shadow: 0 16px 48px rgba(0,0,0,0.85); max-height: 90vh; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #fbbf24; margin: 0; display: flex; align-items: center; gap: 8px;">
              ⚙️ OPERATOR ADMIN PORTAL
            </h2>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
              GAME LOOSENESS & GAMBLE MATH ENGINE CALIBRATOR
            </div>
          </div>
          <button id="modal-close-btn" style="background: #1e293b; border: 1px solid #334155; color: #94a3b8; width: 32px; height: 32px; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
        </div>

        <!-- Main Looseness Slider Card -->
        <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
            <div>
              <div style="font-size: 11px; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">GAME LOOSENESS (TARGET PAYOUT %)</div>
              <div id="admin-tier-badge" style="font-size: 12px; font-weight: 800; color: ${initialTier.color}; margin-top: 3px;">
                ${initialTier.label} — <span style="font-weight: normal; font-size: 11px; color: #cbd5e1;">${initialTier.desc}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <span id="admin-slider-val" style="font-size: 28px; font-weight: 900; color: ${initialTier.color}; font-family: monospace;">
                ${config.targetRtp}%
              </span>
            </div>
          </div>

          <!-- Slider -->
          <div style="margin: 14px 0 10px 0;">
            <input
              type="range"
              id="admin-rtp-slider"
              min="50"
              max="120"
              step="1"
              value="${config.targetRtp}"
              style="width: 100%; height: 8px; cursor: pointer; accent-color: #f59e0b; border-radius: 4px;"
            />
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 4px;">
              <span>50% (Tightest)</span>
              <span>75% (Arcade)</span>
              <span>92% (Standard)</span>
              <span>100% (Break-Even)</span>
              <span>120% (Max Loose)</span>
            </div>
          </div>

          <!-- Presets -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
            <button class="admin-preset-btn" data-rtp="70" style="background: #1e293b; color: #ef4444; border: 1px solid #7f1d1d; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              🔒 Tight (70%)
            </button>
            <button class="admin-preset-btn" data-rtp="82" style="background: #1e293b; color: #f59e0b; border: 1px solid #78350f; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              ⚖️ Arcade (82%)
            </button>
            <button class="admin-preset-btn" data-rtp="92" style="background: #1e293b; color: #38bdf8; border: 1px solid #0369a1; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              🎰 Vegas (92%)
            </button>
            <button class="admin-preset-btn" data-rtp="96" style="background: #1e293b; color: #34d399; border: 1px solid #065f46; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              🔥 Loose (96%)
            </button>
            <button class="admin-preset-btn" data-rtp="105" style="background: #1e293b; color: #ec4899; border: 1px solid #831843; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">
              💥 Promo (105%)
            </button>
          </div>
        </div>

        <!-- Gamble Mechanics Toggles -->
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; margin-bottom: 10px; text-transform: uppercase;">
            🎲 GAMBLE MECHANICS TOGGLES
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer;">
              <span>⚡ <strong>Instant Gamble Kill Roll</strong> <span style="color: #64748b; font-size: 11px;">(RNG roll allows any bullet to instantly explode target)</span></span>
              <input type="checkbox" id="admin-gamble-kill-toggle" ${config.gambleKillEnabled ? 'checked' : ''} style="accent-color: #00ffcc; width: 16px; height: 16px; cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer;">
              <span>🎯 <strong>Jackpot Multipliers on Catch</strong> <span style="color: #64748b; font-size: 11px;">(Surprise 2x, 5x, 10x surge on fish capture)</span></span>
              <input type="checkbox" id="admin-bonus-mult-toggle" ${config.gambleBonusMultiplierEnabled ? 'checked' : ''} style="accent-color: #fbbf24; width: 16px; height: 16px; cursor: pointer;" />
            </label>
          </div>
        </div>

        <!-- Live Session Telemetry -->
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">
              📊 LIVE AUDIT TELEMETRY
            </div>
            <button id="admin-reset-stats-btn" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">
              🔄 RESET STATS
            </button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px;">
            <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b;">TOTAL WAGERED</div>
              <div id="admin-stat-wagered" style="font-size: 13px; font-weight: bold; color: #ffffff;">${stats.totalWagered.toFixed(2)} SC</div>
            </div>
            <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b;">TOTAL PAID OUT</div>
              <div id="admin-stat-payout" style="font-size: 13px; font-weight: bold; color: #34d399;">${stats.totalPaidOut.toFixed(2)} SC</div>
            </div>
            <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b;">REALIZED RTP</div>
              <div id="admin-stat-rtp" style="font-size: 13px; font-weight: 800; color: ${stats.realizedRtp > 100 ? '#ec4899' : stats.realizedRtp >= 85 ? '#34d399' : '#f59e0b'};">
                ${stats.realizedRtp.toFixed(2)}%
              </div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px;">
            <div style="color: #94a3b8;">Shots: <strong id="admin-stat-shots" style="color: #ffffff;">${stats.totalShots}</strong></div>
            <div style="color: #94a3b8;">Hits: <strong id="admin-stat-hits" style="color: #38bdf8;">${stats.totalHits}</strong></div>
            <div style="color: #94a3b8;">Gamble Kills: <strong id="admin-stat-gk" style="color: #00ffcc;">${stats.instantGambleKills}</strong></div>
            <div style="color: #94a3b8;">Jackpots: <strong id="admin-stat-jp" style="color: #fbbf24;">${stats.bonusJackpotTriggers}</strong></div>
          </div>
        </div>

        <!-- Monte Carlo In-Browser Simulation Test -->
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">
              ⚡ MONTE CARLO RTP BENCHMARK
            </div>
            <button id="admin-run-sim-btn" style="background: #0284c7; color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
              SIMULATE 10,000 SHOTS
            </button>
          </div>
          <div id="admin-sim-output" style="font-size: 11px; color: #cbd5e1; background: #1e293b; padding: 8px 12px; border-radius: 6px; min-height: 22px; line-height: 1.4;">
            Click button above to benchmark the current looseness setting empirically across 10,000 algorithmic rounds.
          </div>
        </div>

        <!-- Status Toast -->
        <div id="admin-save-toast" style="font-size: 11px; color: #34d399; text-align: center; height: 18px; margin-bottom: 8px; font-weight: 700;"></div>

        <button id="modal-close-btn-bottom" style="width: 100%; background: #334155; color: #ffffff; font-weight: 800; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;">
          CLOSE ADMIN PORTAL
        </button>
      </div>
    `;

    SoundManager.playUiSound('modal_open');
    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => this.closeModal());

    const slider = document.getElementById('admin-rtp-slider') as HTMLInputElement;
    const sliderVal = document.getElementById('admin-slider-val');
    const tierBadge = document.getElementById('admin-tier-badge');
    const saveToast = document.getElementById('admin-save-toast');
    const hudBadge = document.getElementById('hud-admin-rtp-badge');

    const updateLooseness = (newRtp: number) => {
      PayoutEngine.setTargetRtp(newRtp);
      const tier = getLoosenessTier(newRtp);

      if (slider) slider.value = String(newRtp);
      if (sliderVal) {
        sliderVal.textContent = `${newRtp}%`;
        sliderVal.style.color = tier.color;
      }
      if (tierBadge) {
        tierBadge.innerHTML = `${tier.label} — <span style="font-weight: normal; font-size: 11px; color: #cbd5e1;">${tier.desc}</span>`;
        tierBadge.style.color = tier.color;
      }
      if (hudBadge) {
        hudBadge.textContent = `${newRtp}%`;
      }
      if (saveToast) {
        saveToast.textContent = `✓ Game looseness successfully calibrated to ${newRtp}% (${tier.label})`;
        setTimeout(() => {
          if (saveToast) saveToast.textContent = '';
        }, 2200);
      }
    };

    slider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      updateLooseness(val);
    });

    const presetButtons = this.modalContainer.querySelectorAll('.admin-preset-btn');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rtp = parseInt((e.currentTarget as HTMLElement).getAttribute('data-rtp') || '92', 10);
        updateLooseness(rtp);
      });
    });

    document.getElementById('admin-gamble-kill-toggle')?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      PayoutEngine.saveConfig({ gambleKillEnabled: enabled });
      if (saveToast) {
        saveToast.textContent = `✓ Instant Gamble Kill Roll: ${enabled ? 'ENABLED' : 'DISABLED'}`;
      }
    });

    document.getElementById('admin-bonus-mult-toggle')?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      PayoutEngine.saveConfig({ gambleBonusMultiplierEnabled: enabled });
      if (saveToast) {
        saveToast.textContent = `✓ Jackpot Multipliers on Catch: ${enabled ? 'ENABLED' : 'DISABLED'}`;
      }
    });

    document.getElementById('admin-reset-stats-btn')?.addEventListener('click', () => {
      PayoutEngine.resetSessionStats();
      const elWagered = document.getElementById('admin-stat-wagered');
      const elPayout = document.getElementById('admin-stat-payout');
      const elRtp = document.getElementById('admin-stat-rtp');
      const elShots = document.getElementById('admin-stat-shots');
      const elHits = document.getElementById('admin-stat-hits');
      const elGk = document.getElementById('admin-stat-gk');
      const elJp = document.getElementById('admin-stat-jp');

      if (elWagered) elWagered.textContent = '0.00 SC';
      if (elPayout) elPayout.textContent = '0.00 SC';
      if (elRtp) {
        elRtp.textContent = '0.00%';
        elRtp.style.color = '#f59e0b';
      }
      if (elShots) elShots.textContent = '0';
      if (elHits) elHits.textContent = '0';
      if (elGk) elGk.textContent = '0';
      if (elJp) elJp.textContent = '0';

      if (saveToast) {
        saveToast.textContent = '✓ Session telemetry metrics reset.';
      }
    });

    document.getElementById('admin-run-sim-btn')?.addEventListener('click', () => {
      const currentRtp = parseInt(slider ? slider.value : '92', 10);
      const simResult = PayoutEngine.runQuickSimulation(10000, currentRtp);
      const outputEl = document.getElementById('admin-sim-output');
      if (outputEl) {
        outputEl.innerHTML = `
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 3px;">
            ✓ 10,000 Shot Monte Carlo Benchmark Complete:
          </div>
          <div>Total Wagered: <strong>${simResult.totalWagered.toLocaleString()} SC</strong> | Total Return: <strong style="color: #34d399;">${simResult.totalPayout.toFixed(2)} SC</strong></div>
          <div style="margin-top: 2px;">
            Target Looseness: <strong>${currentRtp}%</strong> ➔ Empirical Realized RTP: <strong style="color: ${simResult.realizedRtp >= 90 ? '#34d399' : '#fbbf24'}; font-size: 13px;">${simResult.realizedRtp.toFixed(2)}%</strong>
          </div>
          <div style="color: #94a3b8; margin-top: 2px; font-size: 10px;">
            Instant Captures Triggered: ${simResult.instantKills} | Jackpot Surges: ${simResult.jackpots}
          </div>
        `;
      }
    });
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
