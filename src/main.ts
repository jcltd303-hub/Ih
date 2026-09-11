import { Application } from 'pixi.js';
import { GameScene } from './engine/core/GameScene';
import { AssetLoader } from './engine/systems/AssetLoader';

window.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('app') || document.body;

  // 1. Initialize PixiJS v8 Application
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#0a0f1d',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl'
  });

  root.appendChild(app.canvas);

  // 2. Preload assets
  await AssetLoader.loadGameAssets();

  // 3. Initialize GameScene
  const gameScene = new GameScene(app, root);

  // 4. Main Ticker Loop (60 FPS)
  app.ticker.add((ticker) => {
    gameScene.update(ticker.deltaMS);
  });

  console.log('[Fish Frenzy] Cyber Trench Arcade online & rendering at 60 FPS.');
});
