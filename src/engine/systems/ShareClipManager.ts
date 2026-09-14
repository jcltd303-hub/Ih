import { Application, Container } from 'pixi.js';
import { ParticleFXManager } from './ParticleFXManager';

export interface ClipFrame {
  timestamp: number;
  projectiles: Array<{ x: number; y: number; color: number }>;
  fish: Array<{ x: number; y: number; type: string; hpPct: number }>;
  scoreEvent?: { x: number; y: number; text: string; color: number };
}

/**
 * Records the last N seconds of gameplay as lightweight frame snapshots,
 * then renders a shareable PNG strip for social sharing.
 */
export class ShareClipManager {
  private app: Application;
  private particleFX: ParticleFXManager;
  private frames: ClipFrame[] = [];
  private readonly MAX_FRAMES = 480; // 8 seconds @ 60 FPS
  private readonly FRAME_INTERVAL = 2; // Record every 2nd frame (30 FPS capture)
  private frameCounter = 0;
  private isRecording = false;

  constructor(app: Application, particleFX: ParticleFXManager) {
    this.app = app;
    this.particleFX = particleFX;
  }

  public startRecording(): void {
    this.isRecording = true;
    this.frames = [];
    this.frameCounter = 0;
  }

  public stopRecording(): ClipFrame[] {
    this.isRecording = false;
    return [...this.frames];
  }

  public captureFrame(
    projectiles: Array<{ x: number; y: number; color: number }>,
    fish: Array<{ x: number; y: number; type: string; hpPct: number }>,
    scoreEvent?: ClipFrame['scoreEvent']
  ): void {
    if (!this.isRecording) return;

    this.frameCounter++;
    if (this.frameCounter % this.FRAME_INTERVAL !== 0) return;

    const frame: ClipFrame = {
      timestamp: Date.now(),
      projectiles: projectiles.map(p => ({ ...p })),
      fish: fish.map(f => ({ ...f })),
      scoreEvent: scoreEvent ? { ...scoreEvent } : undefined
    };

    this.frames.push(frame);
    if (this.frames.length > this.MAX_FRAMES) {
      this.frames.shift();
    }
  }

  public async generateClipThumbnail(): Promise<string | null> {
    if (this.frames.length < 10) return null;

    const width = 320;
    const height = 180;
    const cols = 4;
    const rows = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * cols;
    canvas.height = height * rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const step = Math.floor(this.frames.length / (cols * rows));
    const selected: ClipFrame[] = [];
    for (let i = 0; i < cols * rows; i++) {
      selected.push(this.frames[Math.min(i * step, this.frames.length - 1)]);
    }

    for (let i = 0; i < selected.length; i++) {
      const frame = selected[i];
      const cellX = (i % cols) * width;
      const cellY = Math.floor(i / cols) * height;

      for (const f of frame.fish) {
        const fx = cellX + (f.x / window.innerWidth) * width;
        const fy = cellY + (f.y / window.innerHeight) * height;
        const size = f.type === 'boss' ? 12 : f.type === 'medium' ? 8 : 5;
        ctx.fillStyle = f.type === 'boss' ? '#ff0055' : f.type === 'medium' ? '#f59e0b' : '#00ffcc';
        ctx.beginPath();
        ctx.arc(fx, fy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of frame.projectiles) {
        const px = cellX + (p.x / window.innerWidth) * width;
        const py = cellY + (p.y / window.innerHeight) * height;
        ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0');
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (frame.scoreEvent) {
        const sx = cellX + (frame.scoreEvent.x / window.innerWidth) * width;
        const sy = cellY + (frame.scoreEvent.y / window.innerHeight) * height;
        ctx.fillStyle = '#' + frame.scoreEvent.color.toString(16).padStart(6, '0');
        ctx.font = 'bold 10px monospace';
        ctx.fillText(frame.scoreEvent.text.slice(0, 12), sx - 20, sy);
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, 24);
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('FISH FRENZY // KILL CLIP', 10, 18);

    return canvas.toDataURL('image/png');
  }

  public async shareClip(killText: string): Promise<void> {
    const dataUrl = await this.generateClipThumbnail();
    if (!dataUrl) {
      console.warn('[ShareClipManager] Not enough frames to share');
      return;
    }

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'fish-frenzy-kill.png', { type: 'image/png' });

    const shareData: ShareData = {
      title: 'Fish Frenzy Kill!',
      text: killText,
      files: [file]
    };

    if (navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        console.warn('[ShareClipManager] Share cancelled or failed', e);
      }
    } else {
      try {
        await navigator.clipboard.writeText(dataUrl);
        console.info('[ShareClipManager] Clip copied to clipboard');
      } catch (e) {
        console.warn('[ShareClipManager] Clipboard failed', e);
      }
    }
  }
}
