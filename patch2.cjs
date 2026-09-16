const fs = require('fs');
const path = './src/engine/systems/WeaponController.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `private onBossDamage?: (userId: string, damage: number, fishId: string) => void;`,
  `private onBossDamage?: (userId: string, damage: number, fishId: string, betAmount: number) => void;`
);

code = code.replace(
  `onBossDamage?: (userId: string, damage: number, fishId: string) => void`,
  `onBossDamage?: (userId: string, damage: number, fishId: string, betAmount: number) => void`
);

code = code.replace(
  `this.onBossDamage(proj.userId, evalHit.damage, hitEntity.id);`,
  `this.onBossDamage(proj.userId, evalHit.damage, hitEntity.id, proj.betAmount);`
);

fs.writeFileSync(path, code);
