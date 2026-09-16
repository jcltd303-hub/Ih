import { get as idbGet, set as idbSet } from 'idb-keyval';

export type TurretSkinId = 'default' | 'plasma_neon' | 'abyssal_dread' | 'cyber_gold';

export class SoundManager {
  private static audioCtx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static masterCompressor: DynamicsCompressorNode | null = null;

  // Dedicated buses: MASTER -> compressor -> destination, with
  // MUSIC / SFX / AMBIENCE feeding the compressor.
  private static musicGain: GainNode | null = null;
  private static bossMusicGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;
  private static ambienceGain: GainNode | null = null;

  // AI Generated Audio Cache
  private static aiAudioBuffers: Map<string, AudioBuffer> = new Map();
  private static isGenerating: Set<string> = new Set();
  private static aiMusicSource: AudioBufferSourceNode | null = null;

  // Kept as an alias for compatibility with the existing scheduler code.
  private static bgmGain: GainNode | null = null;

  private static noiseBuffer: AudioBuffer | null = null;
  private static enabled: boolean = (() => {
    try {
      const v = localStorage.getItem('fish_frenzy_sound');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch { /* ignore */ }
    return true;
  })();

  private static bgmEnabled: boolean = (() => {
    try {
      const v = localStorage.getItem('fish_frenzy_bgm');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch { /* ignore */ }
    return true;
  })();

  private static bgmIntervalId: number | null = null;
  private static bgmStep: number = 0;
  private static bgmNextStepTime: number = 0;
  private static lastMissTime: number = 0;
  private static lastHitTime: number = 0;
  /** light = can-tech bright FX; dark = horror / abyssal */
  private static currentTheme: 'light' | 'dark' = 'light';
  private static bossMusicActive: boolean = false;
  private static bossEnraged: boolean = false;
  private static audioGestureHookInstalled: boolean = false;
  private static bossTransitioning: boolean = false;

  private static initContext(): void {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();

        // Broadcast-quality master compressor to prevent clipping during intense firefights
        this.masterCompressor = this.audioCtx.createDynamicsCompressor();
        this.masterCompressor.threshold.setValueAtTime(-14, this.audioCtx.currentTime);
        this.masterCompressor.knee.setValueAtTime(25, this.audioCtx.currentTime);
        this.masterCompressor.ratio.setValueAtTime(8, this.audioCtx.currentTime);
        this.masterCompressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
        this.masterCompressor.release.setValueAtTime(0.2, this.audioCtx.currentTime);

        // Master gain with smooth ramp transitions
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? 1.0 : 0.0, this.audioCtx.currentTime);

        // Dedicated audio buses.
        // Normal music and boss music have separate gains so the boss can
        // duck the normal soundtrack instead of simply becoming louder.
        this.musicGain = this.audioCtx.createGain();
        this.bossMusicGain = this.audioCtx.createGain();
        this.sfxGain = this.audioCtx.createGain();
        this.ambienceGain = this.audioCtx.createGain();

        this.musicGain.gain.setValueAtTime(
          this.bgmEnabled && this.enabled ? 0.22 : 0.0,
          this.audioCtx.currentTime
        );
        this.bossMusicGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
        this.sfxGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.ambienceGain.gain.setValueAtTime(0.92, this.audioCtx.currentTime);

        this.bgmGain = this.musicGain;

        this.musicGain.connect(this.masterCompressor);
        this.bossMusicGain.connect(this.masterCompressor);
        this.sfxGain.connect(this.masterCompressor);
        this.ambienceGain.connect(this.masterCompressor);

        this.masterCompressor.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    // Browsers may suspend WebAudio until a real user gesture occurs.
    // Install the recovery hook once; it is intentionally lightweight.
    if (!this.audioGestureHookInstalled) {
      this.audioGestureHookInstalled = true;

      const resumeAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      };

      window.addEventListener('pointerdown', resumeAudio, { passive: true });
      window.addEventListener('keydown', resumeAudio, { passive: true });
      window.addEventListener('touchstart', resumeAudio, { passive: true });
    }
  }

