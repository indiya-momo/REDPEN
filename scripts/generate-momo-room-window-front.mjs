/**
 * welcome_library2 — 창 유리(구름이 보이는 영역)만 투명한 전면 레이어 생성
 * 사용: node scripts/generate-momo-room-window-front.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'src/assets/welcome/welcome_library2.png');
const outPath = join(root, 'public/welcome/welcome_library2_window_front.png');

const { width, height, data } = PNG.sync.read(readFileSync(srcPath));
const out = new PNG({ width, height });

const isFrame = (r, g, b) => r < 55 && g < 55 && b < 60 && Math.abs(r - g) < 12;
const isSky = (r, g, b) =>
  (b >= 70 && b <= 140 && r < 70 && g < 100) ||
  (r >= 35 &&
    r <= 75 &&
    g >= 35 &&
    g <= 75 &&
    b >= 35 &&
    b <= 75 &&
    Math.abs(r - g) < 15);

/** 창 상단 하늘 pane — 구름이 지나가는 y 구간 */
const SKY_Y0 = 100;
const SKY_Y1 = 176;

let punched = 0;

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (width * y + x) << 2;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    const punchHole =
      y >= SKY_Y0 &&
      y < SKY_Y1 &&
      a > 128 &&
      !isFrame(r, g, b) &&
      isSky(r, g, b);

    if (punchHole) {
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

writeFileSync(outPath, PNG.sync.write(out));
console.log(JSON.stringify({ outPath, width, height, punched }, null, 2));
