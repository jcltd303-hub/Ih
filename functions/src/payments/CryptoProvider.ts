import { PaymentProvider } from './PaymentProvider';

export type CryptoAsset = 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'SOL';

const ASSET_ADDRESSES: Record<CryptoAsset, string> = {
  BTC: 'bc1q-stub-btc-address-fish-frenzy',
  ETH: '0xSTUB_ETH_ADDRESS_FISH_FRENZY',
  USDT: '0xSTUB_USDT_ADDRESS_FISH_FRENZY',
  USDC: '0xSTUB_USDC_ADDRESS_FISH_FRENZY',
  SOL: 'StubSolAddressFishFrenzy111111'
};

export class CryptoProvider implements PaymentProvider {
  constructor(private asset: CryptoAsset = 'USDT') {}

  async createCheckout(
    userId: string,
    packageId: string
  ): Promise<{ checkoutUrl: string; transactionId: string }> {
    const txId = `crypto_${this.asset}_${Date.now()}_${userId.slice(0, 6)}`;
    const addr = ASSET_ADDRESSES[this.asset];
    // Stub invoice page params (no real chain)
    const checkoutUrl = `https://pay.stub.local/crypto?asset=${this.asset}&addr=${encodeURIComponent(addr)}&pkg=${packageId}&tx=${txId}`;
    return { checkoutUrl, transactionId: txId };
  }

  async handleWebhook(_data: unknown): Promise<void> {
    /* wire real processor later */
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true; // stub always verifies
  }
}

export function createCryptoProvider(asset: string): CryptoProvider {
  const a = (['BTC', 'ETH', 'USDT', 'USDC', 'SOL'].includes(asset.toUpperCase())
    ? asset.toUpperCase()
    : 'USDT') as CryptoAsset;
  return new CryptoProvider(a);
}
