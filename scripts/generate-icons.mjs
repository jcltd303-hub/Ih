/**
 * Generates simple PNG placeholders for Capacitor from a procedural buffer.
 * For production, replace resources/icon.png with branded 1024×1024 art.
 * Usage: node scripts/generate-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'resources');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeB = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeB, data]));
  crc.writeUInt32BE(crcVal);
  return Buffer.concat([len, typeB, data, crc]);
}

/** Solid-ish gradient PNG (RGB) */
function writePng(file, size, top, bot) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const r = Math.round(top[0] * (1 - t) + bot[0] * t);
      const g = Math.round(top[1] * (1 - t) * (0.5 + 0.5 * u) + bot[1] * t);
      const b = Math.round(top[2] * (1 - t) + bot[2] * t * (0.6 + 0.4 * u));
      const i = 1 + x * 3;
      row[i] = r; row[i + 1] = g; row[i + 2] = b;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}

fs.mkdirSync(outDir, { recursive: true });
writePng(path.join(outDir, 'icon.png'), 1024, [10, 15, 29], [0, 255, 204]);
writePng(path.join(outDir, 'icon-foreground.png'), 1024, [14, 116, 144], [255, 0, 127]);
writePng(path.join(outDir, 'splash.png'), 2732, [10, 15, 29], [8, 145, 178]);
writePng(path.join(outDir, 'splash-dark.png'), 2732, [2, 6, 18], [15, 23, 42]);
console.log('Wrote resources/icon.png, splash.png (+ variants)');
