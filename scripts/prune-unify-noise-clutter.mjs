/**
 * OCR/잘림 일회 조각 정리 + 담화 예외→접속 휴리스틱 이관
 *   node scripts/prune-unify-noise-clutter.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/data/unify-noise-list.json');
const apply = process.argv.includes('--apply');

/** 일회성 OCR·잘림 — 줄바꿈 생산 꼬리(되거/하거/만드…)는 유지 */
const REMOVE_EXCEPTION = new Set([
  '림자',
  '년대',
  '려진',
  '려줄',
  '열네',
  '람과',
]);

/** verbal 일회 조각 (줄바꿈 체계 꼬리 제외) */
const REMOVE_VERBAL = new Set([
  '똑한',
  '러한',
  '생한',
  '파른',
  '치자',
  '번다',
  '받어',
  '으킨',
]);

/**
 * 예외 → 접속 휴리스틱 이관 (완전일치 담화·부사성).
 * 관형사(모든·이런·어떤·다른)는 예외 유지.
 */
const MOVE_EXC_TO_CONJ = [
  '역시',
  '이미',
  '바로',
  '만약',
  '물론',
  '함께',
  '직접',
  '계속',
  '다시',
  '그냥',
  '그저',
  '따로',
  '달리',
  '과연',
  '사실',
  '실제',
  '아니',
];

const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const excBefore = raw.exceptionEojeols.length;
const verbalBefore = raw.verbalTails.length;

const removedExc = raw.exceptionEojeols.filter((e) => REMOVE_EXCEPTION.has(e));
const removedVerbal = raw.verbalTails.filter((t) => REMOVE_VERBAL.has(t));
const moveConj = MOVE_EXC_TO_CONJ.filter((e) =>
  raw.exceptionEojeols.includes(e),
);

console.log('remove exception', removedExc.join(','));
console.log('remove verbal', removedVerbal.join(','));
console.log('move to conj', moveConj.join(','));
console.log(
  `before exc=${excBefore} verbal=${verbalBefore} → after exc≈${
    excBefore - removedExc.length - moveConj.length
  } verbal≈${verbalBefore - removedVerbal.length}`,
);

if (!apply) {
  console.log('(dry-run) 적용: node scripts/prune-unify-noise-clutter.mjs --apply');
  process.exit(0);
}

raw.exceptionEojeols = raw.exceptionEojeols
  .filter((e) => !REMOVE_EXCEPTION.has(e) && !MOVE_EXC_TO_CONJ.includes(e))
  .toSorted((a, b) => a.localeCompare(b, 'ko'));
raw.verbalTails = raw.verbalTails
  .filter((t) => !REMOVE_VERBAL.has(t))
  .toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko'));
raw.updatedAt = new Date().toISOString().slice(0, 10);
raw.harvestNote =
  'npm run sync-unify-noise-list. OCR 조각 정리·담화→접속 이관(2026-08-07). 예외 알람 300.';

writeFileSync(JSON_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log(
  `[apply] exc=${raw.exceptionEojeols.length} verbal=${raw.verbalTails.length}`,
);
