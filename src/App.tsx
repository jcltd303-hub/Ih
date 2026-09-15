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

  return null;
}
