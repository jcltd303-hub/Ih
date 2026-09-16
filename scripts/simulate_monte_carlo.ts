import { PayoutEngine } from '../src/engine/systems/PayoutEngine.js';

console.log("================================================================================");
console.log("  1,000,000 SHOTS MONTE CARLO SIMULATION: PURE RTP MATH AUDIT");
console.log("  System: Fish Frenzy Arcade (Strict 85% bounded RTP across all bet sizes)");
console.log("================================================================================\n");

const numShots = 1000000;
let totalWagered = 0;
let totalPayout = 0;

let hitPayouts = 0;
let killPayouts = 0;

for (let i = 0; i < numShots; i++) {
  const betAmount = Math.random() < 0.5 ? 1 : 50; // Mix of $1 and $50 bets
  const fishTypeRoll = Math.random();
  const fishType = fishTypeRoll < 0.6 ? 'small' : fishTypeRoll < 0.95 ? 'medium' : 'boss';
  
  PayoutEngine.recordWager(betAmount);
  totalWagered += betAmount;
  
  const evalHit = PayoutEngine.evaluateHit(betAmount, fishType);
  
  hitPayouts += evalHit.hitPayout;
  totalPayout += evalHit.hitPayout;
  PayoutEngine.recordPayout(evalHit.hitPayout);

  if (evalHit.isInstantKill && fishType !== 'boss') {
    const killGamble = PayoutEngine.evaluateKillMultiplier(0, fishType);
    const winAmount = betAmount * killGamble.finalMultiplier;
    killPayouts += winAmount;
    totalPayout += winAmount;
    PayoutEngine.recordPayout(winAmount);
  }
}

console.log(`Total Wagered:    $${totalWagered.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`Total Hit Payout: $${hitPayouts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${((hitPayouts / totalWagered) * 100).toFixed(2)}%)`);
console.log(`Total Kill Payout:$${killPayouts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${((killPayouts / totalWagered) * 100).toFixed(2)}%)`);
console.log(`Total Payout:     $${totalPayout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`\nOVERALL RTP:      ${((totalPayout / totalWagered) * 100).toFixed(2)}%`);
console.log("================================================================================\n");
