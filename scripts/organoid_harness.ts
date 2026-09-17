
import { PayoutEngine } from '../src/engine/systems/PayoutEngine.js';

console.log("================================================================================");
console.log("  ORGANOID TEST HARNESS: PURE-LOGIC SIMULATION");
console.log("================================================================================\n");

// 1. Initialize simulated environment
PayoutEngine.resetSessionStats();

// 2. Define simulation parameters
const SIM_TICKS = 1000;
const AUTO_SHOTS_PER_TICK = 5;
const simulatedEntities = [
  { id: '1', type: 'small' },
  { id: '2', type: 'small' },
  { id: '3', type: 'medium' }
];

console.log(`Simulating ${SIM_TICKS} game ticks with ${simulatedEntities.length} entities...`);

// 3. Automated Simulation Loop
for (let tick = 0; tick < SIM_TICKS; tick++) {
  // Automated Interaction (Turret 'playing')
  for (let shot = 0; shot < AUTO_SHOTS_PER_TICK; shot++) {
    const target = simulatedEntities[Math.floor(Math.random() * simulatedEntities.length)];
    
    // Simulate shot impact
    PayoutEngine.recordWager(1.0);
    const evalHit = PayoutEngine.evaluateHit(1.0, target.type as 'small'|'medium'|'boss');
    
    if (evalHit.isInstantKill) {
        const killGamble = PayoutEngine.evaluateKillMultiplier(1.0, target.type as 'small'|'medium'|'boss');
        PayoutEngine.recordPayout(killGamble.finalMultiplier);
    }
  }
}

// 4. Report Results
const stats = PayoutEngine.getSessionStats();
console.log("\nSimulation Results:");
console.log(`- Total Shots: ${stats.totalShots}`);
console.log(`- Total Kills: ${stats.totalKills}`);
console.log(`- Realized RTP: ${stats.realizedRtp.toFixed(2)}%`);
console.log("================================================================================");
console.log("  SIMULATION COMPLETE");
console.log("================================================================================\n");
