import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from './FirebaseClient';
import { AuthManager } from './AuthManager';
import { ProvablyFairAuditor } from '../utils/ProvablyFairAuditor';

export type FairSessionState = {
  sessionId: string;
  serverSeedHash: string;
  clientSeed: string;
  serverSeed?: string;
  status: 'local' | 'committed' | 'closed' | 'revealed';
};

/**
 * Commit–reveal session for provably fair audits.
 * Online: Cloud Function holds server seed until an irreversible close.
 * Offline: local demo commit (not production-grade).
 */
export class FairnessSession {
  private static instance: FairnessSession | null = null;
  private state: FairSessionState | null = null;

  public static getInstance(): FairnessSession {
    if (!this.instance) this.instance = new FairnessSession();
    return this.instance;
  }

  public getState(): FairSessionState | null {
    return this.state ? { ...this.state } : null;
  }

  public getSessionId(): string {
    return this.state?.sessionId || 'local_session';
  }

  public async begin(clientSeed?: string): Promise<FairSessionState> {
    const auth = AuthManager.getInstance().getState();
    const seed =
      clientSeed ||
      `client_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

    if (!isFirebaseConfigured || !auth.user) {
      const serverSeed = `local_server_${Math.random().toString(36).slice(2)}`;
      const serverSeedHash = await ProvablyFairAuditor.generateServerSeedHash(serverSeed);
      this.state = {
        sessionId: `local_${Date.now()}`,
        serverSeedHash,
        clientSeed: seed,
        serverSeed,
        status: 'local'
      };
      return { ...this.state };
    }

    try {
      const start = httpsCallable(functions, 'startGameSession');
      const res = await start({ clientSeed: seed });
      const data = (res.data || {}) as Record<string, string>;
      this.state = {
        sessionId: data.sessionId,
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed || seed,
        status: 'committed'
      };
      return { ...this.state };
    } catch (e) {
      console.warn('[FairnessSession] startGameSession failed, local fallback', e);
      const serverSeed = `local_server_${Math.random().toString(36).slice(2)}`;
      const serverSeedHash = await ProvablyFairAuditor.generateServerSeedHash(serverSeed);
      this.state = {
        sessionId: `local_${Date.now()}`,
        serverSeedHash,
        clientSeed: seed,
        serverSeed,
        status: 'local'
      };
      return { ...this.state };
    }
  }

  public async close(): Promise<FairSessionState | null> {
    if (!this.state) return null;
    if (this.state.status === 'local' || this.state.status === 'closed' || this.state.status === 'revealed') {
      return { ...this.state };
    }
    if (!isFirebaseConfigured || this.state.status !== 'committed') return { ...this.state };

    const close = httpsCallable(functions, 'closeGameSession');
    const res = await close({ sessionId: this.state.sessionId });
    const data = (res.data || {}) as Record<string, string>;
    this.state = { ...this.state, status: data.status === 'revealed' ? 'revealed' : 'closed' };
    return { ...this.state };
  }

  public async reveal(): Promise<FairSessionState | null> {
    if (!this.state) return null;
    if (this.state.status === 'local' && this.state.serverSeed) {
      this.state = { ...this.state, status: 'revealed' };
      return { ...this.state };
    }
    if (!isFirebaseConfigured || (this.state.status !== 'committed' && this.state.status !== 'closed')) {
      return this.state;
    }
    try {
      if (this.state.status === 'committed') await this.close();
      const reveal = httpsCallable(functions, 'revealSessionSeed');
      const res = await reveal({ sessionId: this.state.sessionId });
      const data = (res.data || {}) as Record<string, string>;
      this.state = {
        ...this.state,
        serverSeed: data.serverSeed,
        serverSeedHash: data.serverSeedHash || this.state.serverSeedHash,
        status: 'revealed'
      };
      return { ...this.state };
    } catch (e) {
      console.warn('[FairnessSession] reveal failed', e);
      return this.state;
    }
  }

  /** Client-side verify after reveal (does not replace server settlement). */
  public async verifyRoll(nonce: number): Promise<number | null> {
    if (!this.state?.serverSeed) return null;
    return ProvablyFairAuditor.verifyOutcome(this.state.serverSeed, this.state.clientSeed, nonce);
  }
}
