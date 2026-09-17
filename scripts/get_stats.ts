import { PayoutEngine } from '../src/engine/systems/PayoutEngine.js';
console.log(JSON.stringify(PayoutEngine.getSessionStats(), null, 2));
console.log(JSON.stringify(PayoutEngine.getProfitSnapshot(), null, 2));
