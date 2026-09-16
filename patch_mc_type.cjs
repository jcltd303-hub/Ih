const fs = require('fs');
const path = './src/engine/systems/PayoutEngine.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `export interface ProfitSnapshot`,
  `export interface MonteCarloResult { shots: number; targetRtp: number; totalWagered: number; totalPayout: number; houseEdge: number; realizedRtp: number; }
export interface ProfitSnapshot`
);

fs.writeFileSync(path, code);
