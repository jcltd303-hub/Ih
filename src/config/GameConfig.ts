/**
 * Central gameplay / engine constants.
 * Keeps magic numbers out of systems and makes balancing easier.
 */

export const GameConfig = {
  /** Max concurrent fish on screen */
  maxActiveFish: 18,

  /** ms between automatic wave spawns while playing */
  spawnIntervalMs: 2100,

  /** Auto-fire interval when HUD toggle is on */
  autoFireIntervalMs: 180,

  /** Overcharge presentation/gameplay window */
  overchargeDurationMs: 4500,
  overchargeCooldownMs: 8000,
  overchargeKillChance: 0.04,
  overchargeLuckyHitChance: 0.08,

  /** Boss pacing */
  /** Earliest boss trigger after Play; progress still gates the actual start. */
  bossGracePeriodMs: 30000,
  /** Combat progress required before another boss raid can start. */
  bossProgressThreshold: 120,

  /** Small-fish school size range when a tetra wave rolls */
  schoolSizeMin: 2,
  schoolSizeMax: 4,

  /** Initial seed waves at scene construct */
  initialWaveCount: 6,

  /** Extra waves injected when player hits Play */
  playStartExtraWaves: 4,

  /** Default bet tier index (1.00 SC) */
  defaultBetIndex: 4,

  /** Starting balances */
  startingGc: 10000,
  startingSc: 50,

  /** Turret pedestal offset from bottom of screen */
  cannonYOffset: 40,

  /** Projectile pool size */
  projectilePoolSize: 60,

  /** Shared multiplayer table id (single-table arcade for now) */
  defaultTableId: 'abyssal_trench_table_01',

  /** Local session labels used before full auth */
  localPlayerId: 'player_local',
  localSessionId: 'session_live_777',
  localDisplayName: 'NeonStriker'
};

/** Runtime override (performance presets) */
export function setMaxActiveFish(n: number): void {
  (GameConfig as { maxActiveFish: number }).maxActiveFish =
    Math.max(4, Math.min(32, n));
}
