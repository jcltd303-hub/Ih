/**
 * Monte Carlo Simulation Engine: 1,000,000 Kills Across Full Skill Spectrum
 * Evaluates empirical RTP, Hit Frequency, House Edge, Variance, and Payout Dynamics.
 */

export interface SkillProfile {
  name: string;
  description: string;
  accuracy: number;            // Probability a shot hits a target (vs miss)
  escapeRate: number;          // Probability a targeted fish swims away before being killed
  hasSkinUpgrade: boolean;     // 1.25x damage multiplier
  critRate: number;            // Critical hit probability (15% in game)
  critMultiplier: number;      // 2.0x damage on crit
}

export interface FishDefinition {
  type: 'small' | 'medium' | 'boss';
  hp: number;
  multiplier: number;
  spawnWeight: number;
}

export const FISH_CONFIGS: FishDefinition[] = [
  { type: 'small', hp: 2, multiplier: 1.2, spawnWeight: 0.45 },
  { type: 'medium', hp: 6, multiplier: 4.0, spawnWeight: 0.45 },
  { type: 'boss', hp: 28, multiplier: 25.0, spawnWeight: 0.10 }
];

export interface SimulationResult {
  profile: SkillProfile;
  totalKills: number;
  totalShots: number;
  totalHits: number;
  totalMisses: number;
  totalBet: number;
  payPerHitPayout: number;
  killPayout: number;
  totalPayout: number;
  rtp: number;
  houseEdge: number;
  killBreakdown: {
    small: number;
    medium: number;
    boss: number;
  };
  escapedFish: number;
  crittedHits: number;
  shotsPerKill: number;
  avgWinPerKill: number;
  variancePerShot: number;
  standardDeviationPerShot: number;
}

function pickRandomFish(): FishDefinition {
  const r = Math.random();
  if (r < 0.45) return FISH_CONFIGS[0]; // small
  if (r < 0.90) return FISH_CONFIGS[1]; // medium
  return FISH_CONFIGS[2]; // boss
}

export function runSkillSimulation(profile: SkillProfile, targetKills: number, betPerShot: number = 1.0): SimulationResult {
  let kills = 0;
  let shots = 0;
  let hits = 0;
  let misses = 0;
  let totalBet = 0;
  let payPerHitPayout = 0;
  let killPayout = 0;
  let escapedFishCount = 0;
  let crittedHits = 0;

  const killBreakdown = {
    small: 0,
    medium: 0,
    boss: 0
  };

  const skinBonus = profile.hasSkinUpgrade ? 1.25 : 1.0;
  const payPerHitRate = 0.28; // 28% of bet returned per hit

  // Variance tracking: keep sum of (payout - mean)^2 using online Welford or two-pass
  let sumPayoutSquares = 0;

  while (kills < targetKills) {
    const fish = pickRandomFish();
    let currentHp = fish.hp;
    let fishEscaped = false;

    // Simulate engagement on this fish
    while (currentHp > 0 && !fishEscaped) {
      shots++;
      totalBet += betPerShot;
      let shotPayout = 0;

      // Accuracy check
      if (Math.random() < profile.accuracy) {
        hits++;
        // Hit landed! Collect pay-per-hit
        const hitReward = betPerShot * payPerHitRate;
        payPerHitPayout += hitReward;
        shotPayout += hitReward;

        // Damage calculation
        const isCrit = Math.random() < profile.critRate;
        if (isCrit) crittedHits++;
        const critMult = isCrit ? profile.critMultiplier : 1.0;
        const damage = 1.0 * skinBonus * critMult;

        currentHp = Math.max(0, currentHp - damage);

        if (currentHp <= 0) {
          // Fish killed!
          kills++;
          const bounty = betPerShot * fish.multiplier;
          killPayout += bounty;
          shotPayout += bounty;
          killBreakdown[fish.type]++;
          sumPayoutSquares += shotPayout * shotPayout;
          break;
        }
      } else {
        misses++;
      }

      sumPayoutSquares += shotPayout * shotPayout;

      // Check if fish escaped before being finished
      // Escaping probability applies per shot exchange based on target tracking
      const escapeThreshold = profile.escapeRate / (fish.hp * 1.5);
      if (Math.random() < escapeThreshold && currentHp > 0) {
        fishEscaped = true;
        escapedFishCount++;
      }
    }
  }

  const totalPayout = payPerHitPayout + killPayout;
  const rtp = (totalPayout / totalBet) * 100;
  const houseEdge = 100 - rtp;
  const meanPayoutPerShot = totalPayout / shots;
  const variancePerShot = (sumPayoutSquares / shots) - (meanPayoutPerShot * meanPayoutPerShot);
  const standardDeviationPerShot = Math.sqrt(Math.max(0, variancePerShot));

  return {
    profile,
    totalKills: kills,
    totalShots: shots,
    totalHits: hits,
    totalMisses: misses,
    totalBet,
    payPerHitPayout,
    killPayout,
    totalPayout,
    rtp,
    houseEdge,
    killBreakdown,
    escapedFish: escapedFishCount,
    crittedHits,
    shotsPerKill: shots / kills,
    avgWinPerKill: totalPayout / kills,
    variancePerShot,
    standardDeviationPerShot
  };
}

