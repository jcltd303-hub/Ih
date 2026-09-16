import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure 32-byte (64 hex characters) server seed.
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a SHA-256 hash of the server seed for commitment.
 */
export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

/**
 * Generates a cryptographically secure 16-byte (32 hex characters) default client seed.
 */
export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Centralized, deterministic provably-fair roll derivation.
 * Slice the first 8 hex characters (32 bits of cryptographic entropy)
 * to produce a float value in the range [0, 1).
 */
export function deriveRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const hashHex = crypto.createHash('sha256').update(`${serverSeed}:${clientSeed}:${nonce}`).digest('hex');
  const intVal = parseInt(hashHex.substring(0, 8), 16);
  return intVal / 0xffffffff; // [0, 1)
}

/**
 * Centralized, secure, constant-time HMAC-SHA256 verification to validate request integrity
 * or external payment webhooks safely, mitigating timing attack vectors.
 */
export function verifyHmac(payload: string, key: string, expectedSignature: string): boolean {
  try {
    const actualSignature = crypto.createHmac('sha256', key).update(payload).digest('hex');
    const actualBuffer = Buffer.from(actualSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
