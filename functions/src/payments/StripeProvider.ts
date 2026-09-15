import { PaymentProvider } from './PaymentProvider';

/** Stub — no live Stripe keys. */
export class StripeProvider implements PaymentProvider {
  async createCheckout(
    userId: string,
    packageId: string
  ): Promise<{ checkoutUrl: string; transactionId: string }> {
    const txId = `stripe_stub_${Date.now()}_${userId.slice(0, 6)}`;
    return {
      checkoutUrl: `https://checkout.stripe.com/stub/${packageId}?tx=${txId}`,
      transactionId: txId
    };
  }
  async handleWebhook(_data: unknown): Promise<void> {}
  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true;
  }
}
