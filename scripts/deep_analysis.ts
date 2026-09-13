import { runSkillSimulation, SkillProfile, FISH_CONFIGS } from './simulate_monte_carlo';

// Fish species individual economic breakdown
console.log('=== FISH SPECIES THEORETICAL & EMPIRICAL UNIT ECONOMICS ===');
for (const fish of FISH_CONFIGS) {
  const avgDmgNormal = 1.0 * (0.85 * 1.0 + 0.15 * 2.0); // 1.15 avg dmg
  const avgDmgSkin = 1.25 * (0.85 * 1.0 + 0.15 * 2.0);   // 1.4375 avg dmg
  const hitsNeededNormal = Math.ceil(fish.hp / avgDmgNormal);
  const hitsNeededSkin = Math.ceil(fish.hp / avgDmgSkin);

  const hitWin = hitsNeededNormal * 0.28;
  const killWin = fish.multiplier;
  const totalWinNormal = hitWin + killWin;
  const baseRtp100Acc = (totalWinNormal / hitsNeededNormal) * 100;

  console.log(`Fish: ${fish.type.toUpperCase()}`);
  console.log(`  HP: ${fish.hp} | Kill Multiplier: ${fish.multiplier}x`);
  console.log(`  Est. Hits Needed (Stock / Skin): ${hitsNeededNormal} / ${hitsNeededSkin}`);
  console.log(`  PPH Return: ${hitWin.toFixed(2)}x | Kill Bounty: ${killWin.toFixed(2)}x | Total: ${totalWinNormal.toFixed(2)}x`);
  console.log(`  100% Accuracy Stock RTP: ${baseRtp100Acc.toFixed(1)}%\n`);
}

// Find break-even accuracy for average player
console.log('=== ACCURACY SENSITIVITY CURVE (Fixed 10% Escape Rate, Stock Cannon) ===');
for (let acc = 0.30; acc <= 1.00; acc += 0.10) {
  const prof: SkillProfile = {
    name: `Acc ${(acc * 100).toFixed(0)}%`,
    description: '',
    accuracy: acc,
    escapeRate: 0.10,
    hasSkinUpgrade: false,
    critRate: 0.15,
    critMultiplier: 2.0
  };
  const res = runSkillSimulation(prof, 50_000);
  console.log(`Accuracy ${(acc * 100).toFixed(0)}% -> RTP: ${res.rtp.toFixed(2)}% | Shots/Kill: ${res.shotsPerKill.toFixed(2)} | House Edge: ${res.houseEdge.toFixed(2)}%`);
}
