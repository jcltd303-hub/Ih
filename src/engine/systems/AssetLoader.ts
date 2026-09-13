import { Texture, Assets } from 'pixi.js';
import { SpriteSheetManager } from './SpriteSheetManager';

export class AssetLoader {
  private static assetsReady: boolean = false;

  public static async loadGameAssets(onProgress?: (progress: number) => void): Promise<void> {
    if (this.assetsReady) {
      if (onProgress) onProgress(1.0);
      return;
    }

    const steps = 6;
    let completed = 0;
    const reportStep = () => {
      completed++;
      if (onProgress) onProgress(completed / steps);
    };

    // Step 1: Procedural Glowing Plasma Bolt Texture
    const plasmaCanvas = document.createElement('canvas');
    plasmaCanvas.width = 32;
    plasmaCanvas.height = 32;
    const plasmaCtx = plasmaCanvas.getContext('2d')!;
    const plasmaGrad = plasmaCtx.createRadialGradient(16, 16, 2, 16, 16, 16);
    plasmaGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    plasmaGrad.addColorStop(0.3, 'rgba(0, 255, 204, 0.9)');
    plasmaGrad.addColorStop(0.7, 'rgba(0, 150, 255, 0.4)');
    plasmaGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    plasmaCtx.fillStyle = plasmaGrad;
    plasmaCtx.fillRect(0, 0, 32, 32);
    Assets.cache.set('plasma_burst', Texture.from(plasmaCanvas));
    reportStep();

    // Step 2: High-Relief Cyber Coin Token Texture
    const coinCanvas = document.createElement('canvas');
    coinCanvas.width = 32;
    coinCanvas.height = 32;
    const coinCtx = coinCanvas.getContext('2d')!;
    const coinGrad = coinCtx.createRadialGradient(13, 13, 3, 16, 16, 15);
    coinGrad.addColorStop(0, '#fffbeb');
    coinGrad.addColorStop(0.4, '#fbbf24');
    coinGrad.addColorStop(0.85, '#d97706');
    coinGrad.addColorStop(1.0, '#78350f');
    coinCtx.fillStyle = coinGrad;
    coinCtx.beginPath();
    coinCtx.arc(16, 16, 14, 0, Math.PI * 2);
    coinCtx.fill();
    coinCtx.lineWidth = 1.5;
    coinCtx.strokeStyle = '#ffffff';
    coinCtx.stroke();
    // Relief edge
    coinCtx.beginPath();
    coinCtx.arc(16, 16, 10, 0, Math.PI * 2);
    coinCtx.strokeStyle = 'rgba(120, 53, 15, 0.5)';
    coinCtx.stroke();
    Assets.cache.set('coin_token', Texture.from(coinCanvas));
    reportStep();

    // Step 3: Ambient Deep Ocean Bubble Particle Texture
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = 24;
    bubbleCanvas.height = 24;
    const bCtx = bubbleCanvas.getContext('2d')!;
    const bGrad = bCtx.createRadialGradient(10, 8, 1, 12, 12, 11);
    bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    bGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
    bGrad.addColorStop(0.9, 'rgba(14, 165, 233, 0.15)');
    bGrad.addColorStop(1.0, 'rgba(2, 132, 199, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.arc(12, 12, 10, 0, Math.PI * 2);
    bCtx.fill();
    Assets.cache.set('bubble_ambient', Texture.from(bubbleCanvas));
    reportStep();

    // Step 4: Apex Leviathan Core Texture
    const bossCanvas = document.createElement('canvas');
    bossCanvas.width = 64;
    bossCanvas.height = 64;
    const bossCtx = bossCanvas.getContext('2d')!;
    const bossGrad = bossCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
    bossGrad.addColorStop(0, '#ffffff');
    bossGrad.addColorStop(0.3, '#ff0055');
    bossGrad.addColorStop(0.7, '#7f1d1d');
    bossGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
    bossCtx.fillStyle = bossGrad;
    bossCtx.fillRect(0, 0, 64, 64);
    Assets.cache.set('boss_core', Texture.from(bossCanvas));
    reportStep();

    // Step 5: High-Voltage Shockwave Particle Texture
    const shockCanvas = document.createElement('canvas');
    shockCanvas.width = 48;
    shockCanvas.height = 48;
    const sCtx = shockCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(24, 24, 12, 24, 24, 23);
    sGrad.addColorStop(0, 'rgba(0, 255, 204, 0)');
    sGrad.addColorStop(0.8, 'rgba(0, 255, 204, 0.9)');
    sGrad.addColorStop(0.95, 'rgba(255, 255, 255, 1.0)');
    sGrad.addColorStop(1.0, 'rgba(0, 255, 204, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 48, 48);
    Assets.cache.set('shockwave_ring', Texture.from(shockCanvas));
    reportStep();

    // Step 6: Initialize Procedural Sprite Sheet Animations (Mechanical Lionfish, Tetra, Angler & Sci-Fi Turret)
    await SpriteSheetManager.getInstance().initialize();
    reportStep();

    this.assetsReady = true;
    console.log('[AssetLoader] Game assets, textures, and animated rigs loaded successfully.');
  }
}
