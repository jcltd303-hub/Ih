export type TurretSkinId = 'default' | 'plasma_neon' | 'abyssal_dread' | 'cyber_gold';

export class SoundManager {
  private static audioCtx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static masterCompressor: DynamicsCompressorNode | null = null;
  private static noiseBuffer: AudioBuffer | null = null;
  private static enabled: boolean = (() => {
    try {
      const v = localStorage.getItem('fish_frenzy_sound');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch { /* ignore */ }
    return true;
  })();
  private static lastMissTime: number = 0;
  private static lastHitTime: number = 0;

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

        this.masterCompressor.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
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
    return this.enabled;
  }

  public static isSoundEnabled(): boolean {
    return this.enabled;
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
        gain1.connect(this.masterCompressor);
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
        gain2.connect(this.masterCompressor);
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
        subGain.connect(this.masterCompressor);
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
        kickGain.connect(this.masterCompressor);
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
        snapGain.connect(this.masterCompressor);
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
          gain.connect(this.masterCompressor!);
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
        beamGain.connect(this.masterCompressor);
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
        sGain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
        sGain.connect(this.masterCompressor);
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
        ringGain.connect(this.masterCompressor);
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
        buzzGain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
          gain.connect(this.masterCompressor!);
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
        gain.connect(this.masterCompressor);
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
      gain.connect(this.masterCompressor);

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
        subGain.connect(this.masterCompressor);
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
        sweepGain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
        subGain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
   * Synthesizes a single physical metallic coin clink with realistic inharmonic resonance,
   * hard edge impact transient, and micro-bounce echo.
   */
  private static playSingleCoinClink(time: number, volume: number = 0.32, pitchMultiplier: number = 1.0): void {
    if (!this.audioCtx || !this.masterCompressor) return;
    const ctx = this.audioCtx;

    // 1. Primary Metallic Ring Mode (Brass/Gold resonance: ~3100Hz)
    const freq1 = (3050 + (Math.random() - 0.5) * 350) * pitchMultiplier;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq1, time);
    gain1.gain.setValueAtTime(volume * 0.44, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    osc1.connect(gain1);
    gain1.connect(this.masterCompressor);
    osc1.start(time);
    osc1.stop(time + 0.14);

    // 2. High Inharmonic Metallic Sheen (Secondary overtone mode: ~4700Hz)
    const freq2 = freq1 * 1.54;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq2, time);
    gain2.gain.setValueAtTime(volume * 0.24, time);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.masterCompressor);
    osc2.start(time);
    osc2.stop(time + 0.09);

    // 3. Micro-bounce (Subtle secondary coin rattle 22-38ms after initial drop)
    const bounceTime = time + 0.022 + Math.random() * 0.016;
    const bounceOsc = ctx.createOscillator();
    const bounceGain = ctx.createGain();
    bounceOsc.type = 'sine';
    bounceOsc.frequency.setValueAtTime(freq1 * 1.06, bounceTime);
    bounceGain.gain.setValueAtTime(volume * 0.18, bounceTime);
    bounceGain.gain.exponentialRampToValueAtTime(0.001, bounceTime + 0.06);
    bounceOsc.connect(bounceGain);
    bounceGain.connect(this.masterCompressor);
    bounceOsc.start(bounceTime);
    bounceOsc.stop(bounceTime + 0.07);

    // 4. Crisp physical edge contact micro-transient (5kHz highpass noise tick)
    this.playFilteredNoise(time, 0.006, 5200, 1.0, 'highpass', volume * 0.15);
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
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(880, now);
      pingGain.gain.setValueAtTime(0.38, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      pingOsc.connect(pingGain);
      pingGain.connect(this.masterCompressor);
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
      hornGain.connect(this.masterCompressor);

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

      // Rev-up turbine scream
      const revOsc = ctx.createOscillator();
      const revGain = ctx.createGain();
      revOsc.type = 'sawtooth';
      revOsc.frequency.setValueAtTime(180, now);
      revOsc.frequency.exponentialRampToValueAtTime(760, now + 0.35);
      revGain.gain.setValueAtTime(0.32, now);
      revGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
      revOsc.connect(revGain);
      revGain.connect(this.masterCompressor);
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
        sGain.connect(this.masterCompressor!);
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
      this.playFilteredNoise(now, 0.35, 240, 1.5, 'lowpass', 0.45);

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(95, now);
      sub.frequency.exponentialRampToValueAtTime(22, now + 0.45);
      subGain.gain.setValueAtTime(0.55, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      sub.connect(subGain);
      subGain.connect(this.masterCompressor);
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
  public static playUiSound(type: 'chip_up' | 'chip_down' | 'autofire_on' | 'autofire_off' | 'currency_toggle' | 'modal_open' | 'modal_close' | 'click'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx || !this.masterCompressor) return;

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'chip_up') {
        // Crisp high-tech chip click (ascending pitch)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(gain);
        gain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
        gain.connect(this.masterCompressor);
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
      gain.connect(this.masterCompressor);
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
      gain.connect(this.masterCompressor);

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
}
