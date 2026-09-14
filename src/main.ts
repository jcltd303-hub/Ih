import { Application } from 'pixi.js';
import { GameScene } from './engine/core/GameScene';
import { AssetLoader } from './engine/systems/AssetLoader';
import { AuthManager } from './network/AuthManager';
import { WalletService } from './network/WalletService';
import {
  loadPreferredTier,
  resolvePerformanceSettings
} from './config/PerformancePresets';
import { GameConfig, setMaxActiveFish } from './config/GameConfig';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import App from './App';

window.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('app') || document.body;

  // Performance tier (mobile/desktop / user override)
  const preferred = loadPreferredTier();
  const perf = resolvePerformanceSettings(preferred ?? undefined);
  setMaxActiveFish(perf.maxFish);

  // Auth + wallet (non-blocking for offline arcade)
  const authState = await AuthManager.getInstance().ensureSignedIn();
  const wallet = await WalletService.getInstance().connect();
  console.log(
    `[Fish Frenzy] auth=${authState.uid.slice(0, 8)}… wallet=${wallet.source} GC=${wallet.goldCoins} SC=${wallet.sweepstakesCoins} perf=${perf.tier}`
  );

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#0a0f1d',
    antialias: perf.antialias,
    resolution: perf.resolution,
    autoDensity: true,
    preference: 'webgl',
    powerPreference: perf.tier === 'low' ? 'low-power' : 'high-performance'
  });

  if (perf.targetFps === 30) {
    app.ticker.maxFPS = 30;
  }

  root.appendChild(app.canvas);

  await AssetLoader.loadGameAssets();

  const gameScene = new GameScene(app, root, {
    postFxEnabled: perf.postFxEnabled,
    particlesEnabled: perf.particlesEnabled
  });

  WalletService.getInstance().onChange((b) => {
    gameScene.syncWalletBalances(b.goldCoins, b.sweepstakesCoins, b.source);
  });

  app.ticker.add((ticker) => {
    gameScene.update(ticker.deltaMS);
  });

  console.log(
    `[Fish Frenzy] online @ ${perf.targetFps} FPS target, tier=${perf.tier}, maxFish=${perf.maxFish}`
  );

  // React status chip (auth/wallet) — does not own the game loop
  let statusHost = document.getElementById('ff-react-root');
  if (!statusHost) {
    statusHost = document.createElement('div');
    statusHost.id = 'ff-react-root';
    root.appendChild(statusHost);
  }
  createRoot(statusHost).render(createElement(App));
});
