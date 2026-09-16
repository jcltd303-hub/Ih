const fs = require('fs');
const path = './src/engine/systems/Fish.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `    if (this.typeId === 'medium') { this.mutantPuppet?.takeDamage(amount); }
    if (this.typeId === 'small') { this.tetraPuppet?.takeDamage(amount); }
    return this.health <= 0;`,
  `    if (this.typeId === 'medium') { this.mutantPuppet?.takeDamage(amount); }
    if (this.typeId === 'small') { this.tetraPuppet?.takeDamage(amount); }
    // Trash fish are purely RNG-killed in the new Payout Engine to enforce strict RTP bounds.
    return false;`
);

fs.writeFileSync(path, code);
