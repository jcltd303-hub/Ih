import { Assets, Container, Sprite, Texture } from 'pixi.js';

/**
 * Abyssal Horror cutout puppet.
 *
 * The source artwork is a transparent model sheet, not a single boss frame.
 * We split its disconnected alpha regions at runtime and rebuild the creature
 * from those pieces so the game never renders the square source sheet itself.
 * Each piece becomes a child of a small 2-D puppet rig and receives its own
 * subtle phase-shifted motion.
 */
export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public isEnraged = false;

  private readonly artworkUrl: string;
  private readonly puppet = new Container();
  private facingSign = 1;
  private elapsed = 0;
  private loaded = false;
  private parts: Array<{ sprite: Sprite; baseX: number; baseY: number; phase: number; amplitude: number; speed: number }> = [];

  constructor(maxHp = 28, initialTheme: 'light' | 'dark' = 'dark') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;
    this.artworkUrl = new URL('../../assets/images/abyssal_horror_boss_sheet.png', import.meta.url).href;
    this.addChild(this.puppet);
    void this.loadPuppet();
  }

  private async loadPuppet(): Promise<void> {
    try {
      const texture = await Assets.load(this.artworkUrl);
      if (this.destroyed) return;

      const source = texture.source?.resource as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
      if (!source) throw new Error('Boss sheet has no drawable source');

      const width = texture.width;
      const height = texture.height;
      if (!width || !height) throw new Error('Boss sheet has invalid dimensions');

      // Decode the transparent model sheet once. Connected alpha regions are
      // the individual cutout pieces supplied by the artwork.
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Unable to create boss-sheet canvas context');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      const alpha = pixels.data;

      // Work at half resolution for component discovery. This keeps the
      // mobile cost bounded while preserving the silhouette of every part.
      const step = Math.max(1, Math.ceil(Math.max(width, height) / 1024));
      const sw = Math.ceil(width / step);
      const sh = Math.ceil(height / step);
      const visited = new Uint8Array(sw * sh);
      const components: Array<{ minX: number; minY: number; maxX: number; maxY: number; count: number }> = [];

      const opaque = (sx: number, sy: number): boolean => {
        const x = Math.min(width - 1, sx * step);
        const y = Math.min(height - 1, sy * step);
        return alpha[(y * width + x) * 4 + 3] > 18;
      };

      for (let sy = 0; sy < sh; sy++) {
        for (let sx = 0; sx < sw; sx++) {
          const seed = sy * sw + sx;
          if (visited[seed] || !opaque(sx, sy)) continue;
          const queue: number[] = [seed];
          visited[seed] = 1;
          let head = 0;
          let minX = sx, maxX = sx, minY = sy, maxY = sy, count = 0;

          while (head < queue.length) {
            const index = queue[head++];
            const x = index % sw;
            const y = Math.floor(index / sw);
            count++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            const neighbours = [index - 1, index + 1, index - sw, index + sw];
            for (const n of neighbours) {
              if (n < 0 || n >= visited.length || visited[n]) continue;
              const nx = n % sw;
              const ny = Math.floor(n / sw);
              if (Math.abs(nx - x) + Math.abs(ny - y) !== 1 || !opaque(nx, ny)) continue;
              visited[n] = 1;
              queue.push(n);
            }
          }

          // Ignore dust/noise and tiny antialiased islands.
          if (count >= 18) components.push({ minX, minY, maxX, maxY, count });
        }
      }

      // A model sheet can contain labels, guide marks, or tiny artifacts.
      // Keep the meaningful largest pieces and rebuild their original layout.
      components.sort((a, b) => b.count - a.count);
      const meaningful = components.slice(0, 18).sort((a, b) => a.minY - b.minY || a.minX - b.minX);
      const largest = meaningful[0];
      if (!largest) throw new Error('No cutout regions found in boss sheet');

      const fullScale = 260 / Math.max(width, height);
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < meaningful.length; i++) {
        const c = meaningful[i];
        const sx = c.minX * step;
        const sy = c.minY * step;
        const swidth = Math.min(width - sx, (c.maxX - c.minX + 1) * step);
        const sheight = Math.min(height - sy, (c.maxY - c.minY + 1) * step);
        if (swidth < 4 || sheight < 4) continue;

        const partCanvas = document.createElement('canvas');
        partCanvas.width = swidth;
        partCanvas.height = sheight;
        const partCtx = partCanvas.getContext('2d');
        if (!partCtx) continue;
        partCtx.drawImage(canvas, sx, sy, swidth, sheight, 0, 0, swidth, sheight);

        const part = new Sprite(Texture.from(partCanvas));
        part.anchor.set(0.5);
        const rawCenterX = sx + swidth / 2;
        const rawCenterY = sy + sheight / 2;
        const baseX = (rawCenterX - centerX) * fullScale;
        const baseY = (rawCenterY - centerY) * fullScale;
        part.position.set(baseX, baseY);
        part.scale.set(fullScale);

        // Larger regions act as the torso/core. Smaller pieces become
        // articulated appendages with different motion phases.
        const isCore = i === 0 || c.count > largest.count * 0.42;
        const phase = i * 0.71;
        const amplitude = isCore ? 0.008 : Math.min(0.055, 0.018 + i * 0.0025);
        const speed = isCore ? 2.1 : 2.7 + (i % 5) * 0.22;
        this.puppet.addChild(part);
        this.parts.push({ sprite: part, baseX, baseY, phase, amplitude, speed });
      }

      // The core should be behind articulated pieces; stable insertion order
      // from the sheet is less important than keeping all pieces visible.
      this.puppet.scale.set(1);
      this.loaded = this.parts.length > 0;
      this.puppet.visible = this.loaded;
      this.puppet.renderable = this.loaded;
    } catch (error) {
      console.error('[AbyssalHorrorBoss] Failed to build cutout puppet', error);
    }
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
  }

  public takeDamage(damage: number): boolean {
    const amount = Math.max(0, damage);
    this.currentHp = Math.max(0, this.currentHp - amount);
    if (this.currentHp <= this.maxHp * 0.35) this.isEnraged = true;
    return this.currentHp <= 0;
  }

  public update(dtScale = 1, vx = 1, _vy = 0): void {
    if (Math.abs(vx) > 0.15) this.facingSign = vx < 0 ? -1 : 1;
    this.elapsed += dtScale / 60;
    if (!this.loaded) return;

    this.puppet.scale.x = this.facingSign;
    const breathing = 1 + Math.sin(this.elapsed * 2.1) * 0.018;
    this.puppet.scale.y = breathing;

    for (const part of this.parts) {
      const wave = Math.sin(this.elapsed * part.speed + part.phase);
      const secondary = Math.cos(this.elapsed * (part.speed * 0.63) + part.phase * 1.7);
      part.sprite.x = part.baseX + secondary * 1.5;
      part.sprite.y = part.baseY + wave * 2.4;
      part.sprite.rotation = wave * part.amplitude;
    }
  }
}
