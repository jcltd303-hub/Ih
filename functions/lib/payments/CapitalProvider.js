"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapitalProvider = void 0;
/** Stub card/bank rail — pending real Capital/processor API. */
class CapitalProvider {
    async createCheckout(userId, packageId) {
        const txId = `capital_stub_${Date.now()}_${userId.slice(0, 6)}`;
        return {
            checkoutUrl: `https://capital.stub.local/checkout?pkg=${packageId}&tx=${txId}`,
            transactionId: txId
        };
    }
    async handleWebhook(_data) { }
    async verifyPayment(_transactionId) {
        return true;
    }
}
exports.CapitalProvider = CapitalProvider;
//# sourceMappingURL=CapitalProvider.js.map