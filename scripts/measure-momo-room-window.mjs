/**
 * welcome_library_16.png (1071×720) 창·구름 좌표 측정
 * 사용: node scripts/measure-momo-room-window.mjs [png경로]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import {
  isWindowFrame,
  MOMO_ROOM_CANVAS_H,
  MOMO_ROOM_CANVAS_W,
  MOMO_ROOM_CLOUD_X1,
  MOMO_ROOM_CLOUD_X2,
  MOMO_ROOM_CLOUD_X1_PCT,
  MOMO_ROOM_CLOUD_X2_PCT,
  MOMO_ROOM_CLOUD_Y,
  WINDOW_FRAME_LEFT,
  WINDOW_FRAME_RIGHT,
  WINDOW_SKY_Y0,
  WINDOW_SKY_Y1,
} from './momo-room-window-utils.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pngPath =
  process.argv[2] ?? join(root, 'src/assets/welcome/welcome_library_16.png');

const { width, height, data } = PNG.sync.read(readFileSync(pngPath));

const px = (x, y) => {
  const i = (width * y + x) << 2;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const pct = (v, d) => ((v / d) * 100).toFixed(2);

let punched = 0;
for (let y = WINDOW_SKY_Y0; y < WINDOW_SKY_Y1; y += 1) {
  for (let x = WINDOW_FRAME_LEFT; x <= WINDOW_FRAME_RIGHT; x += 1) {
    const [r, g, b, a] = px(x, y);
    if (a > 128 && !isWindowFrame(r, g, b)) punched += 1;
  }
}

console.log(
  JSON.stringify(
    {
      file: pngPath,
      width,
      height,
      canvas: { w: MOMO_ROOM_CANVAS_W, h: MOMO_ROOM_CANVAS_H },
      window: {
        frameLeft: WINDOW_FRAME_LEFT,
        frameRight: WINDOW_FRAME_RIGHT,
        skyY0: WINDOW_SKY_Y0,
        skyY1: WINDOW_SKY_Y1,
        punchPixels: punched,
      },
      cloud: {
        x1: MOMO_ROOM_CLOUD_X1,
        x2: MOMO_ROOM_CLOUD_X2,
        y: MOMO_ROOM_CLOUD_Y,
      },
    },
    null,
    2,
  ),
);

console.log('\nCSS:');
console.log(`  --momo-room-canvas-w: ${MOMO_ROOM_CANVAS_W};`);
console.log(`  --momo-room-canvas-h: ${MOMO_ROOM_CANVAS_H};`);
console.log(`  --momo-room-cloud-x1-px: ${MOMO_ROOM_CLOUD_X1};`);
console.log(`  --momo-room-cloud-x2-px: ${MOMO_ROOM_CLOUD_X2};`);
console.log(`  --momo-room-cloud-y-px: ${MOMO_ROOM_CLOUD_Y};`);
console.log(`  /* keyframes left: ${MOMO_ROOM_CLOUD_X1_PCT} → ${MOMO_ROOM_CLOUD_X2_PCT} */`);
