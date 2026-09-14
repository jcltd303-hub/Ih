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
import { Analytics } from './network/Analytics';
import { showAgeGate } from './ui/AgeGate';
import { initAppCheck } from './network/AppCheckInit';
import { FeatureFlags, prefersReducedMotion } from './config/FeatureFlags';
import { maybeShowOnboarding } from './ui/OnboardingTips';

window.addEventListener('DOMContentLoaded', async () => {
  initAppCheck();
  if (prefersReducedMotion()) {
    document.documentElement.classList.add('ff-reduced-motion');
  }
  if (FeatureFlags.ageGate) {
    const ok = await showAgeGate(document.body);
    if (!ok) return;
  }

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

  try {
    await AssetLoader.loadGameAssets();
  } catch (err) {
    console.error('[Fish Frenzy] Asset load failed', err);
    Analytics.track('asset_load_error', { message: String(err) });
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100;background:#7f1d1d;color:#fecaca;padding:10px 16px;border-radius:8px;font:12px monospace;';
    banner.textContent = 'Asset load issue — some sprites may be missing. Game continues.';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 6000);
  }

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

  Analytics.track('session_start', { tier: perf.tier, maxFish: perf.maxFish });
  maybeShowOnboarding(root instanceof HTMLElement ? root : document.body);

  window.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    Analytics.track('webgl_context_lost');
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100;background:#1e293b;color:#fbbf24;padding:10px 16px;border-radius:8px;font:12px monospace;';
    banner.textContent = 'Graphics context lost — reload the page to recover.';
    document.body.appendChild(banner);
  }, { capture: true });
});
