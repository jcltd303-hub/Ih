import { SoundManager } from './SoundManager';
import { GameEventBus } from '../engine/core/GameEvents';

export type AudioState = 'MENU' | 'GAMEPLAY' | 'BOSS' | 'VICTORY' | 'DEFEAT' | 'MUTED';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private currentState: AudioState = 'MENU';
  private previousState: AudioState = 'MENU';
  private isMuted = false;
  private masterVol = 1.0;
  private musicVol = 0.7;
  private sfxVol = 1.0;

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private constructor() {
    this.loadSettings();
    this.setupLifecycleHooks();
    this.setupEventSubscriptions();
  }

  private loadSettings(): void {
    try {
      const savedMute = localStorage.getItem('fish_frenzy_muted');
      if (savedMute !== null) this.isMuted = savedMute === 'true';

      const savedMaster = localStorage.getItem('fish_frenzy_vol_master');
      if (savedMaster !== null) this.masterVol = parseFloat(savedMaster);

      const savedMusic = localStorage.getItem('fish_frenzy_vol_music');
      if (savedMusic !== null) this.musicVol = parseFloat(savedMusic);

      const savedSfx = localStorage.getItem('fish_frenzy_vol_sfx');
      if (savedSfx !== null) this.sfxVol = parseFloat(savedSfx);
    } catch {
      // ignore
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('fish_frenzy_muted', String(this.isMuted));
      localStorage.setItem('fish_frenzy_vol_master', this.masterVol.toFixed(2));
      localStorage.setItem('fish_frenzy_vol_music', this.musicVol.toFixed(2));
      localStorage.setItem('fish_frenzy_vol_sfx', this.sfxVol.toFixed(2));
    } catch {
      // ignore
    }
  }

  private setupLifecycleHooks(): void {
    // Handle tab focus/blur or mobile app foreground/background
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Tab hidden: pause music cleanly
          SoundManager.stopBgm();
        } else {
          // Tab resumed: resume appropriate state
          if (!this.isMuted && (this.currentState === 'GAMEPLAY' || this.currentState === 'BOSS')) {
            SoundManager.startBgm();
            if (this.currentState === 'BOSS') {
              SoundManager.setBossMusic(true);
            }
          }
        }
      });
    }

    // Touch/click autoplay unlock
    const unlock = () => {
      if (!this.isMuted && (this.currentState === 'GAMEPLAY' || this.currentState === 'BOSS')) {
        SoundManager.startBgm();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true, passive: true });
    }
  }

  private setupEventSubscriptions(): void {
    const bus = GameEventBus.getInstance();

    bus.on('GAME_START', () => {
      this.transitionTo('GAMEPLAY');
    });

    bus.on('BOSS_INTRO', () => {
      this.transitionTo('BOSS');
    });

    bus.on('BOSS_DEFEATED', () => {
      this.transitionTo('VICTORY');
      // After victory stinger, return to gameplay
      setTimeout(() => {
        if (this.currentState === 'VICTORY') {
          this.transitionTo('GAMEPLAY');
        }
      }, 4000);
    });

    bus.on('BOSS_ESCAPED', () => {
      this.transitionTo('DEFEAT');
      setTimeout(() => {
        if (this.currentState === 'DEFEAT') {
          this.transitionTo('GAMEPLAY');
        }
      }, 3500);
    });

    bus.on('ROUND_END', () => {
      if (this.currentState === 'BOSS' || this.currentState === 'VICTORY' || this.currentState === 'DEFEAT') {
        this.transitionTo('GAMEPLAY');
      }
    });
  }

  public transitionTo(newState: AudioState): void {
    if (this.currentState === newState) return;
    this.previousState = this.currentState;
    this.currentState = newState;

    if (this.isMuted) return;

    switch (newState) {
      case 'MENU':
        SoundManager.setBossMusic(false);
        SoundManager.stopBgm();
        break;

      case 'GAMEPLAY':
        SoundManager.setBossMusic(false);
        SoundManager.startBgm();
        break;

      case 'BOSS':
        SoundManager.startBgm();
        SoundManager.setBossMusic(true, false);
        break;

      case 'VICTORY':
        SoundManager.setBossMusic(false);
        SoundManager.playUiSound('jackpot_fanfare');
        break;

      case 'DEFEAT':
        SoundManager.setBossMusic(false);
        break;

      case 'MUTED':
        SoundManager.stopBgm();
        break;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.saveSettings();

    if (this.isMuted) {
      this.previousState = this.currentState;
      this.transitionTo('MUTED');
    } else {
      this.transitionTo(this.previousState !== 'MUTED' ? this.previousState : 'GAMEPLAY');
    }

    return this.isMuted;
  }

  public setVolumes(master: number, music: number, sfx: number): void {
    this.masterVol = Math.max(0, Math.min(1, master));
    this.musicVol = Math.max(0, Math.min(1, music));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    this.saveSettings();
  }

  public getState(): AudioState {
    return this.currentState;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getVolumes() {
    return {
      master: this.masterVol,
      music: this.musicVol,
      sfx: this.sfxVol
    };
  }
}
