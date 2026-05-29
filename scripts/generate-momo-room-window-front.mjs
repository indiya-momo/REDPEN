/**

 * welcome_library2 — 창 유리(구름이 보이는 영역)만 투명한 전면 레이어 생성

 * 사용: node scripts/generate-momo-room-window-front.mjs

 */

import { readFileSync, writeFileSync } from 'node:fs';

import { fileURLToPath } from 'node:url';

import { dirname, join } from 'node:path';

import sharp from 'sharp';

import { PNG } from 'pngjs';



const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const srcPath = join(root, 'src/assets/welcome/welcome_library2.png');

const outPath = join(root, 'public/welcome/welcome_library2_window_front.png');



const { width, height, data } = PNG.sync.read(readFileSync(srcPath));

const out = new PNG({ width, height });



/** 창틀·십자 mullion — 야경 유리(어두운 r≈g≈b)와 구분 */

const isFrame = (r, g, b) => {

  const lum = (r + g + b) / 3;

  if (r >= 52 && g >= 45 && b <= 42 && r >= b + 5) return true;

  if (lum < 42 && r >= 35 && g >= 28 && b <= 35 && r >= b && g >= b - 3) return true;

  if (r >= 45 && g >= 38 && b <= 38 && lum < 52) return true;

  return false;

};



/** 창 상단 pane — 구름이 지나가는 y 구간 (하단 가로 mullion 위까지) */

const SKY_Y0 = 100;

const SKY_Y1 = 176;

const FRAME_LEFT = 360;

const FRAME_RIGHT = 940;



let punched = 0;



for (let y = 0; y < height; y += 1) {

  for (let x = 0; x < width; x += 1) {

    const i = (width * y + x) << 2;

    const r = data[i];

    const g = data[i + 1];

    const b = data[i + 2];

    const a = data[i + 3];



    const inUpperWindow =

      y >= SKY_Y0 &&

      y < SKY_Y1 &&

      x >= FRAME_LEFT &&

      x <= FRAME_RIGHT;



    const punchHole = inUpperWindow && a > 128 && !isFrame(r, g, b);



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



const raw = PNG.sync.write(out);

const compressed = await sharp(raw)

  .png({ compressionLevel: 9, effort: 10 })

  .toBuffer();

writeFileSync(outPath, compressed);

console.log(

  JSON.stringify(

    {

      outPath,

      width,

      height,

      punched,

      kb: `${(compressed.length / 1024).toFixed(1)} KB`,

    },

    null,

    2,

  ),

);

