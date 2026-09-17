
import { PayoutEngine, FishTargetType } from '../src/engine/systems/PayoutEngine.js';

const SKILL_LEVELS = [0.8, 1.0, 1.2]; // Scaling factor
const SKIN_BONUSES = [1.0, 1.5, 2.0]; // Turret Tiers
const FISH_TYPES: FishTargetType[] = ['small', 'medium'];
const KILLS_PER_SCENARIO = 100000; // 100k iterations as requested

console.log("================================================================================");
console.log("  COMPREHENSIVE MONTE CARLO SIMULATION: 100K ITERATIONS");
console.log("================================================================================\n");
console.log("| Skill | Bonus | Fish   | RTP (%) | Volatility (Variance) |");
console.log("|-------|-------|--------|---------|-----------------------|");

for (const skill of SKILL_LEVELS) {
  for (const bonus of SKIN_BONUSES) {
    for (const fishType of FISH_TYPES) {
        
        PayoutEngine.resetSessionStats();
        let totalWagered = 0;
        let totalPayout = 0;
        let outcomes: number[] = [];

        for (let i = 0; i < KILLS_PER_SCENARIO; i++) {
            const betAmount = 1.0;
            PayoutEngine.recordWager(betAmount);
            totalWagered += betAmount;

            const evalHit = PayoutEngine.evaluateHit(betAmount, fishType, bonus, skill);
            
            if (evalHit.isInstantKill) {
                const killGamble = PayoutEngine.evaluateKillMultiplier(0, fishType);
                const winAmount = betAmount * killGamble.finalMultiplier;
                totalPayout += winAmount;
                outcomes.push(winAmount);
                PayoutEngine.recordPayout(winAmount);
            } else {
                outcomes.push(0);
            }
        }
        
        const rtp = (totalPayout / totalWagered) * 100;
        
        // Calculate volatility (variance)
        const mean = totalPayout / KILLS_PER_SCENARIO;
        const variance = outcomes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / KILLS_PER_SCENARIO;
        
        console.log(`| ${skill.toFixed(1)}  | ${bonus.toFixed(1)}  | ${fishType.padEnd(6)} | ${(rtp).toFixed(2).padEnd(7)} | ${variance.toFixed(4).padEnd(21)} |`);
    }
  }
}
console.log("\n================================================================================");
console.log("  SIMULATION COMPLETE");
console.log("================================================================================");
