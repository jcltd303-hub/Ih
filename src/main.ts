import './style.css';
import './ui/finalArcadePolish.css';
import { Application, Graphics } from 'pixi.js';
import { GameScene } from './engine/core/GameScene';
import { AssetLoader } from './engine/systems/AssetLoader';
import { enableMobilePixiCompatibility } from './engine/systems/MobilePixiCompatibility';
import { AuthManager } from './network/AuthManager';
import { WalletService } from './network/WalletService';
import { loadPreferredTier, resolvePerformanceSettings } from './config/PerformancePresets';
import { setMaxActiveFish } from './config/GameConfig';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import App from './App';
import { Analytics } from './network/Analytics';
import { showAgeGate } from './ui/AgeGate';
import { initAppCheck } from './network/AppCheckInit';
import { FeatureFlags, prefersReducedMotion } from './config/FeatureFlags';
import { maybeShowOnboarding } from './ui/OnboardingTips';
import { CombatFeedbackOverlay } from './ui/CombatFeedbackOverlay';

async function bootstrap() {
  initAppCheck();
  if (prefersReducedMotion()) document.documentElement.classList.add('ff-reduced-motion');
  if (FeatureFlags.ageGate) {
    const ok = await showAgeGate(document.body);
    if (!ok) return;
  }

  const root = document.getElementById('app') || document.body;
  const preferred = loadPreferredTier();
  const perf = resolvePerformanceSettings(preferred ?? undefined);
  setMaxActiveFish(perf.maxFish);

  const authState = await AuthManager.getInstance().ensureSignedIn();
  try {
    const day = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('fish_frenzy_streak_day') !== day) {
      localStorage.setItem('fish_frenzy_streak_day', day);
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('ff-show-streak')), 1200);
    }
  } catch { /* ignore */ }
  const wallet = await WalletService.getInstance().connect();
  console.log(`[Fish Frenzy] auth=${authState.uid.slice(0, 8)}… wallet=${wallet.source} GC=${wallet.goldCoins} SC=${wallet.sweepstakesCoins} perf=${perf.tier}`);

  const app = new Application();
  const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  await app.init({
    width: viewportWidth,
    height: viewportHeight,
    background: '#020617',
    antialias: perf.antialias,
    resolution: perf.resolution,
    autoDensity: true,
    preference: 'webgl',
    powerPreference: perf.tier === 'low' ? 'low-power' : 'high-performance'
  });

  // Force the Pixi surface into a known visible layer. Android Chrome can
  // report a healthy renderer while CSS layout leaves the canvas covered or
  // collapsed behind the DOM HUD.
  app.canvas.style.position = 'absolute';
  app.canvas.style.left = '0';
  app.canvas.style.top = '0';
  app.canvas.style.width = '100vw';
  app.canvas.style.height = '100vh';
  app.canvas.style.display = 'block';
  app.canvas.style.zIndex = '1';
  app.canvas.style.pointerEvents = 'auto';
  app.canvas.style.touchAction = 'none';
  root.appendChild(app.canvas);

  const syncPixiViewport = () => {
    const w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    if (app.screen.width !== w || app.screen.height !== h) app.renderer.resize(w, h);
  };
  syncPixiViewport();
  window.addEventListener('resize', syncPixiViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncPixiViewport, { passive: true });

  const mobilePixiSafe = enableMobilePixiCompatibility();
  if (!mobilePixiSafe) {
    try {
      await AssetLoader.loadGameAssets();
    } catch (err) {
      console.error('[Fish Frenzy] Asset load failed', err);
      Analytics.track('asset_load_error', { message: String(err) });
    }
  } else {
    console.info('[Fish Frenzy] skipped canvas texture asset pipeline on mobile');
  }

  const gameScene = new GameScene(app, root, {
    postFxEnabled: perf.postFxEnabled,
    particlesEnabled: perf.particlesEnabled
  });
  new CombatFeedbackOverlay(root);

  // Explicitly start and render once. Do not depend on Pixi's implicit
  // Application auto-start behavior on mobile browsers.
  app.ticker.start();
  app.render();

  // A nearly invisible native Pixi border gives us a renderer-level surface
  // independent of texture loading or DOM HUD state.
  const renderSentinel = new Graphics();
  renderSentinel.rect(0, 0, app.screen.width, app.screen.height);
  renderSentinel.stroke({ width: 1, color: 0x22d3ee, alpha: 0.045 });
  renderSentinel.zIndex = -100;
  app.stage.addChild(renderSentinel);

  WalletService.getInstance().onChange((b) => gameScene.syncWalletBalances(b.goldCoins, b.sweepstakesCoins, b.source));
  app.ticker.add((ticker) => gameScene.update(ticker.deltaMS));

  console.log(`[Fish Frenzy] online @ ${perf.targetFps} FPS target, tier=${perf.tier}, maxFish=${perf.maxFish}, viewport=${app.screen.width}x${app.screen.height}`);

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
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => void bootstrap());
else void bootstrap();
