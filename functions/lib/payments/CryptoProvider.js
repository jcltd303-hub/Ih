"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoProvider = void 0;
exports.createCryptoProvider = createCryptoProvider;
const ASSET_ADDRESSES = {
    BTC: 'bc1q-stub-btc-address-fish-frenzy',
    ETH: '0xSTUB_ETH_ADDRESS_FISH_FRENZY',
    USDT: '0xSTUB_USDT_ADDRESS_FISH_FRENZY',
    USDC: '0xSTUB_USDC_ADDRESS_FISH_FRENZY',
    SOL: 'StubSolAddressFishFrenzy111111'
};
class CryptoProvider {
    constructor(asset = 'USDT') {
        this.asset = asset;
    }
    async createCheckout(userId, packageId) {
        const txId = `crypto_${this.asset}_${Date.now()}_${userId.slice(0, 6)}`;
        const addr = ASSET_ADDRESSES[this.asset];
        // Stub invoice page params (no real chain)
        const checkoutUrl = `https://pay.stub.local/crypto?asset=${this.asset}&addr=${encodeURIComponent(addr)}&pkg=${packageId}&tx=${txId}`;
        return { checkoutUrl, transactionId: txId };
    }
    async handleWebhook(_data) {
        /* wire real processor later */
    }
    async verifyPayment(_transactionId) {
        return true; // stub always verifies
    }
}
exports.CryptoProvider = CryptoProvider;
function createCryptoProvider(asset) {
    const a = (['BTC', 'ETH', 'USDT', 'USDC', 'SOL'].includes(asset.toUpperCase())
        ? asset.toUpperCase()
        : 'USDT');
    return new CryptoProvider(a);
}
//# sourceMappingURL=CryptoProvider.js.map