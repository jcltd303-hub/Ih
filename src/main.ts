import './style.css';
import './ui/finalArcadePolish.css';
import { Application, Graphics } from 'pixi.js';
import { GameScene } from './engine/core/GameScene';
import { AssetLoader } from './engine/systems/AssetLoader';
import { enableMobilePixiCompatibility } from './engine/systems/MobilePixiCompatibility';
import { installDarkThemeAudio } from './audio/DarkThemeAudio';
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

installDarkThemeAudio();

// If the per-frame game loop throws, Pixi's own render pass for that tick
// can get aborted right along with it — the canvas just freezes/blanks with
// nothing in the visible UI to explain why. That's especially bad on a phone
// with no attached devtools: the person testing sees a black screen and has
// no way to know it's a JS exception, let alone which one. This banner puts
// the actual error on the screen itself so it's readable without a cable.
let crashBannerShown = false;
function showCrashBanner(context: string, err: unknown): void {
  console.error(`[Fish Frenzy] ${context} threw — game loop stopped rendering new frames:`, err);
  if (crashBannerShown) return;
  crashBannerShown = true;
  const banner = document.createElement('div');
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : '';
  banner.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,0.96);color:#f8fafc;padding:16px;font:12px/1.5 ui-monospace,monospace;overflow:auto;white-space:pre-wrap;word-break:break-word;';
  banner.textContent = `[Fish Frenzy] Game loop crashed in: ${context}\n\n${message}\n\n${stack}\n\nThe canvas is frozen because this throws on every frame. Screenshot this and send it back — this is the real cause, not the canvas/rendering layer itself.`;
  document.body.appendChild(banner);
}

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

  let gameScene: GameScene;
  try {
    gameScene = new GameScene(app, root, {
      postFxEnabled: perf.postFxEnabled,
      particlesEnabled: perf.particlesEnabled
    });
  } catch (err) {
    showCrashBanner('GameScene constructor', err);
    throw err;
  }
  new CombatFeedbackOverlay(root);

  app.ticker.start();
  app.render();

  const renderSentinel = new Graphics();
  renderSentinel.rect(0, 0, app.screen.width, app.screen.height);
  renderSentinel.stroke({ width: 1, color: 0x22d3ee, alpha: 0.045 });
  renderSentinel.zIndex = -100;
  app.stage.addChild(renderSentinel);

  WalletService.getInstance().onChange((b) => gameScene.syncWalletBalances(b.goldCoins, b.sweepstakesCoins, b.source));
  app.ticker.add((ticker) => {
    try {
      gameScene.update(ticker.deltaMS);
    } catch (err) {
      showCrashBanner('GameScene.update()', err);
    }
  });

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
