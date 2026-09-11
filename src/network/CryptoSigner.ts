export class CryptoSigner {
  private static secretKeyCache: CryptoKey | null = null;

  private static async getSigningKey(secretHex: string = 'fish_frenzy_secure_hmac_secret_key'): Promise<CryptoKey> {
    if (this.secretKeyCache) return this.secretKeyCache;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretHex);
    
    this.secretKeyCache = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );

    return this.secretKeyCache;
  }

  public static async generateSignature(
    userId: string,
    sessionId: string,
    betAmount: number,
    targetId: string,
    timestamp: number,
    nonce: string
  ): Promise<string> {
    const payload = `${userId}:${sessionId}:${betAmount}:${targetId}:${timestamp}:${nonce}`;
    const encoder = new TextEncoder();
    const key = await this.getSigningKey();

    const signatureBuffer = await window.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public static async signPayload(data: object, nonce: number): Promise<string> {
    const message = JSON.stringify({ data, nonce, timestamp: Date.now() });
    const encoder = new TextEncoder();
    const key = await this.getSigningKey();

    const signature = await window.crypto.subtle.sign("HMAC", key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
