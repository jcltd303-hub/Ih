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

  /**
   * Pure TypeScript implementation of standard SHA-256 (FIPS 180-4)
   * for deterministic synchronous execution in both browser and Node/worker environments.
   */
  public static sha256(ascii: string): string {
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i = 0;
    let j = 0;
    let result = '';

    const words: number[] = [];
    const asciiBitLength = ascii[lengthProperty] * 8;

    // Initial hash values: first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19
    let hash: number[] = [];
    // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311
    const k: number[] = [];
    let primeCounter = 0;

    const isPrime = (n: number) => {
      for (let factor = 2; factor * factor <= n; factor++) {
        if (n % factor === 0) return false;
      }
      return true;
    };

    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (isPrime(candidate)) {
        if (primeCounter < 8) {
          hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
        }
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter++;
      }
    }

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
