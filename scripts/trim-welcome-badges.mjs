/**
 * public/welcome/{1-1,1-2,1-3,2-1}.png — 투명 여백 제거 → badges-trim/
 * 배지 추가 시 원본 올린 뒤: npm run trim:badges
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'public', 'welcome');
const outDir = path.join(srcDir, 'badges-trim');
const files = ['1-1.png', '1-2.png', '1-3.png', '2-1.png'];

fs.mkdirSync(outDir, { recursive: true });

for (const name of files) {
  const src = path.join(srcDir, name);
  if (!fs.existsSync(src)) {
    console.warn('skip (missing):', name);
    continue;
  }
  const dest = path.join(outDir, name);
  const buf = await sharp(src).trim({ threshold: 1 }).png().toBuffer();
  await sharp(buf).toFile(dest);
  const { width, height } = await sharp(dest).metadata();
  console.log(`${name} → ${width}×${height}`);
}
