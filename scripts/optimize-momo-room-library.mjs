/**
 * 모모의 방 배경 PNG — 화면용 해상도로 축소 + 압축
 * 사용: node scripts/optimize-momo-room-library.mjs [입력png]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** welcome_library_16.png 디자인 캔버스 폭 */
const TARGET_W = 1071;

const inputPath =
  process.argv[2] ?? join(root, 'public/welcome/welcome_library_16.png');
const assetOut = join(root, 'src/assets/welcome/welcome_library_16.png');
const publicOut = join(root, 'public/welcome/welcome_library_16.png');

const meta = await sharp(inputPath).metadata();
const targetH = Math.round((meta.height * TARGET_W) / meta.width);

const resizedBuffer = await sharp(inputPath)
  .resize(TARGET_W, targetH, { kernel: sharp.kernel.nearest })
  .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
  .toBuffer();

writeFileSync(assetOut, resizedBuffer);
writeFileSync(publicOut, resizedBuffer);

const { width, height } = PNG.sync.read(resizedBuffer);
const kb = (resizedBuffer.length / 1024).toFixed(1);

console.log(
  JSON.stringify(
    {
      input: inputPath,
      from: `${meta.width}x${meta.height}`,
      to: `${width}x${height}`,
      bytes: resizedBuffer.length,
      kb: `${kb} KB`,
      assetOut,
      publicOut,
    },
    null,
    2,
  ),
);

console.log('\nNext: node scripts/generate-momo-room-window-front.mjs');
