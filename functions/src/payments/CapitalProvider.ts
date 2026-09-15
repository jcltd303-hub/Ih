import { PaymentProvider } from './PaymentProvider';

/** Stub card/bank rail — pending real Capital/processor API. */
export class CapitalProvider implements PaymentProvider {
  async createCheckout(
    userId: string,
    packageId: string
  ): Promise<{ checkoutUrl: string; transactionId: string }> {
    const txId = `capital_stub_${Date.now()}_${userId.slice(0, 6)}`;
    return {
      checkoutUrl: `https://capital.stub.local/checkout?pkg=${packageId}&tx=${txId}`,
      transactionId: txId
    };
  }
  async handleWebhook(_data: unknown): Promise<void> {}
  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true;
  }
}
