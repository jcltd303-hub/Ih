"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeProvider = void 0;
/** Stub — no live Stripe keys. */
class StripeProvider {
    async createCheckout(userId, packageId) {
        const txId = `stripe_stub_${Date.now()}_${userId.slice(0, 6)}`;
        return {
            checkoutUrl: `https://checkout.stripe.com/stub/${packageId}?tx=${txId}`,
            transactionId: txId
        };
    }
    async handleWebhook(_data) { }
    async verifyPayment(_transactionId) {
        return true;
    }
}
exports.StripeProvider = StripeProvider;
//# sourceMappingURL=StripeProvider.js.map