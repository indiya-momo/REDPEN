/**
 * 모바일 대문용 gate 영상 — PC momo-gate.mp4 원본은 유지, 경량본만 생성
 * 사용: npm run optimize:momo-gate-mobile
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = join(root, 'public/momo/momo-gate.mp4');
const output = join(root, 'public/momo/momo-gate-mobile.mp4');

if (!existsSync(input)) {
  console.error(`입력 파일 없음: ${input}`);
  process.exit(1);
}

if (!ffmpegPath) {
  console.error('ffmpeg-static 바이너리를 찾을 수 없습니다.');
  process.exit(1);
}

const beforeKb = (statSync(input).size / 1024).toFixed(1);

execFileSync(
  ffmpegPath,
  [
    '-y',
    '-i',
    input,
    '-an',
    '-vf',
    'scale=720:-2',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '28',
    '-movflags',
    '+faststart',
    output,
  ],
  { stdio: 'inherit' },
);

const afterKb = (statSync(output).size / 1024).toFixed(1);
console.log(
  JSON.stringify(
    {
      input: 'public/momo/momo-gate.mp4',
      output: 'public/momo/momo-gate-mobile.mp4',
      fromKb: beforeKb,
      toKb: afterKb,
    },
    null,
    2,
  ),
);