  /**
   * Pre-generates or retrieves a shared high-fidelity pink/white noise buffer
   */
  private static getNoiseBuffer(): AudioBuffer | null {
    if (this.noiseBuffer || !this.audioCtx) return this.noiseBuffer;
    try {
      const sampleRate = this.audioCtx.sampleRate;
      const bufferSize = sampleRate * 1.5;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // 3-pole pinking filter for organic acoustic body
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        const pink = b0 + b1 + b2 + white * 0.5362;
        data[i] = pink * 0.18;
      }
      this.noiseBuffer = buffer;
    } catch {
      // Guard
    }
    return this.noiseBuffer;
  }

  public static toggleSound(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('fish_frenzy_sound', this.enabled ? '1' : '0');
    } catch { /* ignore */ }
    if (this.audioCtx && this.masterGain) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.enabled ? 1.0 : 0.0, now + 0.05);
    }
    if (this.enabled && this.bgmEnabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
    return this.enabled;
  }

  public static isSoundEnabled(): boolean {
    return this.enabled;
  }

  // ==========================================
  // BACKGROUND MUSIC (BGM) ENGINE
  // ==========================================
  public static isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public static toggleBgm(force?: boolean): boolean {
    this.bgmEnabled = typeof force === 'boolean' ? force : !this.bgmEnabled;
    try {
      localStorage.setItem('fish_frenzy_bgm', this.bgmEnabled ? '1' : '0');
    } catch { /* ignore */ }

    this.initContext();
    if (this.audioCtx && this.bgmGain) {
      const now = this.audioCtx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.linearRampToValueAtTime(
        this.bgmEnabled && this.enabled ? 0.22 : 0.0,
        now + 0.15
      );
    }

    if (this.bgmEnabled && this.enabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
    return this.bgmEnabled;
  }

  public static startBgm(): void {
    if (!this.bgmEnabled || !this.enabled) return;
    
    this.initContext();
    if (!this.audioCtx || !this.bgmGain) return;

    const key = `ai_music_${this.currentTheme}`;
    if (this.aiAudioBuffers.has(key)) {
      this.startAiMusic();
      return;
    }

    if (this.bgmIntervalId !== null) return; // already active

    this.bgmNextStepTime = this.audioCtx.currentTime + 0.08;
    this.bgmStep = 0;
    // One scheduler for every soundtrack state. Boss/theme changes only
    // change what gets scheduled; they never create another timer.
    this.bgmIntervalId = window.setInterval(() => this.tickBgmScheduler(), 45);
  }

  private static startProceduralBgm(): void {
    if (this.bgmIntervalId !== null) return;
    if (!this.audioCtx || !this.bgmGain) return;
    this.bgmNextStepTime = this.audioCtx.currentTime + 0.08;
    this.bgmStep = 0;
    this.bgmIntervalId = window.setInterval(() => this.tickBgmScheduler(), 45);
  }

  private static stopProceduralBgm(): void {
    if (this.bgmIntervalId !== null) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  public static stopBgm(): void {
    this.stopProceduralBgm();
    this.stopAiMusic();
    
    if (this.audioCtx && this.bgmGain) {
      const now = this.audioCtx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
    }
  }

  public static setBossMusic(active: boolean, enraged: boolean = false): void {
    const wasActive = this.bossMusicActive;

    this.bossMusicActive = active;
    this.bossEnraged = enraged;

    this.initContext();

    if (!this.audioCtx || !this.musicGain || !this.bossMusicGain) return;

    const now = this.audioCtx.currentTime;
    const transition = active ? 0.45 : 0.60;

    this.musicGain.gain.cancelScheduledValues(now);
    this.bossMusicGain.gain.cancelScheduledValues(now);

    if (active) {
      // Duck the ordinary soundtrack while bringing the boss layer forward.
      this.musicGain.gain.setValueAtTime(
        this.bgmEnabled && this.enabled ? 0.22 : 0.0,
        now
      );
      this.musicGain.gain.linearRampToValueAtTime(0.055, now + transition);

      this.bossMusicGain.gain.setValueAtTime(
        wasActive ? 0.35 : 0.0,
        now
      );
      this.bossMusicGain.gain.linearRampToValueAtTime(
        enraged ? 0.40 : 0.35,
        now + transition
      );

      // Restart the musical phrase cleanly at the transition boundary.
      this.bgmStep = 0;
      this.bgmNextStepTime = now + 0.05;

      if (this.bgmIntervalId === null && this.enabled) {
        this.bgmIntervalId = window.setInterval(
          () => this.tickBgmScheduler(),
          45
        );
      }

      this.bossTransitioning = true;
      window.setTimeout(() => {
        this.bossTransitioning = false;
      }, transition * 1000);
    } else {
      // Crossfade boss layer out and restore the normal soundtrack.
      this.bossMusicGain.gain.setValueAtTime(
        wasActive ? 0.35 : 0.0,
        now
      );
      this.bossMusicGain.gain.linearRampToValueAtTime(0.0, now + transition);

      this.musicGain.gain.setValueAtTime(
        this.bgmEnabled && this.enabled ? 0.055 : 0.0,
        now
      );
      this.musicGain.gain.linearRampToValueAtTime(
        this.bgmEnabled && this.enabled ? 0.22 : 0.0,
        now + transition
      );

      this.bgmStep = 0;
      this.bgmNextStepTime = now + transition;

      if (!this.bgmEnabled && this.bgmIntervalId !== null) {
        clearInterval(this.bgmIntervalId);
        this.bgmIntervalId = null;
      }

      this.bossTransitioning = true;
      window.setTimeout(() => {
        this.bossTransitioning = false;
      }, transition * 1000);
    }
  }

  private static tickBgmScheduler(): void {
    if (!this.audioCtx || !this.bgmGain || (!this.bgmEnabled && !this.bossMusicActive) || !this.enabled) return;
    const lookahead = 0.35;
    const now = this.audioCtx.currentTime;

    if (this.bgmNextStepTime < now) {
      this.bgmNextStepTime = now;
    }

    let iterations = 0;
    while (this.bgmNextStepTime < now + lookahead && iterations < 32) {
      iterations++;
      if (this.bossMusicActive) {
        this.scheduleBossRaidStep(this.bgmStep, this.bgmNextStepTime, this.bossEnraged);
        // Fast intense 142 BPM (0.105s) or 158 BPM (0.095s if enraged)
        this.bgmNextStepTime += this.bossEnraged ? 0.094 : 0.105;
      } else if (this.currentTheme === 'dark') {
        this.scheduleHorrorStep(this.bgmStep, this.bgmNextStepTime);
        // Horror: 60 BPM -> 8th notes (0.5s per step)
        this.bgmNextStepTime += 0.50;
      } else {
        this.scheduleCanTechStep(this.bgmStep, this.bgmNextStepTime);
        // Can-Tech: 124 BPM -> 16th notes (0.1209s per step)
        this.bgmNextStepTime += 0.121;
      }
      this.bgmStep = (this.bgmStep + 1) % 32;
    }
  }

  /**
   * Cinematic High-Octane Boss Battle BGM
   * Heavy distorted Reese sub-bass, rapid double kicks, staccato sawtooth tension arp, and alarm pulses
   */
  private static scheduleBossRaidStep(step: number, time: number, enraged: boolean): void {
    if (!this.audioCtx || !this.bgmGain) return;
    const ctx = this.audioCtx;
    const bgmOut = this.bossMusicGain;

    // 1. Driving Chromatic War Riff Bass (D1, Eb1, D1, F1, G1)
    const bossBass = [
      36.71, 36.71, 38.89, 36.71,  43.65, 41.20, 36.71, 48.99, // D1, D1, Eb1, D1, F1, E1, D1, G1
      36.71, 36.71, 55.00, 51.91,  43.65, 41.20, 38.89, 36.71  // D1, D1, A1, Ab1, F1, E1, Eb1, D1
    ];
    const bassFreq = bossBass[step % bossBass.length];

    const bassOsc = ctx.createOscillator();
    const bassFilt = ctx.createBiquadFilter();
    const bassGain = ctx.createGain();

    bassOsc.type = enraged ? 'sawtooth' : 'triangle';
    bassOsc.frequency.setValueAtTime(bassFreq, time);

    bassFilt.type = 'lowpass';
    bassFilt.frequency.setValueAtTime(enraged ? 550 : 380, time);
    bassFilt.frequency.exponentialRampToValueAtTime(110, time + 0.10);
    bassFilt.Q.setValueAtTime(enraged ? 6.5 : 4.0, time);

    bassGain.gain.setValueAtTime(enraged ? 0.38 : 0.28, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.105);

    bassOsc.connect(bassFilt);
    bassFilt.connect(bassGain);
    bassGain.connect(bgmOut);

    bassOsc.start(time);
    bassOsc.stop(time + 0.11);

    // 2. Heavy Industrial Battle Kicks (Four-on-the-floor + double time for enrage)
    const isKickStep = (step % 4 === 0) || (enraged && (step % 2 === 0));
    if (isKickStep) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(enraged ? 180 : 150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(32, time + 0.08);

      kickGain.gain.setValueAtTime(0.42, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.085);

      kickOsc.connect(kickGain);
      kickGain.connect(bgmOut);

      kickOsc.start(time);
      kickOsc.stop(time + 0.09);
    }

    // 3. Staccato Tension Saw Arpeggio (D4 / F4 / Ab4 / B4 diminished tension)
    const arpNotes = [293.66, 349.23, 415.30, 493.88, 587.33, 493.88, 415.30, 349.23];
    const arpFreq = arpNotes[step % arpNotes.length];

    const arpOsc = ctx.createOscillator();
    const arpGain = ctx.createGain();
    const arpFilt = ctx.createBiquadFilter();

    arpOsc.type = 'sawtooth';
    arpOsc.frequency.setValueAtTime(arpFreq, time);

    arpFilt.type = 'bandpass';
    arpFilt.frequency.setValueAtTime(enraged ? 1800 : 1200, time);
    arpFilt.Q.setValueAtTime(3.0, time);

    arpGain.gain.setValueAtTime(enraged ? 0.18 : 0.12, time);
    arpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    arpOsc.connect(arpFilt);
    arpFilt.connect(arpGain);
    arpGain.connect(bgmOut);

    arpOsc.start(time);
    arpOsc.stop(time + 0.075);
  }

  /** Light Theme: Fun, bright, and bouncy retro-arcade synth groove */
  private static scheduleCanTechStep(step: number, time: number): void {
    if (!this.audioCtx || !this.bgmGain) return;
    const ctx = this.audioCtx;
    const bgmOut = this.bgmGain;

    // 1. Fun and Bouncy Slap-Synth Bass (Syncopated upbeat major groove)
    const bouncyBassScale = [
      130.81, 65.41, 130.81, 164.81, // C3, C2, C3, E3
      146.83, 73.42, 174.61, 196.00, // D3, D2, F3, G3
      164.81, 82.41, 196.00, 220.00, // E3, E2, G3, A3
      174.61, 196.00, 246.94, 261.63 // F3, G3, B3, C4
    ];
    const bassFreq = bouncyBassScale[step % bouncyBassScale.length];

    const bassOsc = ctx.createOscillator();
    const bassFilt = ctx.createBiquadFilter();
    const bassG = ctx.createGain();

    // Bouncy punchy pluck
    bassOsc.type = (step % 2 === 0) ? 'triangle' : 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, time);

    bassFilt.type = 'lowpass';
    bassFilt.Q.setValueAtTime(4.2, time);
    bassFilt.frequency.setValueAtTime(1100, time);
    bassFilt.frequency.exponentialRampToValueAtTime(120, time + 0.09);

    bassG.gain.setValueAtTime(0.15, time);
    bassG.gain.exponentialRampToValueAtTime(0.001, time + 0.095);

    bassOsc.connect(bassFilt);
    bassFilt.connect(bassG);
    bassG.connect(bgmOut);

    bassOsc.start(time);
    bassOsc.stop(time + 0.1);

    // 2. Cheerful Upbeat Chord Stabs (Upbeat offbeat skank on steps 2, 6, 10, 14)
    if (step % 4 === 2) {
      const upbeatChords = [
        [523.25, 659.25, 783.99], // C major (C5, E5, G5)
        [587.33, 698.46, 880.00], // Dm (D5, F5, A5)
        [659.25, 783.99, 987.77], // Em (E5, G5, B5)
        [698.46, 880.00, 1046.50], // F major (F5, A5, C6)
      ];
      const chord = upbeatChords[Math.floor((step % 16) / 4)];
      chord.forEach((freq) => {
        const chordOsc = ctx.createOscillator();
        const chordFilt = ctx.createBiquadFilter();
        const chordG = ctx.createGain();

        chordOsc.type = 'square';
        chordOsc.frequency.setValueAtTime(freq, time);

        chordFilt.type = 'bandpass';
        chordFilt.frequency.setValueAtTime(1400, time);
        chordFilt.Q.setValueAtTime(1.8, time);

        chordG.gain.setValueAtTime(0.032, time);
        chordG.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

        chordOsc.connect(chordFilt);
        chordFilt.connect(chordG);
        chordG.connect(bgmOut);

        chordOsc.start(time);
        chordOsc.stop(time + 0.075);
      });
    }

    // 3. Playful Bubbly Arpeggio Plucks
    if (step % 2 === 1) {
      const bouncyMelody = [783.99, 880.00, 1046.50, 1174.66, 1318.51, 1174.66, 1046.50, 880.00]; // G5, A5, C6, D6, E6, D6, C6, A5
      const arpFreq = bouncyMelody[(step) % bouncyMelody.length];
      const arpOsc = ctx.createOscillator();
      const arpG = ctx.createGain();
      arpOsc.type = 'sine';
      arpOsc.frequency.setValueAtTime(arpFreq, time);
      arpG.gain.setValueAtTime(0.048, time);
      arpG.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      arpOsc.connect(arpG);
      arpG.connect(bgmOut);
      arpOsc.start(time);
      arpOsc.stop(time + 0.085);
    }

    // 4. Punchy Bouncy Rhythm (Kick on 0, 8; Fun snare clap on 4, 12; Shaker tick on every step)
    if (step % 8 === 0) {
      // Fun punchy round kick
      const kickOsc = ctx.createOscillator();
      const kickG = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(145, time);
      kickOsc.frequency.exponentialRampToValueAtTime(45, time + 0.075);
      kickG.gain.setValueAtTime(0.16, time);
      kickG.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      kickOsc.connect(kickG);
      kickG.connect(bgmOut);
      kickOsc.start(time);
      kickOsc.stop(time + 0.085);
    } else if (step % 8 === 4) {
      // Crisp retro snare clap
      this.playFilteredNoise(time, 0.06, 3400, 1.2, 'bandpass', 0.08);
    } else {
      // Light shaker pulse
      this.playFilteredNoise(time, 0.018, 8500, 1.5, 'highpass', 0.022);
    }
  }

  /** Horror Theme: Lovecraftian abyssal soundscape — drones, pulse, distant voices */
  private static scheduleHorrorStep(step: number, time: number): void {
    if (!this.audioCtx || !this.bgmGain) return;
    const ctx = this.audioCtx;
    const bgmOut = this.bgmGain;

    // 1. Deep abyssal drone cluster (microtonal clash + sub pressure)
    if (step % 4 === 0) {
      const droneOsc1 = ctx.createOscillator();
      const droneOsc2 = ctx.createOscillator();
      const droneOsc3 = ctx.createOscillator();
      const droneFilt = ctx.createBiquadFilter();
      const droneG = ctx.createGain();

      droneOsc1.type = 'sawtooth';
      droneOsc1.frequency.setValueAtTime(36.7, time); // near D1
      droneOsc2.type = 'triangle';
      droneOsc2.frequency.setValueAtTime(41.2, time); // E1 — beating
      droneOsc3.type = 'sine';
      droneOsc3.frequency.setValueAtTime(55.0, time); // A1 — uneasy fifth

      droneFilt.type = 'lowpass';
      droneFilt.frequency.setValueAtTime(95, time);
      droneFilt.Q.setValueAtTime(2.2, time);

      droneG.gain.setValueAtTime(0.001, time);
      droneG.gain.linearRampToValueAtTime(0.18, time + 0.55);
      droneG.gain.exponentialRampToValueAtTime(0.001, time + 2.1);

      droneOsc1.connect(droneFilt);
      droneOsc2.connect(droneFilt);
      droneOsc3.connect(droneFilt);
      droneFilt.connect(droneG);
      droneG.connect(bgmOut);

      droneOsc1.start(time);
      droneOsc2.start(time);
      droneOsc3.start(time);
      droneOsc1.stop(time + 2.15);
      droneOsc2.stop(time + 2.15);
      droneOsc3.stop(time + 2.15);
    }

    // 2. Rhythmic Dread Heartbeat (two muted low-frequency thuds: "thump... thump...")
    if (step % 4 === 0) {
      const beatOsc = ctx.createOscillator();
      const beatG = ctx.createGain();
      beatOsc.type = 'sine';
      beatOsc.frequency.setValueAtTime(62, time);
      beatOsc.frequency.exponentialRampToValueAtTime(26, time + 0.16);
      beatG.gain.setValueAtTime(0.20, time);
      beatG.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
      beatOsc.connect(beatG);
      beatG.connect(bgmOut);
      beatOsc.start(time);
      beatOsc.stop(time + 0.18);

      // Second heartbeat pulse 180ms later
      const beat2Osc = ctx.createOscillator();
      const beat2G = ctx.createGain();
      beat2Osc.type = 'sine';
      beat2Osc.frequency.setValueAtTime(54, time + 0.18);
      beat2Osc.frequency.exponentialRampToValueAtTime(24, time + 0.32);
      beat2G.gain.setValueAtTime(0.14, time + 0.18);
      beat2G.gain.exponentialRampToValueAtTime(0.001, time + 0.33);
      beat2Osc.connect(beat2G);
      beat2G.connect(bgmOut);
      beat2Osc.start(time + 0.18);
      beat2Osc.stop(time + 0.34);
    }

    // 3. Cold Devil's Tritone / Diminished Bell Pings
    const chimeMap: Record<number, number> = {
      1: 622.25, // Eb5
      3: 440.00, // A4 (Tritone clash against Eb!)
      7: 587.33, // D5
      9: 415.30, // G#4 (Diminished 5th against D!)
      13: 523.25 // C5
    };
    if (chimeMap[step % 16]) {
      const freq = chimeMap[step % 16];
      const chimeOsc = ctx.createOscillator();
      const chimeMod = ctx.createOscillator();
      const chimeModG = ctx.createGain();
      const chimeG = ctx.createGain();

      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(freq, time);

      // Ring-mod creepy hollow metallic resonance
      chimeMod.type = 'triangle';
      chimeMod.frequency.setValueAtTime(freq * 0.49, time);
      chimeModG.gain.setValueAtTime(freq * 0.18, time);
      chimeMod.connect(chimeModG);
      chimeModG.connect(chimeOsc.frequency);

      chimeG.gain.setValueAtTime(0.001, time);
      chimeG.gain.linearRampToValueAtTime(0.075, time + 0.02);
      chimeG.gain.exponentialRampToValueAtTime(0.001, time + 1.2);

      chimeOsc.connect(chimeG);
      chimeG.connect(bgmOut);

      chimeMod.start(time);
      chimeOsc.start(time);
      chimeMod.stop(time + 1.25);
      chimeOsc.stop(time + 1.25);
    }

    // 4. Ghostly Noise Wind / Scraping Tide
    if (step % 8 === 2) {
      const noise = this.getNoiseBuffer();
      if (noise) {
        const windSrc = ctx.createBufferSource();
        windSrc.buffer = noise;
        const windFilt = ctx.createBiquadFilter();
        const windG = ctx.createGain();

        windFilt.type = 'bandpass';
        windFilt.Q.setValueAtTime(5.5, time);
        windFilt.frequency.setValueAtTime(320, time);
        windFilt.frequency.linearRampToValueAtTime(1250, time + 0.6);
        windFilt.frequency.exponentialRampToValueAtTime(280, time + 1.4);

        windG.gain.setValueAtTime(0.001, time);
        windG.gain.linearRampToValueAtTime(0.065, time + 0.35);
        windG.gain.exponentialRampToValueAtTime(0.001, time + 1.45);

        windSrc.connect(windFilt);
        windFilt.connect(windG);
        windG.connect(bgmOut);

        windSrc.start(time);
        windSrc.stop(time + 1.5);
      }
    }

    // 5. Distant eldritch whisper (formant-ish noise burst, irregular)
    if (step % 16 === 11 || step % 16 === 5) {
      const noise = this.getNoiseBuffer();
      if (noise) {
        const wSrc = ctx.createBufferSource();
        wSrc.buffer = noise;
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.Q.setValueAtTime(9, time);
        formant.frequency.setValueAtTime(700 + (step % 5) * 90, time);
        formant.frequency.linearRampToValueAtTime(420, time + 0.7);
        const wG = ctx.createGain();
        wG.gain.setValueAtTime(0.001, time);
        wG.gain.linearRampToValueAtTime(0.045, time + 0.08);
        wG.gain.exponentialRampToValueAtTime(0.001, time + 0.85);
        wSrc.connect(formant);
        formant.connect(wG);
        wG.connect(bgmOut);
        wSrc.start(time);
        wSrc.stop(time + 0.9);
      }
    }

    // 6. Occasional sub drop / pressure wave
    if (step % 32 === 24) {
      const drop = ctx.createOscillator();
      const dG = ctx.createGain();
      drop.type = 'sine';
      drop.frequency.setValueAtTime(90, time);
      drop.frequency.exponentialRampToValueAtTime(28, time + 0.9);
      dG.gain.setValueAtTime(0.16, time);
      dG.gain.exponentialRampToValueAtTime(0.001, time + 1.1);
      drop.connect(dG);
      dG.connect(bgmOut);
      drop.start(time);
      drop.stop(time + 1.15);
    }
  }

  public static setTheme(theme: 'light' | 'dark' | 'can-tech' | 'horror'): void {
    const normalized: 'light' | 'dark' = (theme === 'dark' || theme === 'horror') ? 'dark' : 'light';
    const changed = this.currentTheme !== normalized;
    this.currentTheme = normalized;
    if (changed) {
      if (normalized === 'dark') {
        // Immediate ominous preview feedback
        this.playHorrorWhisper(0.7);
        setTimeout(() => this.playHorrorLaughter(0.75, -20), 120);
      }
      if (this.bgmEnabled && this.enabled) {
        const key = `ai_music_${this.currentTheme}`;
        if (this.aiAudioBuffers.has(key)) {
          this.startAiMusic();
        } else {
          this.stopAiMusic();
          // Restart the musical phrase without touching the bus gain.
          // This prevents audible volume jumps during theme changes.
          this.bgmStep = 0;
          if (this.audioCtx) {
            this.bgmNextStepTime = this.audioCtx.currentTime + 0.05;
          }
          this.startProceduralBgm();
        }
      }
    }
  }

  public static getTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }

  /** Pitch / gain flavour per theme */
  private static themePitch(): number {
    return this.currentTheme === 'dark' ? 0.72 : 1.0;
  }

  private static themeMasterGainMul(): number {
    return this.currentTheme === 'dark' ? 0.92 : 1.0;
  }

  // ==========================================
  // HORROR SUITE: SHRIEK, LAUGHTER & WHISPERS
  // ==========================================
  /**
   * Blood-curdling Creature / Banshee Shriek with rapid FM flutter and resonant screech
   */
  public static playHorrorShriek(intensity: number = 1.0, isBanshee: boolean = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor || !this.sfxGain || !this.ambienceGain) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const duration = isBanshee ? 1.35 : 0.85;

      // 1. FM Modulator (creates horrifying vocal cord strain / flutter tremor at 34-46 Hz)
      const modOsc = ctx.createOscillator();
      const modGain = ctx.createGain();
      modOsc.type = 'sawtooth';
      modOsc.frequency.setValueAtTime(36, now);
      modOsc.frequency.linearRampToValueAtTime(46, now + duration * 0.4);
      modOsc.frequency.linearRampToValueAtTime(26, now + duration);
      modGain.gain.setValueAtTime(260 * intensity, now);
      modGain.gain.linearRampToValueAtTime(380 * intensity, now + 0.15);
      modGain.gain.exponentialRampToValueAtTime(10, now + duration);

      // 2. Primary Piercing Screech Carrier
      const carrierOsc = ctx.createOscillator();
      const carrierGain = ctx.createGain();
      carrierOsc.type = 'sawtooth';
      const startPitch = isBanshee ? 1600 : 1350;
      const peakPitch = isBanshee ? 2650 : 2150;
      const endPitch = isBanshee ? 460 : 380;
      carrierOsc.frequency.setValueAtTime(startPitch, now);
      carrierOsc.frequency.exponentialRampToValueAtTime(peakPitch, now + 0.12);
      carrierOsc.frequency.exponentialRampToValueAtTime(endPitch, now + duration);

      modOsc.connect(modGain);
      modGain.connect(carrierOsc.frequency);

      // 3. Dissonant secondary screaming oscillator (sharp minor second for pure biological terror)
      const dissOsc = ctx.createOscillator();
      const dissGain = ctx.createGain();
      dissOsc.type = 'triangle';
      dissOsc.frequency.setValueAtTime(startPitch * 1.0595, now);
      dissOsc.frequency.exponentialRampToValueAtTime(peakPitch * 1.06, now + 0.12);
      dissOsc.frequency.exponentialRampToValueAtTime(endPitch * 1.06, now + duration);

      modGain.connect(dissOsc.frequency);

      // 4. Resonant Screech Filter
      const shriekFilter = ctx.createBiquadFilter();
      shriekFilter.type = 'bandpass';
      shriekFilter.Q.setValueAtTime(4.5, now);
      shriekFilter.frequency.setValueAtTime(1800, now);
      shriekFilter.frequency.exponentialRampToValueAtTime(2800, now + 0.14);
      shriekFilter.frequency.exponentialRampToValueAtTime(600, now + duration);

      const peakVol = 0.38 * intensity;
      carrierGain.gain.setValueAtTime(0.001, now);
      carrierGain.gain.linearRampToValueAtTime(peakVol, now + 0.05);
      carrierGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      dissGain.gain.setValueAtTime(0.001, now);
      dissGain.gain.linearRampToValueAtTime(peakVol * 0.7, now + 0.06);
      dissGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      carrierOsc.connect(carrierGain);
      dissOsc.connect(dissGain);
      carrierGain.connect(shriekFilter);
      dissGain.connect(shriekFilter);

      // 5. Screaming air friction noise layer
      const noise = this.getNoiseBuffer();
      if (noise) {
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noise;
        const nFilter = ctx.createBiquadFilter();
        const nGain = ctx.createGain();
        nFilter.type = 'bandpass';
        nFilter.Q.setValueAtTime(7.5, now);
        nFilter.frequency.setValueAtTime(2500, now);
        nFilter.frequency.exponentialRampToValueAtTime(1100, now + duration);
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.24 * intensity, now + 0.04);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        noiseSrc.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.ambienceGain);
        noiseSrc.start(now);
        noiseSrc.stop(now + duration + 0.05);
      }

      // 6. Subsonic dread punch
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(115, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + duration * 0.7);
      subGain.gain.setValueAtTime(0.28 * intensity, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.75);
      sub.connect(subGain);
      subGain.connect(this.ambienceGain);

      shriekFilter.connect(this.ambienceGain!);

      modOsc.start(now);
      carrierOsc.start(now);
      dissOsc.start(now);
      sub.start(now);

      modOsc.stop(now + duration + 0.05);
      carrierOsc.stop(now + duration + 0.05);
      dissOsc.stop(now + duration + 0.05);
      sub.stop(now + duration + 0.05);
    } catch {
      // Guard
    }
  }

  /**
   * Sinister Demonic Cackle / Ominous Laughter using formant vocal tract simulation
   */
  public static playHorrorLaughter(intensity: number = 1.0, pitchShift: number = 0): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor || !this.sfxGain || !this.ambienceGain) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Descending guttural laughter bursts ("HA... HA... HA... heh... heh... heh...")
      const syllables = [
        { t: 0.00, freq: 175 + pitchShift, len: 0.16, vol: 0.32 },
        { t: 0.15, freq: 160 + pitchShift, len: 0.15, vol: 0.35 },
        { t: 0.29, freq: 142 + pitchShift, len: 0.15, vol: 0.34 },
        { t: 0.43, freq: 125 + pitchShift, len: 0.16, vol: 0.32 },
        { t: 0.58, freq: 108 + pitchShift, len: 0.18, vol: 0.28 },
        { t: 0.75, freq: 88 + pitchShift, len: 0.26, vol: 0.25 },
      ];

      // Formant filters to simulate human vocal cavity
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(520, now);
      f1.Q.setValueAtTime(4.0, now);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(1180, now);
      f2.Q.setValueAtTime(3.5, now);

      // Tremolo / throat flutter LFO
      const tremOsc = ctx.createOscillator();
      const tremGain = ctx.createGain();
      tremOsc.type = 'sine';
      tremOsc.frequency.setValueAtTime(7.5, now);
      tremGain.gain.setValueAtTime(18, now);
      tremOsc.start(now);
      tremOsc.stop(now + 1.2);

      f1.connect(this.ambienceGain!);
      f2.connect(this.ambienceGain!);

      syllables.forEach((s) => {
        const sTime = now + s.t;
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(s.freq, sTime);
        osc.frequency.exponentialRampToValueAtTime(s.freq * 0.88, sTime + s.len);

        tremOsc.connect(osc.frequency);

        // Demonic sub-octave growl
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(s.freq * 0.5, sTime);
        subOsc.frequency.exponentialRampToValueAtTime(s.freq * 0.44, sTime + s.len);

        const v = s.vol * intensity;
        gain.gain.setValueAtTime(0.001, sTime);
        gain.gain.linearRampToValueAtTime(v, sTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, sTime + s.len);

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(f1);
        gain.connect(f2);

        osc.start(sTime);
        subOsc.start(sTime);
        osc.stop(sTime + s.len + 0.02);
        subOsc.stop(sTime + s.len + 0.02);
      });
    } catch {
      // Guard
    }
  }

  /**
   * Eerie Ghostly Whisper / Spectral Sigh
   */
  public static playHorrorWhisper(intensity: number = 0.5): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const noise = this.getNoiseBuffer();
      if (!noise) return;

      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      filter.type = 'bandpass';
      filter.Q.setValueAtTime(6.0, now);
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(1400, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.9);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18 * intensity, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambienceGain);

      src.start(now);
      src.stop(now + 1.0);
    } catch {
      // Guard
    }
  }

  /** Low dissonant stinger with tritone cluster used in horror mode */
  private static playHorrorStinger(intensity: number = 0.3): void {
    if (!this.audioCtx || !this.masterCompressor) return;
    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc2.type = 'square';
      osc.frequency.setValueAtTime(55 + intensity * 40, now);
      osc2.frequency.setValueAtTime(82.5 + intensity * 30, now); // tritone-ish
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.4);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22 * intensity, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambienceGain);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.56);
      osc2.stop(now + 0.56);
    } catch { /* guard */ }
  }

  // ==========================================
  // 1. PER-TURRET FIRING ACOUSTICS
  // ==========================================
  public static playTurretFire(skin: TurretSkinId = 'default', betAmount: number = 1, currencyType: 'GC' | 'SC' = 'GC'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      if (this.currentTheme === 'dark') {
        this.playHorrorStinger(0.35 + Math.min(0.4, betAmount / 40));
      }
      const now = ctx.currentTime;
      const isHighBet = betAmount >= 50;
      const isMedBet = betAmount >= 10;
      const betBassBoost = isHighBet ? 1.4 : isMedBet ? 1.15 : 1.0;

      if (skin === 'plasma_neon') {
        // --- Twin-Ion Hyper-Blaster: Dual digitized ion sweep + high-frequency plasma sizzle + sub punch ---
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(980, now);
        osc1.frequency.exponentialRampToValueAtTime(140, now + 0.09);
        gain1.gain.setValueAtTime(0.28 * betBassBoost, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc1.connect(gain1);
        gain1.connect(this.sfxGain);
        osc1.start(now);
        osc1.stop(now + 0.10);

        // Secondary detuned ion wave
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600, now);
        osc2.frequency.exponentialRampToValueAtTime(240, now + 0.07);
        gain2.gain.setValueAtTime(0.18, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(now);
        osc2.stop(now + 0.08);

        // Sub kick pulse
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(110, now);
        subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.12);
        subGain.gain.setValueAtTime(0.35 * betBassBoost, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        subOsc.connect(subGain);
        subGain.connect(this.sfxGain);
        subOsc.start(now);
        subOsc.stop(now + 0.13);

        // Plasma ion crackle burst
        this.playFilteredNoise(now, 0.06, 3200, 3.0, 'bandpass', 0.15);

      } else if (skin === 'abyssal_dread') {
        // --- Crimson Kinetic Railgun / Artillery: Massive sub-bass concussive blast + mechanical breech snap ---
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.type = 'sawtooth';
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(25, now + 0.16);
        kickGain.gain.setValueAtTime(0.42 * betBassBoost, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kickOsc.connect(kickGain);
        kickGain.connect(this.sfxGain);
        kickOsc.start(now);
        kickOsc.stop(now + 0.17);

        // Heavy artillery concussive shockwave (lowpass noise rumble)
        this.playFilteredNoise(now, 0.14, 180, 1.8, 'lowpass', 0.35 * betBassBoost);

        // Mechanical metallic breech recoil snap
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(1400, now);
        snapOsc.frequency.exponentialRampToValueAtTime(380, now + 0.035);
        snapGain.gain.setValueAtTime(0.25, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        snapOsc.connect(snapGain);
        snapGain.connect(this.sfxGain);
        snapOsc.start(now);
        snapOsc.stop(now + 0.04);

      } else if (skin === 'cyber_gold') {
        // --- Radiant Solar Sunstone Lance: Sparkling golden chord harmonics + sweeping laser beam ---
        const chordFreqs = [784.00, 1174.66, 1568.00]; // G5, D6, G6
        chordFreqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.14);
          gain.gain.setValueAtTime((0.15 - idx * 0.03) * betBassBoost, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(now);
          osc.stop(now + 0.15);
        });

        // Golden solar shimmer beam sweep
        const beamOsc = ctx.createOscillator();
        const beamGain = ctx.createGain();
        beamOsc.type = 'triangle';
        beamOsc.frequency.setValueAtTime(1800, now);
        beamOsc.frequency.exponentialRampToValueAtTime(540, now + 0.11);
        beamGain.gain.setValueAtTime(0.22 * betBassBoost, now);
        beamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        beamOsc.connect(beamGain);
        beamGain.connect(this.sfxGain);
        beamOsc.start(now);
        beamOsc.stop(now + 0.12);

        // Sub warm solar pulse
        const sub = ctx.createOscillator();
        const sGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120, now);
        sub.frequency.exponentialRampToValueAtTime(45, now + 0.13);
        sGain.gain.setValueAtTime(0.26 * betBassBoost, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        sub.connect(sGain);
        sGain.connect(this.sfxGain);
        sub.start(now);
        sub.stop(now + 0.14);

      } else {
        // --- Default Tactical Dual Plasma Blaster: Punchy arcade laser zap ---
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const baseFreq = isHighBet ? 360 : isMedBet ? 460 : 540;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.11);
        gain.gain.setValueAtTime(0.26 * betBassBoost, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);

        const sub = ctx.createOscillator();
        const sGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(130, now);
        sub.frequency.exponentialRampToValueAtTime(35, now + 0.12);
        sGain.gain.setValueAtTime(0.3 * betBassBoost, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        sub.connect(sGain);
        sGain.connect(this.sfxGain);
        sub.start(now);
        sub.stop(now + 0.13);
      }
    } catch {
      // Guard
    }
  }

  // Backward compatibility wrapper
  public static playCannonShot(betAmount: number, skin: TurretSkinId = 'default'): void {
    this.playTurretFire(skin, betAmount);
  }

  // ==========================================
  // 2. PER-TURRET IMPACT / HIT ACOUSTICS
  // ==========================================
  public static playTurretHit(skin: TurretSkinId = 'default', fishType: 'small' | 'medium' | 'boss' = 'small', isBossShieldDeflect: boolean = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;
    if (this.currentTheme === 'dark' && fishType === 'boss') {
      this.playHorrorStinger(0.55);
    }

    const now = this.audioCtx.currentTime;
    // Throttle duplicate hits within 35ms to prevent audio clutter
    if (now - this.lastHitTime < 0.035) return;
    this.lastHitTime = now;

    try {
      const ctx = this.audioCtx;

      // Special Layer: Boss Hexagonal Forcefield Shield Deflection
      if (fishType === 'boss' || isBossShieldDeflect) {
        // High-Q metallic forcefield ricochet ping
        const ringOsc = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(1850, now);
        ringOsc.frequency.exponentialRampToValueAtTime(1420, now + 0.15);
        ringGain.gain.setValueAtTime(0.32, now);
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        ringOsc.connect(ringGain);
        ringGain.connect(this.sfxGain);
        ringOsc.start(now);
        ringOsc.stop(now + 0.17);

        // Resonant barrier buzz
        const buzzOsc = ctx.createOscillator();
        const buzzGain = ctx.createGain();
        buzzOsc.type = 'triangle';
        buzzOsc.frequency.setValueAtTime(220, now);
        buzzGain.gain.setValueAtTime(0.24, now);
        buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        buzzOsc.connect(buzzGain);
        buzzGain.connect(this.sfxGain);
        buzzOsc.start(now);
        buzzOsc.stop(now + 0.13);
      }

      if (skin === 'plasma_neon') {
        // Electric ionized plasma splash
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.setValueAtTime(780, now + 0.03);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.11);

        this.playFilteredNoise(now, 0.05, 4200, 3.5, 'bandpass', 0.18);

      } else if (skin === 'abyssal_dread') {
        // Heavy kinetic concussive crunch thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.14);

        this.playFilteredNoise(now, 0.09, 280, 2.0, 'lowpass', 0.28);

      } else if (skin === 'cyber_gold') {
        // Crystalline glass bell chime ping
        const pings = [2093.00, 3135.96]; // C7, G7
        pings.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.2 - idx * 0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(now);
          osc.stop(now + 0.13);
        });

      } else {
        // Standard crisp hydrodynamic bubble pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.setValueAtTime(620, now + 0.035);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.10);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch {
      // Guard
    }
  }

  // ==========================================
  // 3. TURRET MISS ACOUSTICS
  // ==========================================
  public static playTurretMiss(skin: TurretSkinId = 'default'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    const now = this.audioCtx.currentTime;
    // Throttle miss sounds to prevent ear fatigue if multiple bullets leave screen simultaneously
    if (now - this.lastMissTime < 0.075) return;
    this.lastMissTime = now;

    try {
      // Soft hydrodynamic deep water whoosh / bubble fizzle
      const ctx = this.audioCtx;
      const noise = this.getNoiseBuffer();
      if (!noise) return;

      const source = ctx.createBufferSource();
      source.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(820, now);
      filter.frequency.exponentialRampToValueAtTime(290, now + 0.14);
      filter.Q.setValueAtTime(1.6, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      source.start(now);
      source.stop(now + 0.15);
    } catch {
      // Guard
    }
  }

  // ==========================================
  // 4. CRITICAL HITS & INSTANT CAPTURE
  // ==========================================
  public static playTurretCrit(skin: TurretSkinId = 'default', severity: 'crit' | 'super_crit' | 'instant_kill' = 'crit'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (severity === 'instant_kill') {
        if (this.currentTheme === 'dark') {
          this.playHorrorShriek(0.9, true);
        }
        // --- Cinematic Seismic Implosion + Ascending Sonic Boom ---
        // 1. Bass implosion transient
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(180, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + 0.28);
        subGain.gain.setValueAtTime(0.48, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        sub.connect(subGain);
        subGain.connect(this.sfxGain);
        sub.start(now);
        sub.stop(now + 0.29);

        // 2. High-speed lightning sweep
        const sweep = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweep.type = 'sawtooth';
        sweep.frequency.setValueAtTime(220, now);
        sweep.frequency.exponentialRampToValueAtTime(2600, now + 0.22);
        sweepGain.gain.setValueAtTime(0.32, now);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        sweep.connect(sweepGain);
        sweepGain.connect(this.sfxGain);
        sweep.start(now);
        sweep.stop(now + 0.25);

        // 3. Victory shimmer chime
        this.playChimeNote(now + 0.08, 1567.98, 0.25, 0.35); // G6
        this.playChimeNote(now + 0.16, 2093.00, 0.30, 0.45); // C7

      } else if (severity === 'super_crit') {
        // --- Super Critical: Dual-tone seismic boom + laser distortion crackle ---
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.14);
        gain.gain.setValueAtTime(0.38, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.19);

        // Sub impact punch
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(32, now + 0.18);
        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        sub.connect(subGain);
        subGain.connect(this.sfxGain);
        sub.start(now);
        sub.stop(now + 0.19);

        this.playFilteredNoise(now, 0.08, 3600, 3.0, 'bandpass', 0.22);

      } else {
        // --- Standard Critical: Sharp slicing laser snap + bright high chime ---
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(1380, now + 0.12);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);

        // High metallic ping
        this.playChimeNote(now, 1760.00, 0.22, 0.2); // A6
      }
    } catch {
      // Guard
    }
  }

  // =========================================================================
  // 5. PHYSICAL COIN DROP ON WIN (Cascade, Clinks, Tumbling, Hopper Waterfall)
  // =========================================================================
  /**
   * Synthesizes physical metallic coin clinks tailored to the active theme:
   * - Light Theme: Real coins hitting a wooden deck on kills (thump on wood plank + crisp brass ring + micro-bounce rattle).
   * - Dark Theme: Real coins heard through the ears of a ghost (spectral hollow resonance, eerie pitch glide, ethereal echo).
   */
  private static playSingleCoinClink(time: number, volume: number = 0.32, pitchMultiplier: number = 1.0): void {
    if (!this.audioCtx || !this.masterCompressor || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const isDark = this.currentTheme === 'dark';

    if (isDark) {
      // "heard through the ears of a ghost"
      // Hollow ghostly cavity resonance with downward spectral drift
      const freq1 = (1920 + (Math.random() - 0.5) * 240) * pitchMultiplier;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const filter1 = ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, time);
      // Downward spectral glissando like a fading phantom
      osc1.frequency.exponentialRampToValueAtTime(freq1 * 0.68, time + 0.34);

      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(780, time);
      filter1.Q.setValueAtTime(5.2, time);

      gain1.gain.setValueAtTime(volume * 0.42, time);
      gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

      osc1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start(time);
      osc1.stop(time + 0.34);

      // Ghostly overtone bell
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq1 * 1.58, time);
      osc2.frequency.exponentialRampToValueAtTime(freq1 * 1.15, time + 0.28);
      gain2.gain.setValueAtTime(volume * 0.18, time);
      gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(time);
      osc2.stop(time + 0.32);

      // Ethereal ghostly vapor whisper
      this.playFilteredNoise(time, 0.035, 620, 2.2, 'bandpass', volume * 0.14);
    } else {
      // Light Theme: "real coins hitting the deck on kills"
      // 1. Hardwood deck impact thud (low-mid woody impact)
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(280 + Math.random() * 50, time);
      thudOsc.frequency.exponentialRampToValueAtTime(60, time + 0.045);
      thudGain.gain.setValueAtTime(volume * 0.38, time);
      thudGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      thudOsc.connect(thudGain);
      thudGain.connect(this.sfxGain);
      thudOsc.start(time);
      thudOsc.stop(time + 0.055);

      // 2. Primary Metallic Ring Mode (Brass/Gold resonance: ~3100Hz)
      const freq1 = (3150 + (Math.random() - 0.5) * 350) * pitchMultiplier;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, time);
      gain1.gain.setValueAtTime(volume * 0.48, time);
      gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start(time);
      osc1.stop(time + 0.13);

      // 3. High Inharmonic Metallic Sheen (Secondary overtone mode: ~4900Hz)
      const freq2 = freq1 * 1.56;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq2, time);
      gain2.gain.setValueAtTime(volume * 0.26, time);
      gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(time);
      osc2.stop(time + 0.09);

      // 4. Micro-bounce (Secondary coin rattle on wood deck 22-38ms after drop)
      const bounceTime = time + 0.022 + Math.random() * 0.016;
      const bounceOsc = ctx.createOscillator();
      const bounceGain = ctx.createGain();
      bounceOsc.type = 'sine';
      bounceOsc.frequency.setValueAtTime(freq1 * 1.06, bounceTime);
      bounceGain.gain.setValueAtTime(volume * 0.22, bounceTime);
      bounceGain.gain.exponentialRampToValueAtTime(0.001, bounceTime + 0.06);
      bounceOsc.connect(bounceGain);
      bounceGain.connect(this.sfxGain);
      bounceOsc.start(bounceTime);
      bounceOsc.stop(bounceTime + 0.07);

      // 5. Crisp physical edge contact micro-transient (5kHz highpass noise tick)
      this.playFilteredNoise(time, 0.006, 5600, 1.1, 'highpass', volume * 0.16);
    }
  }

  /**
   * Cascading Coin Drop on Win:
   * - small: 3-4 crisp rhythmic coin drops for pay-per-hit or small fish
   * - medium: 9-11 tumbling coins pouring into metal tray with melodic reward chimes
   * - jackpot: 22-coin waterfall cascade + 7-step triumphant major arpeggio fanfare!
   */
  public static playCoinDrop(tier: 'small' | 'medium' | 'jackpot' = 'small', winAmount?: number): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // AI SFX Layer
      const aiKey = `ai_sfx_${this.currentTheme}`;
      const aiBuffer = this.aiAudioBuffers.get(aiKey);
      if (aiBuffer && this.sfxGain) {
        const source = ctx.createBufferSource();
        source.buffer = aiBuffer;
        const aiGain = ctx.createGain();
        // Lower volume for AI SFX if it's long
        aiGain.gain.setValueAtTime(0.6, now);
        source.connect(aiGain);
        aiGain.connect(this.sfxGain);
        source.start(now);
      }

      const count = tier === 'jackpot' ? 22 : tier === 'medium' ? 9 : 4;
      const baseSpacing = tier === 'jackpot' ? 0.052 : tier === 'medium' ? 0.062 : 0.072;

      for (let i = 0; i < count; i++) {
        const jitter = (Math.random() - 0.5) * 0.018;
        const dropTime = now + (i * baseSpacing) + jitter;
        // Pitch rises gently across the cascade for a rewarding acoustic arc
        const pitch = 0.94 + (i / count) * 0.22 + (Math.random() - 0.5) * 0.06;
        const vol = Math.min(0.48, 0.24 + (i / count) * 0.18);
        this.playSingleCoinClink(dropTime, vol, pitch);
      }

      if (tier === 'medium') {
        // Melodic 2-note reward chime
        this.playChimeNote(now + 0.04, 1046.50, 0.18, 0.22); // C6
        this.playChimeNote(now + 0.16, 1318.51, 0.22, 0.32); // E6

      } else if (tier === 'jackpot') {
        // Triumphant ascending 7-note celestial major arpeggio fanfare
        const notes = [
          { f: 523.25, t: 0.00 },  // C5
          { f: 659.25, t: 0.11 },  // E5
          { f: 783.99, t: 0.22 },  // G5
          { f: 1046.50, t: 0.33 }, // C6
          { f: 1318.51, t: 0.44 }, // E6
          { f: 1567.98, t: 0.56 }, // G6
          { f: 2093.00, t: 0.70 }, // C7 Grand Bell
        ];
        for (const n of notes) {
          this.playChimeNote(now + n.t, n.f, 0.26, 0.42);
        }
      }
    } catch {
      // Guard
    }
  }

  // ==========================================
  // 6. BOSS ACOUSTIC SUITE
  // ==========================================
  /**
   * Menacing Deep-Ocean Submarine Sonar Ping + Abyssal War-Horn Dread Drone
   */
  public static playBossWarning(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Submarine Sonar Ping (Pure resonant 880 Hz with long cavernous reverberation)
      if (this.currentTheme === 'dark') {
        this.playHorrorShriek(1.15);
        setTimeout(() => this.playHorrorLaughter(0.9, -15), 450);
      }
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(880, now);
      pingGain.gain.setValueAtTime(0.38, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      pingOsc.connect(pingGain);
      pingGain.connect(this.sfxGain);
      pingOsc.start(now);
      pingOsc.stop(now + 0.96);

      // Deep Abyssal Dread Horn (Low-frequency saw drone with slow vibrato)
      const hornOsc = ctx.createOscillator();
      const hornGain = ctx.createGain();
      const hornFilter = ctx.createBiquadFilter();

      hornOsc.type = 'sawtooth';
      hornOsc.frequency.setValueAtTime(58, now);
      hornOsc.frequency.linearRampToValueAtTime(68, now + 0.65);

      hornFilter.type = 'lowpass';
      hornFilter.frequency.setValueAtTime(160, now);
      hornFilter.frequency.linearRampToValueAtTime(320, now + 0.5);

      hornGain.gain.setValueAtTime(0.001, now);
      hornGain.gain.linearRampToValueAtTime(0.36, now + 0.15);
      hornGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      hornOsc.connect(hornFilter);
      hornFilter.connect(hornGain);
      hornGain.connect(this.sfxGain);

      hornOsc.start(now + 0.05);
      hornOsc.stop(now + 0.86);
    } catch {
      // Guard
    }
  }

  /**
   * Mechanical Turbine Rev-up + Emergency Siren (When Boss enters <40% HP Enrage)
   */
  public static playBossEnraged(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      if (this.currentTheme === 'dark') {
        this.playHorrorStinger(1);
        this.playHorrorShriek(1.3, true);
        // Heartbeat thuds
        [0, 0.35, 0.7].forEach((off) => {
          this.playFilteredNoise(now + off, 0.12, 70, 1.2, 'lowpass', 0.4);
        });
        setTimeout(() => this.playHorrorLaughter(0.9, -10), 550);
        const scream = ctx.createOscillator();
        const sGain = ctx.createGain();
        scream.type = 'sawtooth';
        scream.frequency.setValueAtTime(110, now);
        scream.frequency.exponentialRampToValueAtTime(40, now + 0.9);
        sGain.gain.setValueAtTime(0.3, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        scream.connect(sGain);
        sGain.connect(this.sfxGain);
        scream.start(now);
        scream.stop(now + 1.05);
        return;
      }

      // Rev-up turbine scream
      const revOsc = ctx.createOscillator();
      const revGain = ctx.createGain();
      revOsc.type = 'sawtooth';
      revOsc.frequency.setValueAtTime(180, now);
      revOsc.frequency.exponentialRampToValueAtTime(760, now + 0.35);
      revGain.gain.setValueAtTime(0.32, now);
      revGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
      revOsc.connect(revGain);
      revGain.connect(this.sfxGain);
      revOsc.start(now);
      revOsc.stop(now + 0.41);

      // Emergency klaxon pulses
      [0.0, 0.16, 0.32].forEach((tOffset, i) => {
        const siren = ctx.createOscillator();
        const sGain = ctx.createGain();
        siren.type = 'triangle';
        siren.frequency.setValueAtTime(i % 2 === 0 ? 520 : 780, now + tOffset);
        sGain.gain.setValueAtTime(0.28, now + tOffset);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + tOffset + 0.12);
        siren.connect(sGain);
        sGain.connect(this.sfxGain!);
        siren.start(now + tOffset);
        siren.stop(now + tOffset + 0.13);
      });
    } catch {
      // Guard
    }
  }

  /**
   * Monumental Multi-Stage Explosion + Victory Chime (When Boss is Defeated)
   */
  public static playBossDefeat(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // 1. Initial concussive detonation
      if (this.currentTheme === 'dark') {
        this.playHorrorShriek(1.25);
        setTimeout(() => this.playHorrorLaughter(1.1, -12), 480);
      }
      this.playFilteredNoise(now, 0.35, 240, 1.5, 'lowpass', 0.45);

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(95, now);
      sub.frequency.exponentialRampToValueAtTime(22, now + 0.45);
      subGain.gain.setValueAtTime(0.55, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + 0.46);

      // 2. Rolling secondary seismic rumble
      this.playFilteredNoise(now + 0.15, 0.5, 160, 2.0, 'lowpass', 0.38);

      // 3. Trigger torrential gold coin shower
      this.playCoinDrop('jackpot');
    } catch {
      // Guard
    }
  }

  // ==========================================
  // 7. UI SOUND SUITE
  // ==========================================
  public static playUiSound(type: 'chip_up' | 'chip_down' | 'autofire_on' | 'autofire_off' | 'currency_toggle' | 'modal_open' | 'modal_close' | 'click' | 'powerup' | 'jackpot_fanfare'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'powerup') {
        // Ascending sci-fi powerup surge
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.16);
        osc.frequency.exponentialRampToValueAtTime(1560, now + 0.32);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.40);

      } else if (type === 'jackpot_fanfare') {
        // Triumphant multi-tier level-up chord
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          this.playChimeNote(now + i * 0.08, freq, 0.28, 0.45);
        });

      } else if (type === 'chip_up') {
        // Crisp high-tech chip click (ascending pitch)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);

      } else if (type === 'chip_down') {
        // Crisp chip click (descending pitch)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.04);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);

      } else if (type === 'autofire_on') {
        // High-tech servo lock-in chirp
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.09);

      } else if (type === 'autofire_off') {
        // Power-down servo chirp
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.09);

      } else if (type === 'currency_toggle') {
        // Bright metallic chime switch
        this.playChimeNote(now, 1318.51, 0.22, 0.18); // E6
        this.playChimeNote(now + 0.06, 1760.00, 0.24, 0.22); // A6

      } else if (type === 'modal_open') {
        // Futuristic pneumatic whoosh
        this.playFilteredNoise(now, 0.12, 1200, 1.2, 'bandpass', 0.16);

      } else if (type === 'modal_close') {
        // Soft descending whoosh
        this.playFilteredNoise(now, 0.10, 800, 1.4, 'lowpass', 0.14);

      } else {
        // Generic crisp button pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.045);
      }
    } catch {
      // Guard
    }
  }

  // ==========================================
  // 8. HELPER SYNTHESIS METHODS
  // ==========================================
  private static playChimeNote(time: number, frequency: number, volume: number = 0.25, duration: number = 0.3): void {
    if (!this.audioCtx || !this.masterCompressor) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(time);
      osc.stop(time + duration + 0.01);
    } catch {
      // Guard
    }
  }

  private static playFilteredNoise(
    time: number,
    duration: number,
    frequency: number,
    q: number = 1.0,
    type: BiquadFilterType = 'bandpass',
    volume: number = 0.2
  ): void {
    if (!this.audioCtx || !this.masterCompressor) return;
    try {
      const noise = this.getNoiseBuffer();
      if (!noise) return;

      const source = this.audioCtx.createBufferSource();
      source.buffer = noise;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(frequency, time);
      filter.Q.setValueAtTime(q, time);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      source.start(time);
      source.stop(time + duration + 0.01);
    } catch {
      // Guard
    }
  }

  // Backward compatibility dispatch method
  public static playSound(type: 'fire' | 'hit' | 'coin' | 'boss_warning' | 'crit' | 'jackpot' | 'miss' | 'boss_enraged' | 'boss_defeat'): void {
    switch (type) {
      case 'fire':
        this.playTurretFire('default', 1);
        break;
      case 'hit':
        this.playTurretHit('default', 'small');
        break;
      case 'coin':
        this.playCoinDrop('small');
        break;
      case 'boss_warning':
        this.playBossWarning();
        break;
      case 'crit':
        this.playTurretCrit('default', 'crit');
        break;
      case 'jackpot':
        this.playCoinDrop('jackpot');
        break;
      case 'miss':
        this.playTurretMiss('default');
        break;
      case 'boss_enraged':
        this.playBossEnraged();
        break;
      case 'boss_defeat':
        this.playBossDefeat();
        break;
    }
  }

  // ==========================================
  // AI AUDIO ENGINE
  // ==========================================
  public static async generateAiAudio(type: 'music' | 'sfx', theme: 'light' | 'dark'): Promise<void> {
    const key = `ai_${type}_${theme}`;
    if (this.isGenerating.has(key)) return;
    this.isGenerating.add(key);

    try {
      const prompt = this.getAiPrompt(type, theme);
      const response = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const audioBase64 = data.audio;
      
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      this.initContext();
      if (!this.audioCtx) return;

      const buffer = await this.audioCtx.decodeAudioData(bytes.buffer);
      this.aiAudioBuffers.set(key, buffer);
      
      // Save to IDB
      await idbSet(key, bytes.buffer);
      
      if (type === 'music' && this.currentTheme === theme && this.bgmEnabled) {
        this.startAiMusic();
      }
    } catch (error) {
      console.error(`AI Audio generation failed for ${key}:`, error);
    } finally {
      this.isGenerating.delete(key);
    }
  }

  private static getAiPrompt(type: 'music' | 'sfx', theme: 'light' | 'dark'): string {
    if (type === 'music') {
      return theme === 'light'
        ? "A 30-second fun and bouncy arcade background music track, bright, cheerful, retro gaming vibes, catchy synthesizer melody."
        : "A 30-second haunting and ominous arcade background music track, dark ambient, ghostly whispers, deep pressure, retro gaming vibes, minimal but scary.";
    } else {
      return theme === 'light'
        ? "A short sound effect of gold coins hitting a wooden deck, bright and satisfying clinks, high quality impact."
        : "A short sound effect of gold coins hitting a deck, but heard through the ears of a ghost, echoing, hollow, spectral, distant clinks.";
    }
  }

  public static async loadAiAudioFromCache(): Promise<void> {
    const keys = ['ai_music_light', 'ai_music_dark', 'ai_sfx_light', 'ai_sfx_dark'];
    this.initContext();
    if (!this.audioCtx) return;

    for (const key of keys) {
      try {
        const data = await idbGet<ArrayBuffer>(key);
        if (data) {
          const buffer = await this.audioCtx.decodeAudioData(data.slice(0));
          this.aiAudioBuffers.set(key, buffer);
        }
      } catch (err) {
        console.warn(`Failed to load AI audio ${key} from cache:`, err);
      }
    }
  }

  public static startAiMusic(): void {
    if (!this.bgmEnabled || !this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.musicGain) return;

    const key = `ai_music_${this.currentTheme}`;
    const buffer = this.aiAudioBuffers.get(key);
    if (!buffer) {
        this.startProceduralBgm();
        return;
    }

    this.stopAiMusic();
    this.stopProceduralBgm();

    this.aiMusicSource = this.audioCtx.createBufferSource();
    this.aiMusicSource.buffer = buffer;
    this.aiMusicSource.loop = true;
    this.aiMusicSource.connect(this.musicGain);
    this.aiMusicSource.start(0);
  }

  public static stopAiMusic(): void {
    if (this.aiMusicSource) {
      try {
        this.aiMusicSource.stop();
      } catch { /* ignore */ }
      this.aiMusicSource = null;
    }
  }

  public static isGeneratingAiAudio(key: string): boolean {
    return this.isGenerating.has(key);
  }

  public static hasAiAudio(key: string): boolean {
    return this.aiAudioBuffers.has(key);
  }
}
