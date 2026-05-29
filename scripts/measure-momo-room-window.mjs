/**
 * welcome_library2.png 창 상단 하늘 pane inset(%) 측정
 * 사용: node scripts/measure-momo-room-window.mjs [png경로]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pngPath =
  process.argv[2] ?? join(root, 'src/assets/welcome/welcome_library2.png');

const { width, height, data } = PNG.sync.read(readFileSync(pngPath));

const px = (x, y) => {
  const i = (width * y + x) << 2;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

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

const pct = (v, d) => ((v / d) * 100).toFixed(2);

function detectWindowFrame() {
  const cols = [];
  for (let x = 280; x < 920; x += 1) {
    let frame = 0;
    for (let y = 95; y < 320; y += 1) {
      const [r, g, b] = px(x, y);
      if (r < 50 && g < 50 && b < 55) frame += 1;
    }
    if (frame > 80) cols.push(x);
  }

  const clusters = [];
  let group = [cols[0]];
  for (let i = 1; i < cols.length; i += 1) {
    if (cols[i] - cols[i - 1] <= 3) group.push(cols[i]);
    else {
      clusters.push(group);
      group = [cols[i]];
    }
  }
  clusters.push(group);

  const left = clusters[0][0];
  const rightCluster = clusters[clusters.length - 1];
  const right = rightCluster[rightCluster.length - 1];

  let top = height;
  let bottom = 0;
  for (let y = 80; y < 400; y += 1) {
    const [lr, lg, lb] = px(left, y);
    if (lr < 50 && lg < 50 && lb < 55) top = Math.min(top, y);
    const [rr, rg, rb] = px(right, y);
    if (rr < 50 && rg < 50 && rb < 55) bottom = Math.max(bottom, y);
  }

  return { left, right, top, bottom };
}

/** @param {number} y0 @param {number} y1 @param {{ left: number, right: number }} frame */
function measureSkyBand(y0, y1, frame) {
  const pad = 4;
  let minY = height;
  let maxY = 0;
  let count = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = frame.left + pad; x <= frame.right - pad; x += 1) {
      const [r, g, b, a] = px(x, y);
      if (a < 128 || isFrame(r, g, b) || !isSky(r, g, b)) continue;
      count += 1;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    pixels: { minY, maxY, count },
    inset: {
      left: pct(frame.left + pad, width),
      top: pct(minY, height),
      width: pct(frame.right - frame.left - pad * 2 + 1, width),
      height: pct(maxY - minY + 1, height),
    },
  };
}

const frame = detectWindowFrame();
const upper = measureSkyBand(100, 176, frame);
const full = measureSkyBand(90, 240, frame);

console.log(
  JSON.stringify({ file: pngPath, width, height, frame, upper, full }, null, 2),
);
console.log('\nCSS (upper sky panes):');
console.log(`  --momo-room-cloud-left: ${upper.inset.left}%;`);
console.log(`  --momo-room-cloud-top: ${upper.inset.top}%;`);
console.log(`  --momo-room-cloud-width: ${upper.inset.width}%;`);
console.log(`  --momo-room-cloud-height: ${upper.inset.height}%;`);
