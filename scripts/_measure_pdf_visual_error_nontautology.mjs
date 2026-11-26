/**
 * 순환 없는 PDF 시각 오차 측정.
 *
 * 정답: 사람이 PDF를 눈으로 읽어 고정한 골든 JSON.
 * 금지: cleanPageLinesForTxt 줄을 y/단으로 재정렬한 것을 정답으로 쓰는 자기대조.
 *
 * 사용:
 *   npx vite-node scripts/_measure_pdf_visual_error_nontautology.mjs
 *   npx vite-node scripts/_measure_pdf_visual_error_nontautology.mjs street
 *   npx vite-node scripts/_measure_pdf_visual_error_nontautology.mjs depressione
 *
 * 표본 경로: REDPEN_SAMPLE_DIR 또는 기본 바탕화면 샘플 폴더.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import {
  defaultGoldenDir,
  measureBookFromGolden,
} from './lib/measureVisualError.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';
const sampleDir = join(desk, '인디야/인디야샘플PDF');
const goldenDir = defaultGoldenDir(root);

const only = (process.argv[2] || '').toLowerCase(); // street | depressione | (빈=둘다)

await loadKiwiNode({ rootDir: root, register: true });

const books = [];
if (only !== 'depressione') {
  books.push(join(goldenDir, 'street.golden.json'));
}
if (only !== 'street') {
  books.push(join(goldenDir, 'depressione.golden.json'));
}

/** @type {Record<string, object>} */
const byBook = {};
for (const goldenPath of books) {
  if (!existsSync(goldenPath)) {
    byBook[goldenPath] = { status: 'missing-golden', goldenPath };
    continue;
  }
  // analyzer-on × accept-defaults (기존 스크립트와 가까운 모드)
  const measured = await measureBookFromGolden(goldenPath, {
    root,
    sampleDirs: [sampleDir],
    mode: 'analyzer-on',
    decisionsMode: 'accept-defaults',
    analyze: analyzeLine,
  });
  byBook[measured.bookId || goldenPath] = measured;
}

clearKiwiAnalyzeCache();
clearKiwiInstance();

const measuredAt = new Date().toISOString();
const street = byBook.street ?? null;
const depressione = byBook.depressione ?? null;

const out = {
  measuredAt,
  scope: only || 'street+depressione',
  definition: {
    error: 'PDF 눈으로 읽는 칸·문장 순서와 TXT/추출이 다를 때',
    notError: 'Kiwi A/Y vs 추천 자기일치',
    groundTruth: '사람 골든 JSON (test-fixtures/visual-golden)',
    forbidden: '추출↔재정렬 순환 측정',
  },
  tautology: {
    rejectedMetric:
      'cleanPageLinesForTxt 줄을 col/y/x로 재정렬한 seq와 추출 인접을 비교',
    whyCircular:
      '정답이 같은 파이프라인 산출물의 재정렬이라, 추출이 이미 그 규칙이면 오차 0%가 설계상 나옴',
  },
  street,
  depressione,
};

const tmpDir = join(root, 'tmp');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
const jsonPath = join(tmpDir, 'pdf-visual-error-nontautology.json');
writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8');

const md = [];
md.push('# 순환 없는 PDF 시각 오차 측정');
md.push('');
md.push(`- 측정(UTC): ${measuredAt}`);
md.push(`- 골든: \`${goldenDir}\``);
md.push('');
for (const key of ['street', 'depressione']) {
  const block = out[key];
  if (!block) continue;
  md.push(`## ${key}`);
  md.push('');
  if (block.status === 'skipped') {
    md.push(`- SKIP: ${block.reason}`);
    md.push(`- tried: ${(block.tried || []).join(' | ')}`);
  } else if (block.status === 'measured') {
    const t = block.report?.totals;
    md.push(
      `- PASS ${t?.pass ?? 0} · FAIL ${t?.fail ?? 0} · SKIP ${t?.skip ?? 0} · errorRate ${t?.errorRate}`,
    );
    for (const item of block.report?.items ?? []) {
      md.push(`- ${item.checkId}: **${item.status}** (${item.why})`);
    }
  } else {
    md.push(`- ${JSON.stringify(block)}`);
  }
  md.push('');
}
md.push('## 재현');
md.push('');
md.push('```powershell');
md.push('cd C:\\Users\\gikan\\Documents\\pdf-publish-proofread-hero');
md.push('npx vite-node scripts/_measure_pdf_visual_error_nontautology.mjs');
md.push('```');
md.push('');
md.push(`JSON: \`${jsonPath}\``);

const mdBody = md.join('\n');
const mdTmp = join(tmpDir, 'pdf-visual-error-nontautology.md');
writeFileSync(mdTmp, mdBody, 'utf8');

console.log(JSON.stringify({ jsonPath, mdTmp, ...out }, null, 2));
console.log('\n--- markdown ---\n');
console.log(mdBody);
