const fs = require('fs');
const path = './src/engine/systems/BossRaidEvent.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `const totalBounty = myDamage > 0 ? (myDamage * 5) + killBonus : 0;`,
  `// myDamage is strictly 1:1 with betAmount wagered (mean). Pay exactly 65% of wager back as bounty, preserving 85% total RTP.
    const totalBounty = myDamage > 0 ? (myDamage * 0.65) + killBonus : 0;`
);

// We need to also patch the killBonus to scale down so it doesn't inflate the payout.
code = code.replace(
  `const killBonus = lastHitUserId === myUid ? 500 : 0;`,
  `const killBonus = lastHitUserId === myUid ? (myDamage * 0.10) : 0; // Last hit gets +10% bonus`
);

fs.writeFileSync(path, code);
