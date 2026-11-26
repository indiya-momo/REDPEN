/**
 * 실PDF 골든 회귀 (O2 제안: npm test와 분리).
 * 표본 없으면 exit 0 + SKIP 명시. 전부 FAIL이면 exit 1.
 *
 *   npm run test:golden
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureBookFromGolden, defaultGoldenDir } from './lib/measureVisualError.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';
const sampleDir = join(desk, '인디야/인디야샘플PDF');
const goldenDir = defaultGoldenDir(root);

const files = ['street.golden.json', 'depressione.golden.json'].map((n) =>
  join(goldenDir, n),
);

/** 바닥글이 본문에 붙은 쪽 경계 허용 상한 (depressione 실측 2건) */
const MAX_FOOTER_JOINS = 5;

let measured = 0;
let failedBooks = 0;
let skipped = 0;

for (const goldenPath of files) {
  if (!existsSync(goldenPath)) {
    console.log(JSON.stringify({ goldenPath, status: 'missing-golden' }));
    skipped += 1;
    continue;
  }
  const result = await measureBookFromGolden(goldenPath, {
    root,
    sampleDirs: [sampleDir],
    mode: 'analyzer-off',
    decisionsMode: 'untouched',
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'skipped' || result.status === 'invalid-golden') {
    skipped += 1;
    continue;
  }
  measured += 1;
  const stats = result.pageLayoutStats;
  const layoutFail =
    stats && (stats.over10pct || (stats.footerJoins ?? 0) > MAX_FOOTER_JOINS);
  if (layoutFail) {
    console.log(
      JSON.stringify({ bookId: result.bookId, layoutFail: true, ...stats }),
    );
  }
  if ((result.report?.totals?.fail ?? 0) > 0 || layoutFail) failedBooks += 1;
}

console.log(
  JSON.stringify({ measured, skipped, failedBooks, note: 'sample missing → skip, not pass' }),
);
if (failedBooks > 0) process.exitCode = 1;
