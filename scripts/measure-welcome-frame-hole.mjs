/**
 * welcome_momo_frame3.png 중앙 투명 구멍 inset(%) 측정
 * 사용: node scripts/measure-welcome-frame-hole.mjs [png경로]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pngPath =
  process.argv[2] ?? join(root, 'public/welcome/welcome_momo_frame3.png');

const { width, height, data } = PNG.sync.read(readFileSync(pngPath));

const transparent = (x, y) => {
  const i = (width * y + x) << 2;
  return data[i + 3] < 32;
};

const cx = Math.floor(width / 2);
const cy = Math.floor(height / 2);
const queue = [[cx, cy]];
const seen = new Uint8Array(width * height);

let minX = cx;
let maxX = cx;
let minY = cy;
let maxY = cy;

while (queue.length) {
  const [x, y] = queue.pop();
  const idx = y * width + x;
  if (seen[idx] || !transparent(x, y)) continue;
  seen[idx] = 1;
  minX = Math.min(minX, x);
  maxX = Math.max(maxX, x);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  if (x > 0) queue.push([x - 1, y]);
  if (x < width - 1) queue.push([x + 1, y]);
  if (y > 0) queue.push([x, y - 1]);
  if (y < height - 1) queue.push([x, y + 1]);
}

const holeW = maxX - minX + 1;
const holeH = maxY - minY + 1;

const inset = {
  left: ((minX / width) * 100).toFixed(2),
  top: ((minY / height) * 100).toFixed(2),
  right: (((width - maxX - 1) / width) * 100).toFixed(2),
  bottom: (((height - maxY - 1) / height) * 100).toFixed(2),
};

console.log(JSON.stringify({ file: pngPath, width, height, holeW, holeH, inset }, null, 2));
console.log('\nCSS:');
console.log(`  --welcome-hole-left: ${inset.left}%;`);
console.log(`  --welcome-hole-top: ${inset.top}%;`);
console.log(`  --welcome-hole-right: ${inset.right}%;`);
console.log(`  --welcome-hole-bottom: ${inset.bottom}%;`);
