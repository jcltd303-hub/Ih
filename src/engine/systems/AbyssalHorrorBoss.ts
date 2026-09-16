import { Assets, Container, Sprite, Texture } from 'pixi.js';

export interface BossTextures {
  torsoUpper: Texture;
  torsoLower: Texture;
  head: Texture;
  jaw: Texture;
  armLeftUpper: Texture;
  armLeftLower: Texture;
  armRightUpper: Texture;
  armRightLower: Texture;
  tailFin: Texture;
}

type Region = { x: number; y: number; width: number; height: number; area: number; centerX: number; centerY: number };

/** PixiJS v8 cutout-puppet boss. The source PNG is never rendered directly. */
export class AbyssalHorrorBoss extends Container {
  public maxHp: number;
  public currentHp: number;
  public theme: 'light' | 'dark';
  public isEnraged = false;

  private readonly artworkUrl: string;
  private readonly bodyRoot = new Container();
  private readonly torsoUpper = new Container();
  private readonly torsoLower = new Container();
  private readonly head = new Container();
  private readonly jaw = new Container();
  private readonly armLeftRoot = new Container();
  private readonly armLeftLower = new Container();
  private readonly armRightRoot = new Container();
  private readonly armRightLower = new Container();
  private readonly tailRoot = new Container();
  private elapsed = 0;
  private facingSign = 1;
  private loaded = false;

  constructor(maxHp = 28, initialTheme: 'light' | 'dark' = 'dark') {
    super();
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.theme = initialTheme;
    this.artworkUrl = new URL('../../assets/images/abyssal_horror_boss_sheet.png', import.meta.url).href;
    this.addChild(this.bodyRoot);
    void this.loadAndBuildRig();
  }

  private async loadAndBuildRig(): Promise<void> {
    try {
      const texture = await Assets.load(this.artworkUrl);
      if (this.destroyed) return;
      const source = texture.source?.resource as CanvasImageSource | undefined;
      if (!source || !texture.width || !texture.height) throw new Error('Invalid boss sheet');

      const regions = this.findRegions(texture.width, texture.height, source);
      if (regions.length < 5) throw new Error(`Only ${regions.length} boss cutout regions found`);

      const sheet = document.createElement('canvas');
      sheet.width = texture.width;
      sheet.height = texture.height;
      const ctx = sheet.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Unable to create boss-sheet canvas');
      ctx.drawImage(source, 0, 0, texture.width, texture.height);

      const centerX = texture.width / 2;
      const centerY = texture.height / 2;
      const scale = 260 / Math.max(texture.width, texture.height);
      const sprites = regions.slice(0, 18).map((r) => ({ region: r, sprite: this.makePartSprite(sheet, r) }));

      const core = sprites.filter((p) => Math.abs(p.region.centerX - centerX) < texture.width * 0.24).sort((a, b) => b.region.area - a.region.area);
      const upperCore = core[0] ?? sprites[0];
      const lowerCore = core.find((p) => p !== upperCore && p.region.centerY > upperCore.region.centerY) ?? core[1] ?? sprites[1];
      const above = sprites.filter((p) => p !== upperCore && p.region.centerY < centerY).sort((a, b) => b.region.area - a.region.area);
      const below = sprites.filter((p) => p !== upperCore && p.region.centerY >= centerY).sort((a, b) => b.region.area - a.region.area);
      const head = above[0] ?? sprites[0];
      const jaw = below.find((p) => p !== lowerCore && Math.abs(p.region.centerX - head.region.centerX) < texture.width * 0.18) ?? below[0] ?? lowerCore;
      const left = sprites.filter((p) => ![upperCore, lowerCore, head, jaw].includes(p) && p.region.centerX < centerX).sort((a, b) => a.region.centerX - b.region.centerX);
      const right = sprites.filter((p) => ![upperCore, lowerCore, head, jaw].includes(p) && p.region.centerX >= centerX).sort((a, b) => b.region.centerX - a.region.centerX);
      const tail = right.find((p) => p.region.centerX > centerX + texture.width * 0.2) ?? right[0] ?? sprites[sprites.length - 1];
      const leftUpper = left[0] ?? upperCore;
      const leftLower = left.find((p) => p !== leftUpper && p.region.centerY >= leftUpper.region.centerY) ?? left[1] ?? leftUpper;
      const rightUpper = right.find((p) => p !== tail) ?? right[0] ?? upperCore;
      const rightLower = right.find((p) => p !== tail && p !== rightUpper && p.region.centerY >= rightUpper.region.centerY) ?? right[1] ?? rightUpper;

      this.mountRig({
        torsoUpper: upperCore.sprite,
        torsoLower: lowerCore.sprite,
        head: head.sprite,
        jaw: jaw.sprite,
        armLeftUpper: leftUpper.sprite,
        armLeftLower: leftLower.sprite,
        armRightUpper: rightUpper.sprite,
        armRightLower: rightLower.sprite,
        tailFin: tail.sprite,
      }, centerX, centerY, scale);
      this.loaded = true;
    } catch (error) {
      console.error('[AbyssalHorrorBoss] Failed to build cutout puppet', error);
    }
  }

