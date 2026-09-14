/**
 * @deprecated No longer used to authorize shots as of the audit fix.
 *
 * This class signed requests with an HMAC secret that was hardcoded and
 * shared with the server (`processPlayerShot.ts`'s `HMAC_SECRET_KEY`
 * fallback). Because the signature was computed here, in the browser, that
 * secret was readable by anyone inspecting the shipped JS bundle — the
 * signature check on the server verified nothing an attacker couldn't
 * also produce.
 *
 * Request authorization now comes from Firebase Auth (verified
 * server-side against the ID token) plus a per-request idempotency key —
 * see `ShotSettlement.ts`. If anything else in the codebase still imports
 * `CryptoSigner`, check whether it actually needs cryptographic signing
 * (in which case the signing must happen server-side, with a secret the
 * client never sees) before re-wiring this back in.
 */
export class CryptoSigner {
  private static async unsupported(): Promise<never> {
    throw new Error(
      'CryptoSigner is deprecated: client-side HMAC signing cannot be secure ' +
        'because the signing key must ship in the browser bundle. See the ' +
        'class doc comment for the replacement approach.'
    );
  }

  public static async generateSignature(): Promise<string> {
    return this.unsupported();
  }

  public static async signPayload(): Promise<string> {
    return this.unsupported();
  }
}
