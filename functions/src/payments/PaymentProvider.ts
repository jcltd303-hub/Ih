export interface PaymentProvider {
  createCheckout(userId: string, packageId: string): Promise<{ checkoutUrl: string; transactionId: string }>;
  handleWebhook(data: any): Promise<void>;
  verifyPayment(transactionId: string): Promise<boolean>;
}