  private makePartSprite(sheet: HTMLCanvasElement, r: Region): Sprite {
    const c = document.createElement('canvas');
    c.width = r.width;
    c.height = r.height;
    const pc = c.getContext('2d');
    if (!pc) throw new Error('Unable to create boss part canvas');
    pc.drawImage(sheet, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    const sprite = new Sprite(Texture.from(c));
    sprite.anchor.set(0.5);
    return sprite;
  }

  private findRegions(width: number, height: number, source: CanvasImageSource): Region[] {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(source, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    const step = Math.max(1, Math.ceil(Math.max(width, height) / 1200));
    const sw = Math.ceil(width / step), sh = Math.ceil(height / step);
    const seen = new Uint8Array(sw * sh);
    const regions: Region[] = [];
    const solid = (x: number, y: number) => data[(Math.min(height - 1, y * step) * width + Math.min(width - 1, x * step)) * 4 + 3] > 24;

    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const seed = y * sw + x;
      if (seen[seed] || !solid(x, y)) continue;
      const queue = [seed]; seen[seed] = 1; let q = 0;
      let minX = x, maxX = x, minY = y, maxY = y, count = 0;
      while (q < queue.length) {
        const n = queue[q++], nx = n % sw, ny = Math.floor(n / sw);
        count++; minX = Math.min(minX, nx); maxX = Math.max(maxX, nx); minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
        for (const next of [n - 1, n + 1, n - sw, n + sw]) {
          if (next < 0 || next >= seen.length || seen[next]) continue;
          const xx = next % sw, yy = Math.floor(next / sw);
          if (Math.abs(xx - nx) + Math.abs(yy - ny) !== 1 || !solid(xx, yy)) continue;
          seen[next] = 1; queue.push(next);
        }
      }
      if (count >= 25) {
        const rx = minX * step, ry = minY * step;
        const rw = Math.min(width - rx, (maxX - minX + 1) * step), rh = Math.min(height - ry, (maxY - minY + 1) * step);
        regions.push({ x: rx, y: ry, width: rw, height: rh, area: count, centerX: rx + rw / 2, centerY: ry + rh / 2 });
      }
    }
    return regions.sort((a, b) => b.area - a.area);
  }

  private mountRig(tex: BossTextures, centerX: number, centerY: number, scale: number): void {
    const place = (container: Container, sprite: Sprite, parent: Container, x: number, y: number) => {
      parent.addChild(container);
      container.position.set((x - centerX) * scale, (y - centerY) * scale);
      container.addChild(sprite);
      sprite.position.set(0, 0);
      sprite.scale.set(1);
    };

    // Joint containers are the rig. The numbers are joint centers in the source
    // sheet's coordinate space; sprites themselves remain unscaled cutouts.
    place(this.torsoLower, tex.torsoLower, this.bodyRoot, centerX + 10, centerY + 40);
    place(this.armRightRoot, tex.armRightUpper, this.bodyRoot, centerX + 40, centerY - 10);
    place(this.armRightLower, tex.armRightLower, this.armRightRoot, 0, 55 / scale);
    this.armRightRoot.rotation = -0.2;

    place(this.torsoUpper, tex.torsoUpper, this.bodyRoot, centerX - 30, centerY - 20);
    place(this.head, tex.head, this.torsoUpper, -160 / scale, -70 / scale);
    place(this.jaw, tex.jaw, this.head, -35 / scale, 45 / scale);

    place(this.armLeftRoot, tex.armLeftUpper, this.bodyRoot, centerX + 60, centerY + 20);
    place(this.armLeftLower, tex.armLeftLower, this.armLeftRoot, 0, 85 / scale);
    this.armLeftRoot.rotation = 0.1;

    place(this.tailRoot, tex.tailFin, this.bodyRoot, centerX + 180, centerY + 20);
  }

  public setTheme(theme: 'light' | 'dark'): void { this.theme = theme; }

  public takeDamage(damage: number): boolean {
    this.currentHp = Math.max(0, this.currentHp - Math.max(0, damage));
    if (this.currentHp <= this.maxHp * 0.35) this.isEnraged = true;
    return this.currentHp <= 0;
  }

  public update(dtScale = 1, vx = 1, _vy = 0): void {
    if (Math.abs(vx) > 0.15) this.facingSign = vx < 0 ? -1 : 1;
    this.elapsed += dtScale / 60;
    if (!this.loaded) return;
    this.bodyRoot.scale.x = this.facingSign;
    const breath = Math.sin(this.elapsed * 3) * 0.02;
    this.torsoUpper.scale.set(1 + breath);
    this.jaw.rotation = -0.08 + Math.sin(this.elapsed * 2) * 0.08;
    this.tailRoot.rotation = Math.sin(this.elapsed * 2.5) * 0.05;
    this.armLeftRoot.rotation = 0.1 + Math.sin(this.elapsed * 1.8) * 0.04;
    this.armRightRoot.rotation = -0.2 + Math.cos(this.elapsed * 1.8) * 0.04;
    this.armLeftLower.rotation = Math.sin(this.elapsed * 2.2 + 1) * 0.07;
    this.armRightLower.rotation = Math.sin(this.elapsed * 2.0) * 0.06;
  }

  public setBiteProgress(progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    this.jaw.rotation = -0.1 + p * 0.5;
    this.torsoUpper.position.x = -30 * (this.bodyRoot.scale.x >= 0 ? 1 : -1) - p * 25;
  }
}
