import { PaymentProvider } from './PaymentProvider';

export class CryptoProvider implements PaymentProvider {
  async createCheckout(userId: string, packageId: string): Promise<{ checkoutUrl: string; transactionId: string }> {
    return { checkoutUrl: 'https://crypto-stub.com/invoice/123', transactionId: 'tx_crypto_123' };
  }
  async handleWebhook(data: any): Promise<void> {
    console.log('Crypto webhook', data);
  }
  async verifyPayment(transactionId: string): Promise<boolean> {
    return true;
  }
}
