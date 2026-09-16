/**
 * Abyssal Horror Boss — Dark Theme Organic Idle
 * PixiJS hierarchical sprite + exact keyframe tracks from the model sheet.
 * 2.0 s / 60-frame seamless ping-pong loop @ 30 FPS.
 *
 * Tracks implemented:
 *  - body_root     (Position Y + Scale Y/X breathing)
 *  - jaw           (Rotation)
 *  - tentacle_mouth (Rotation + local X offset)
 *  - dorsal_fins   (3-segment cascading rotation)
 *  - tail_fin_assembly (lateral sweep)
 *
 * Easing: smoothstep (ease-in-out) between keyframes.
 */

import { Container, Sprite, Texture, Graphics, Text, TextStyle } from 'pixi.js';

export type Keyframe = { frame: number; values: Record<string, number> };

const FPS = 30;
const TOTAL_FRAMES = 60;
const LOOP_DURATION = 2.0; // seconds

/** Smoothstep ease-in-out (0–1 → 0–1) */
function easeInOut(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/** Linear interpolate */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Sample a 1-D keyframe track at a given frame (with ease-in-out between keys).
 * Keys must be sorted by frame and the last key must equal the first for seamless loop.
 */
function sampleTrack(keys: { frame: number; value: number }[], frame: number): number {
  if (keys.length === 0) return 0;
  // wrap
  const f = ((frame % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;

  // find surrounding keys
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].frame <= f) i++;

  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];

  if (a.frame === b.frame) return a.value;

  const t = (f - a.frame) / (b.frame - a.frame);
  return lerp(a.value, b.value, easeInOut(t));
}

// ---------------------------------------------------------------------------
// Keyframe data (exactly as specified)
// ---------------------------------------------------------------------------

const BODY_POS_Y: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 15, value: 3.5 },
  { frame: 30, value: 0.0 },
  { frame: 45, value: -2.0 },
  { frame: 60, value: 0.0 },
];

const BODY_SCALE_Y: { frame: number; value: number }[] = [
  { frame: 0, value: 1.0 },
  { frame: 15, value: 1.03 },
  { frame: 30, value: 1.0 },
  { frame: 45, value: 0.98 },
  { frame: 60, value: 1.0 },
];

const BODY_SCALE_X: { frame: number; value: number }[] = [
  { frame: 0, value: 1.0 },
  { frame: 15, value: 0.98 },
  { frame: 30, value: 1.0 },
  { frame: 45, value: 1.02 },
  { frame: 60, value: 1.0 },
];

const JAW_ROT: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 20, value: 4.5 },
  { frame: 40, value: -1.5 },
  { frame: 60, value: 0.0 },
];

const TENTACLE_ROT: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 12, value: 6.0 },
  { frame: 25, value: -4.0 },
  { frame: 42, value: 3.0 },
  { frame: 60, value: 0.0 },
];

const TENTACLE_X: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 12, value: 2.1 },
  { frame: 25, value: -1.5 },
  { frame: 42, value: 1.0 },
  { frame: 60, value: 0.0 },
];

// Dorsal fin chain (phase-shifted)
const FIN1_ROT: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 20, value: 2.0 },
  { frame: 40, value: -1.0 },
  { frame: 60, value: 0.0 },
];
const FIN3_ROT: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 25, value: 4.0 },
  { frame: 45, value: -2.5 },
  { frame: 60, value: 0.0 },
];
const FIN5_ROT: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 30, value: 6.5 },
  { frame: 50, value: -4.0 },
  { frame: 60, value: 0.0 },
];

const TAIL_ROT: { frame: number; value: number }[] = [
  { frame: 0, value: 0.0 },
  { frame: 18, value: -5.2 },
  { frame: 38, value: 6.8 },
  { frame: 60, value: 0.0 },
];

// ---------------------------------------------------------------------------
// Boss class
// ---------------------------------------------------------------------------

export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
... 
