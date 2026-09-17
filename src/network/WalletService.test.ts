import { describe, it, expect, beforeEach } from 'vitest';
import { WalletService, WalletBalances } from './WalletService';

describe('WalletService', () => {
  let wallet: WalletService;

  beforeEach(() => {
    // Need a way to reset the singleton, or just access instance
    wallet = WalletService.getInstance();
    // Reset balances manually via applyServerBalances or similar if exposed
    wallet.applyServerBalances({ goldCoins: 1000, sweepstakesCoins: 50 });
  });

  it('should initialize with correct default values', () => {
    const balances = wallet.getBalances();
    expect(balances.goldCoins).toBe(1000);
    expect(balances.sweepstakesCoins).toBe(50);
  });

  it('should spend GC correctly', () => {
    const success = wallet.trySpend('GC', 100);
    expect(success).toBe(true);
    expect(wallet.getBalances().goldCoins).toBe(900);
  });

  it('should fail spending GC with insufficient funds', () => {
    const success = wallet.trySpend('GC', 2000);
    expect(success).toBe(false);
    expect(wallet.getBalances().goldCoins).toBe(1000);
  });

  it('should spend SC correctly', () => {
    const success = wallet.trySpend('SC', 10.5);
    expect(success).toBe(true);
    expect(wallet.getBalances().sweepstakesCoins).toBe(39.5);
  });

  it('should credit correctly', () => {
    wallet.credit(500, 25);
    const balances = wallet.getBalances();
    expect(balances.goldCoins).toBe(1500);
    expect(balances.sweepstakesCoins).toBe(75);
  });
});
