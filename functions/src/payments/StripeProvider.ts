import { PaymentProvider } from './PaymentProvider';

export class StripeProvider implements PaymentProvider {
  async createCheckout(userId: string, packageId: string): Promise<{ checkoutUrl: string; transactionId: string }> {
    return { checkoutUrl: 'https://stripe-stub.com/checkout/123', transactionId: 'tx_stripe_123' };
  }
  async handleWebhook(data: any): Promise<void> {
    console.log('Stripe webhook', data);
  }
  async verifyPayment(transactionId: string): Promise<boolean> {
    return true;
  }
}
