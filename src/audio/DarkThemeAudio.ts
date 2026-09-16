import { SoundManager } from './SoundManager';

/**
 * Dark-theme music patch: original NES-era adventure-game richness pushed
 * into abyssal horror.  The SoundManager owns the transport; this module
 * replaces only the dark non-boss phrase generator so the existing SFX and
 * boss soundtrack remain compatible.
 *
 * Musical design:
 * - 96 BPM, 16th-note pulse: enough room for melody + counter-melody.
 * - Minor / tritone / semitone motion instead of a static drone.
 * - Square-wave lead, triangle bass, second square counter-line, noise drums.
 * - Occasional missing beats and phrase gaps create dread instead of constant
 * loudness.
 * - Every phrase is generated with WebAudio primitives; no external assets.
 */

let installed = false;

export function installDarkThemeAudio(): void {
  if (installed) return;
  installed = true;

  const manager = SoundManager as unknown as {
    scheduleHorrorStep?: (step: number, time: number) => void;
  };

  manager.scheduleHorrorStep = (step: number, time: number) => {
    const ctx = (SoundManager as any).audioCtx as AudioContext | null;
    const out = (SoundManager as any).bgmGain as GainNode | null;
    const noiseBuffer = (SoundManager as any).getNoiseBuffer?.() as AudioBuffer | null;
    if (!ctx || !out) return;

    const phraseStep = step % 64;
    const beat = phraseStep % 16;
    const bar = Math.floor(phraseStep / 16);

    // D harmonic minor with deliberately dangerous Eb / Ab / tritone color.
    const lead = [
      293.66, 349.23, 369.99, 349.23, 293.66, 261.63, 277.18, 261.63,
      233.08, 261.63, 293.66, 349.23, 415.30, 369.99, 349.23, 277.18,
    ];
    const counter = [
      146.83, 0, 174.61, 0, 185.00, 0, 174.61, 0,
      155.56, 0, 146.83, 0, 138.59, 0, 130.81, 0,
    ];
    const bass = [
      36.71, 36.71, 43.65, 36.71, 38.89, 36.71, 46.25, 41.20,
      34.65, 34.65, 41.20, 38.89, 32.70, 36.71, 38.89, 29.14,
    ];

    const note = lead[beat];
    const bassNote = bass[beat];

    // --- 1. Triangle bass: the musical floor rather than a featureless drone.
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(bassNote, time);
    bassGain.gain.setValueAtTime(0.001, time);
    bassGain.gain.linearRampToValueAtTime(bar === 3 ? 0.15 : 0.12, time + 0.025);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.27);
    bassOsc.connect(bassGain);
    bassGain.connect(out);
    bassOsc.start(time);
    bassOsc.stop(time + 0.29);

    // --- 2. Square lead: short, stepped, memorable, deliberately sinister.
    // Leave selected notes silent so the melody breathes instead of becoming
    // an endless alarm.
    const leadRest = (beat === 6 && bar !== 2) || (beat === 13 && bar === 3);
    if (!leadRest) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note, time);
      // Tiny pitch bite on selected phrase starts.
      if ((beat === 0 && bar % 2 === 0) || (beat === 9 && bar === 3)) {
        osc.frequency.setValueAtTime(note * 0.94, time);
        osc.frequency.exponentialRampToValueAtTime(note, time + 0.035);
      }
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(bar === 3 ? 2300 : 1700, time);
      filter.Q.setValueAtTime(1.2, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(bar === 3 ? 0.075 : 0.055, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(time);
      osc.stop(time + 0.20);
    }

    // --- 3. Square counter-melody, entering on alternate bars.
    const counterNote = counter[beat];
    if (counterNote && (bar === 1 || bar === 3)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(counterNote, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.032, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(time);
      osc.stop(time + 0.26);
    }

    // --- 4. NES-style percussion: noise kick, closed hat, occasional snare.
    if (noiseBuffer) {
      const hit = beat === 0 || beat === 8;
      const snare = beat === 4 || beat === 12;
      const hat = beat % 2 === 1 || (bar === 3 && beat % 4 === 2);

      if (hit) {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, time);
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(time);
        src.stop(time + 0.13);
      }

      if (snare) {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2600, time);
        filter.Q.setValueAtTime(0.8, time);
        gain.gain.setValueAtTime(0.045, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(time);
        src.stop(time + 0.085);
      }

      if (hat) {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, time);
        gain.gain.setValueAtTime(bar === 3 ? 0.022 : 0.014, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(time);
        src.stop(time + 0.04);
      }
    }

    // --- 5. Harmonic dread: a slow two-note dissonant pad once per bar.
    if (beat === 0) {
      const padNotes = [
        [73.42, 87.31], // D2 + F2
        [77.78, 92.50], // Eb2 + F#2-ish bite
        [73.42, 103.83], // D2 + Ab2 tritone
        [69.30, 77.78], // C#2 + Eb2
      ];
      const pair = padNotes[bar];
      pair.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = index === 0 ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420 + bar * 90, time);
        filter.frequency.exponentialRampToValueAtTime(160, time + 1.9);
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(index === 0 ? 0.055 : 0.032, time + 0.30);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.95);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(time);
        osc.stop(time + 2.0);
      });
    }

    // --- 6. Rare high-register "something is watching" note.
    // It is intentionally sparse: horror comes from anticipation.
    if ((phraseStep === 31 || phraseStep === 63) && noiseBuffer) {
      const scream = ctx.createOscillator();
      const screamGain = ctx.createGain();
      scream.type = 'square';
      scream.frequency.setValueAtTime(1244.51, time);
      scream.frequency.exponentialRampToValueAtTime(830.61, time + 0.38);
      screamGain.gain.setValueAtTime(0.001, time);
      screamGain.gain.linearRampToValueAtTime(0.045, time + 0.025);
      screamGain.gain.exponentialRampToValueAtTime(0.001, time + 0.48);
      scream.connect(screamGain);
      screamGain.connect(out);
      scream.start(time);
      scream.stop(time + 0.50);

      const wind = ctx.createBufferSource();
      const wf = ctx.createBiquadFilter();
      const wg = ctx.createGain();
      wind.buffer = noiseBuffer;
      wf.type = 'bandpass';
      wf.frequency.setValueAtTime(900, time);
      wf.frequency.exponentialRampToValueAtTime(220, time + 0.55);
      wf.Q.setValueAtTime(7, time);
      wg.gain.setValueAtTime(0.001, time);
      wg.gain.linearRampToValueAtTime(0.05, time + 0.08);
      wg.gain.exponentialRampToValueAtTime(0.001, time + 0.58);
      wind.connect(wf);
      wf.connect(wg);
      wg.connect(out);
      wind.start(time);
      wind.stop(time + 0.60);
    }
  };
}
