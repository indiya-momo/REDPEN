/**
 * welcome_library_16 — 배경 전체 복사 후 창 유리(구름 영역)만 투명
 * 사용: node scripts/generate-momo-room-window-front.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import {
  isWindowFrame,
  WINDOW_FRAME_LEFT,
  WINDOW_FRAME_RIGHT,
  WINDOW_GLASS_INSET,
  WINDOW_SKY_Y0,
  WINDOW_SKY_Y1,
} from './momo-room-window-utils.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'src/assets/welcome/welcome_library_16.png');
const outPath = join(root, 'public/welcome/welcome_library_16_window_front.png');

const { width, height, data } = PNG.sync.read(readFileSync(srcPath));
const out = new PNG({ width, height });

let punched = 0;

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (width * y + x) << 2;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    const inSkyPane =
      y >= WINDOW_SKY_Y0 + WINDOW_GLASS_INSET &&
      y < WINDOW_SKY_Y1 - WINDOW_GLASS_INSET &&
      x >= WINDOW_FRAME_LEFT + WINDOW_GLASS_INSET &&
      x <= WINDOW_FRAME_RIGHT - WINDOW_GLASS_INSET;

    const punchGlass = inSkyPane && a > 128 && !isWindowFrame(r, g, b);

    if (punchGlass) {
      out.data[i] = 0;
      out.data[i + 1] = 0;
      out.data[i + 2] = 0;
      out.data[i + 3] = 0;
      punched += 1;
      continue;
    }

    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = a;
  }
}

const raw = PNG.sync.write(out);
const compressed = await sharp(raw)
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();
writeFileSync(outPath, compressed);
console.log(
  JSON.stringify(
    { outPath, width, height, punched, kb: `${(compressed.length / 1024).toFixed(1)} KB` },
    null,
    2,
  ),
);
