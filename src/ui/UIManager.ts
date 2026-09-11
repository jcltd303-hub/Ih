import { StreakManager } from '../network/StreakManager';
import { TournamentManager } from '../network/TournamentManager';
import { ProvablyFairAuditor } from '../utils/ProvablyFairAuditor';
import { SoundManager } from '../audio/SoundManager';
import { GameTheme } from '../engine/systems/ThemeManager';
import { LoadoutManager } from '../network/LoadoutManager';

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

  private currentBetIndex: number = 2; // Default 5 SC
  private betTiers: number[] = [1, 2, 5, 10, 25, 50, 100];
  private gcBalance: number = 10000;
  private scBalance: number = 50.00;
  private activeCurrency: 'GC' | 'SC' = 'SC';
  private autoFireEnabled: boolean = false;
  private currentTheme: GameTheme = 'light';

  private onThemeChangeCallback?: (theme: GameTheme) => void;
  private onAutoFireToggleCallback?: (enabled: boolean) => void;
  private onBetChangeCallback?: (bet: number, currency: 'GC' | 'SC') => void;
  private onLoadoutChangeCallback?: () => void;

  constructor(
    rootElement: HTMLElement,
    callbacks?: {
      onThemeChange?: (theme: GameTheme) => void;
      onAutoFireToggle?: (enabled: boolean) => void;
      onBetChange?: (bet: number, currency: 'GC' | 'SC') => void;
      onLoadoutChange?: () => void;
    }
  ) {
    this.onThemeChangeCallback = callbacks?.onThemeChange;
    this.onAutoFireToggleCallback = callbacks?.onAutoFireToggle;
    this.onBetChangeCallback = callbacks?.onBetChange;
    this.onLoadoutChangeCallback = callbacks?.onLoadoutChange;

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
    document.getElementById('hud-leaderboard-btn')?.addEventListener('click', () => this.showLeaderboardModal());
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
    this.modalContainer.style.display = 'none';
    this.modalContainer.innerHTML = '';
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

    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-claim-streak-btn')?.addEventListener('click', async () => {
      if (!status.canClaim) return;
      try {
        const res = await streakManager.claimDailyLoginReward('player_local');
        this.addBalance(0, res.rewardSC);
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
      { id: 'plasma_neon', name: 'Plasma Neon', desc: 'Electric cyan rail with hyper-pink core', color: '#00ffcc' },
      { id: 'abyssal_dread', name: 'Abyssal Dread', desc: 'Obsidian hull with blood-crimson vents', color: '#ff0055' },
      { id: 'cyber_gold', name: 'Cyber Gold', desc: 'High-relief gold casing & amber collimator', color: '#fbbf24' },
      { id: 'default', name: 'Tactical Navy', desc: 'Military cobalt plating with reinforced bore', color: '#60a5fa' }
    ];

    this.modalContainer.innerHTML = `
      <div style="background: #0f172a; border: 2px solid #e11d48; border-radius: 16px; padding: 24px; max-width: 480px; width: 100%; color: #ffffff; box-shadow: 0 12px 36px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #f43f5e; margin: 0;">🎯 CANNON ARMORY & SKINS</h2>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">
          Equip specialized weapon chassis to calibrate ballistic tracer hues, turret optics, and kinetic impact flares.
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          ${availableSkins.map(skin => {
            const isEquipped = currentLoadout.activeCannonSkin === skin.id;
            return `
              <div style="background: ${isEquipped ? 'rgba(225, 29, 72, 0.15)' : '#1e293b'}; border: 1px solid ${isEquipped ? '#f43f5e' : '#334155'}; border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 14px; font-weight: bold; color: ${skin.color};">${skin.name}</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${skin.desc}</div>
                </div>
                <button class="armory-equip-btn" data-skin="${skin.id}" style="background: ${isEquipped ? '#f43f5e' : '#334155'}; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700;">
                  ${isEquipped ? 'EQUIPPED' : 'EQUIP'}
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

    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => this.closeModal());

    const equipButtons = this.modalContainer.querySelectorAll('.armory-equip-btn');
    equipButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
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

    this.modalContainer.style.display = 'flex';
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn-bottom')?.addEventListener('click', () => this.closeModal());
  }

  private adjustBet(direction: number): void {
    const newIndex = Math.max(0, Math.min(this.betTiers.length - 1, this.currentBetIndex + direction));
    this.currentBetIndex = newIndex;
    this.betDisplayEl.textContent = `${this.getCurrentBet()} ${this.activeCurrency}`;
    if (this.onBetChangeCallback) {
      this.onBetChangeCallback(this.getCurrentBet(), this.activeCurrency);
    }
  }

  private toggleCurrency(): void {
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
