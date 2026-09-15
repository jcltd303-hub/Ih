/**
 * Cryptographic Provably Fair Auditor implementing standard SHA-256 hashing
 * and uniform outcome derivation compliant with iGaming standards.
 */
export class ProvablyFairAuditor {
  /**
   * Generates a pre-committed SHA-256 hash of a server seed
   */
  public static async generateServerSeedHash(serverSeed: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(serverSeed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return this.sha256(serverSeed);
  }

  /**
   * Verifies an outcome roll deterministically using SHA-256 hash slicing.
   * Returns a reproducible float in [0, 100].
   */
  public static verifyOutcome(serverSeed: string, clientSeed: string, nonce: number): number {
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    const hashHex = this.sha256(combined);
    // Slice first 8 hex characters (32 bits of cryptographic entropy)
    const chunk = hashHex.substring(0, 8);
    const intVal = parseInt(chunk, 16);
    // Normalize to [0, 100]
    const outcome = (intVal / 0xffffffff) * 100;
    return Math.round(outcome * 100) / 100;
  }

  // Standard SHA-256 initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
  private static readonly H_INIT: Uint32Array = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  // Standard SHA-256 round constants (first 32 bits of fractional parts of cube roots of first 64 primes)
  private static readonly K: Uint32Array = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  /**
   * Pure TypeScript implementation of standard SHA-256 (FIPS 180-4)
   * for deterministic synchronous execution in both browser and Node/worker environments.
   * Uses precomputed constant tables for zero-allocation, instant computation.
   */
  public static sha256(ascii: string): string {
    const lengthProperty = 'length';
    let i = 0;
    let j = 0;
    let result = '';

    const words: number[] = [];
    const asciiBitLength = ascii[lengthProperty] * 8;

    const hash: number[] = [
      this.H_INIT[0], this.H_INIT[1], this.H_INIT[2], this.H_INIT[3],
      this.H_INIT[4], this.H_INIT[5], this.H_INIT[6], this.H_INIT[7]
    ];
    const k = this.K;

    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

    for (i = 0; i < ascii[lengthProperty]; i++) {
      words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
    }

    for (let jChunk = 0; jChunk < words[lengthProperty]; jChunk += 16) {
      const w: number[] = [];
      for (let idx = 0; idx < 16; idx++) {
        w[idx] = words[jChunk + idx] | 0;
      }

      let a = hash[0];
      let b = hash[1];
      let c = hash[2];
      let d = hash[3];
      let e = hash[4];
      let f = hash[5];
      let g = hash[6];
      let h = hash[7];

      for (i = 0; i < 64; i++) {
        if (i < 16) {
          // w[i] already set
        } else {
          const gamma0x = w[i - 15];
          const r0 = ((gamma0x >>> 7) | (gamma0x << 25)) ^ ((gamma0x >>> 18) | (gamma0x << 14)) ^ (gamma0x >>> 3);
          const gamma1x = w[i - 2];
          const r1 = ((gamma1x >>> 17) | (gamma1x << 15)) ^ ((gamma1x >>> 19) | (gamma1x << 13)) ^ (gamma1x >>> 10);
          w[i] = (w[i - 16] + r0 + w[i - 7] + r1) | 0;
        }

        const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
        const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      hash[0] = (hash[0] + a) | 0;
      hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0;
      hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0;
      hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0;
      hash[7] = (hash[7] + h) | 0;
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const bVal = (hash[i] >> (8 * j)) & 255;
        result += (bVal < 16 ? '0' : '') + bVal.toString(16);
      }
    }

    return result;
  }
}
