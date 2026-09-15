import { PaymentProvider } from './PaymentProvider';

export class CapitalProvider implements PaymentProvider {
  async createCheckout(userId: string, packageId: string): Promise<{ checkoutUrl: string; transactionId: string }> {
    return { checkoutUrl: 'https://capital-stub.com/pay/123', transactionId: 'tx_capital_123' };
  }
  async handleWebhook(data: any): Promise<void> {
    console.log('Capital webhook', data);
  }
  async verifyPayment(transactionId: string): Promise<boolean> {
    return true;
  }
}
