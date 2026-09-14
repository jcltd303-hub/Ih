/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight React overlay for auth/wallet status.
 * Primary game loop remains PixiJS (`src/main.ts`) + DOM HUD (`UIManager`).
 */
import { useEffect, useState } from 'react';
import { AuthManager, AuthState } from './network/AuthManager';
import { WalletService, WalletBalances } from './network/WalletService';

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [wallet, setWallet] = useState<WalletBalances | null>(null);

  useEffect(() => {
    const authMgr = AuthManager.getInstance();
    const walletSvc = WalletService.getInstance();
    const offAuth = authMgr.onChange(setAuth);
    const offWallet = walletSvc.onChange(setWallet);
    authMgr.ensureSignedIn().then(() => walletSvc.connect()).catch(() => {});
    return () => {
      offAuth();
      offWallet();
    };
  }, []);

  if (!auth?.ready) return null;

  return (
    <div
      id="ff-react-status"
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        zIndex: 30,
        pointerEvents: 'none',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 10,
        color: '#94a3b8',
        background: 'rgba(15,23,42,0.75)',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '6px 10px',
        lineHeight: 1.4
      }}
    >
      <div>
        {auth.isAnonymous ? 'guest' : 'user'} ·{' '}
        <span style={{ color: '#00ffcc' }}>{auth.displayName}</span>
      </div>
      {wallet && (
        <div>
          wallet:{' '}
          <span style={{ color: wallet.source === 'server' ? '#34d399' : '#fbbf24' }}>
            {wallet.source}
          </span>
          {' · '}
          GC {wallet.goldCoins.toLocaleString()} · SC {wallet.sweepstakesCoins.toFixed(2)}
        </div>
      )}
    </div>
  );
}