async function main() {
  console.log('================================================================================');
  console.log('  1,000,000 KILLS MONTE CARLO SIMULATION: FULL SKILL SPECTRUM ANALYSIS');
  console.log('  System: Fish Frenzy Arcade (Pay-Per-Hit + Provably Fair RNG + Dynamic HP)');
  console.log('================================================================================\n');

  const profiles: SkillProfile[] = [
    {
      name: 'Novice (Spray & Pray)',
      description: 'Bottom 10%: Inaccurate shooting, rapid target switching, high escape rate',
      accuracy: 0.38,
      escapeRate: 0.38,
      hasSkinUpgrade: false,
      critRate: 0.15,
      critMultiplier: 2.0
    },
    {
      name: 'Casual (Recreational)',
      description: '25th-40th%: Casual aiming, occasional target trailing, moderate escape rate',
      accuracy: 0.58,
      escapeRate: 0.22,
      hasSkinUpgrade: false,
      critRate: 0.15,
      critMultiplier: 2.0
    },
    {
      name: 'Intermediate (Focused Shooter)',
      description: '50th-70th%: Good shot leading, disciplined focus fire, standard cannon',
      accuracy: 0.74,
      escapeRate: 0.12,
      hasSkinUpgrade: false,
      critRate: 0.15,
      critMultiplier: 2.0
    },
    {
      name: 'Advanced (Cannon Upgrade)',
      description: '80th-90th%: High accuracy, equipped skin bonus (+25% dmg), low escape rate',
      accuracy: 0.86,
      escapeRate: 0.05,
      hasSkinUpgrade: true,
      critRate: 0.15,
      critMultiplier: 2.0
    },
    {
      name: 'Expert / Master (Sharpshooter)',
      description: '95th-99th%: Near-perfect target tracking, prioritization, skin upgrade',
      accuracy: 0.95,
      escapeRate: 0.02,
      hasSkinUpgrade: true,
      critRate: 0.15,
      critMultiplier: 2.0
    },
    {
      name: 'Theoretical Optimal (Ceiling)',
      description: '100th%: Flawless aim (100% accuracy), 0% escape rate, skin upgrade',
      accuracy: 1.00,
      escapeRate: 0.00,
      hasSkinUpgrade: true,
      critRate: 0.15,
      critMultiplier: 2.0
    }
  ];

  // 1,000,000 kills in total across the skill profiles (or 200k per tier)
  // Let's also do a full 1,000,000 kills aggregate run!
  const killsPerCohort = 200_000; // 5 cohorts * 200k = 1,000,000 kills total
  console.log(`Executing 1,000,000 total kills across 5 representative cohorts (${killsPerCohort.toLocaleString()} kills each)...`);

  const startTime = Date.now();
  const results: SimulationResult[] = [];

  for (let i = 0; i < 5; i++) {
    const prof = profiles[i];
    process.stdout.write(`Simulating ${prof.name} [${killsPerCohort.toLocaleString()} kills]... `);
    const cohortStart = Date.now();
    const res = runSkillSimulation(prof, killsPerCohort);
    results.push(res);
    console.log(`Done in ${((Date.now() - cohortStart) / 1000).toFixed(2)}s (RTP: ${res.rtp.toFixed(2)}%)`);
  }

  // Also simulate the theoretical ceiling profile for comparison
  console.log(`Simulating Theoretical Optimal Ceiling [100,000 kills benchmark]...`);
  const optimalRes = runSkillSimulation(profiles[5], 100_000);
  results.push(optimalRes);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nCompleted in ${duration}s!\n`);

  // Aggregate stats across the 1,000,000 kills
  const aggregatedKills = results.slice(0, 5).reduce((acc, r) => acc + r.totalKills, 0);
  const aggregatedShots = results.slice(0, 5).reduce((acc, r) => acc + r.totalShots, 0);
  const aggregatedHits = results.slice(0, 5).reduce((acc, r) => acc + r.totalHits, 0);
  const aggregatedMisses = results.slice(0, 5).reduce((acc, r) => acc + r.totalMisses, 0);
  const aggregatedBet = results.slice(0, 5).reduce((acc, r) => acc + r.totalBet, 0);
  const aggregatedPayPerHit = results.slice(0, 5).reduce((acc, r) => acc + r.payPerHitPayout, 0);
  const aggregatedKillPayout = results.slice(0, 5).reduce((acc, r) => acc + r.killPayout, 0);
  const aggregatedTotalPayout = aggregatedPayPerHit + aggregatedKillPayout;
  const aggregatedRTP = (aggregatedTotalPayout / aggregatedBet) * 100;

  console.log('================================================================================');
  console.log('                          AGGREGATED 1,000,000 KILLS RESULTS');
  console.log('================================================================================');
  console.log(`Total Kills Recorded:        ${aggregatedKills.toLocaleString()}`);
  console.log(`Total Shots Fired:           ${aggregatedShots.toLocaleString()}`);
  console.log(`Total Hits Landed:           ${aggregatedHits.toLocaleString()} (${((aggregatedHits / aggregatedShots) * 100).toFixed(2)}%)`);
  console.log(`Total Misses:                ${aggregatedMisses.toLocaleString()} (${((aggregatedMisses / aggregatedShots) * 100).toFixed(2)}%)`);
  console.log(`Total Turnover (Bet):        $${aggregatedBet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Pay-Per-Hit Payouts:         $${aggregatedPayPerHit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((aggregatedPayPerHit / aggregatedTotalPayout) * 100).toFixed(1)}% of returns)`);
  console.log(`Kill Multiplier Payouts:     $${aggregatedKillPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((aggregatedKillPayout / aggregatedTotalPayout) * 100).toFixed(1)}% of returns)`);
  console.log(`Total Payout Returned:       $${aggregatedTotalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Overall Composite RTP:       ${aggregatedRTP.toFixed(2)}%`);
  console.log(`Overall House Edge:          ${(100 - aggregatedRTP).toFixed(2)}%`);
  console.log(`Average Shots Per Kill:      ${(aggregatedShots / aggregatedKills).toFixed(2)}`);
  console.log('================================================================================\n');

  console.log('================================================================================');
  console.log('                     SKILL TIER DETAILED BREAKDOWN TABLE');
  console.log('================================================================================');
  console.log('| Profile               | Accuracy | Escapes | Shots/Kill | Hit Payout | Kill Payout | RTP (%)  | House Edge | StdDev/Shot |');
  console.log('|-----------------------|----------|---------|------------|------------|-------------|----------|------------|-------------|');
  for (const r of results) {
    const name = r.profile.name.padEnd(21);
    const acc = `${(r.profile.accuracy * 100).toFixed(0)}%`.padEnd(8);
    const esc = `${r.escapedFish.toLocaleString()}`.padEnd(7);
    const spk = r.shotsPerKill.toFixed(2).padEnd(10);
    const hp = `$${r.payPerHitPayout.toFixed(0)}`.padEnd(10);
    const kp = `$${r.killPayout.toFixed(0)}`.padEnd(11);
    const rtp = `${r.rtp.toFixed(2)}%`.padEnd(8);
    const he = `${r.houseEdge.toFixed(2)}%`.padEnd(10);
    const sd = r.standardDeviationPerShot.toFixed(3).padEnd(11);
    console.log(`| ${name} | ${acc} | ${esc} | ${spk} | ${hp} | ${kp} | ${rtp} | ${he} | ${sd} |`);
  }
  console.log('================================================================================\n');
}

main().catch(console.error);
