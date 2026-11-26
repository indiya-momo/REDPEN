/**
 * depressione 모달 상한 80 · midword Y 비율 + 분석기(force ON) Y→space / A-FP.
 *
 * 사용: npx vite-node scripts/_measure_modal_midword_y.mjs [pdfPath]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { analyzeParagraphFlow } from '../src/lib/pdfTxtParagraph.js';
import { isHangulSyllableChar } from '../src/lib/pdfPageText.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../src/lib/pdfTxtUncertainAnalyzer.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

const DEFAULT_PDF =
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF/depressione_PDF_v1.pdf';

const pdfPath = process.argv[2] ? resolve(root, process.argv[2]) : DEFAULT_PDF;

/**
 * @param {string} left
 * @param {string} right
 * @returns {'A' | 'Y' | 'skip'}
 */
function labelMidwordByKiwi(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return 'skip';
  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) return 'skip';

  const leftTail = L.slice(Math.max(0, L.length - 12));
  const rightHead = R.slice(0, 12);
  const window = leftTail + rightHead;
  const at = leftTail.length;
  const analyzed = analyzeLine(window);
  const tokens = analyzed?.tokens ?? [];
  if (!tokens.length) return 'skip';

  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const len = Number(t.length) || 0;
    const end = start + len;
    if (start < at && end > at && len >= 2) return 'A';
  }
  return 'Y';
}

const kiwi = await loadKiwiNode({ rootDir: root, register: true });
if (!kiwi) {
  console.error('Kiwi 로드 실패');
  process.exit(1);
}

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();

const cleaned = cleanPageLinesForTxt(pages);
const flow = analyzeParagraphFlow(cleaned);
const candidates = flow.candidates;

/** @type {{ id: string, reason: string, label: string, left: string, right: string, def: string }[]} */
const rows = [];
let midword = 0;
let midA = 0;
let midY = 0;
let midSkip = 0;
/** @type {Record<string, number>} */
const byReason = {};

for (const c of candidates) {
  byReason[c.reason] = (byReason[c.reason] || 0) + 1;
  if (c.reason !== 'midword') {
    rows.push({
      id: c.id,
      reason: c.reason,
      label: 'n/a',
      left: c.left.slice(-36),
      right: c.right.slice(0, 36),
      def: c.defaultDecision,
    });
    continue;
  }
  midword += 1;
  const label = labelMidwordByKiwi(c.left, c.right);
  if (label === 'A') midA += 1;
  else if (label === 'Y') midY += 1;
  else midSkip += 1;
  rows.push({
    id: c.id,
    reason: 'midword',
    label,
    left: c.left.slice(-36),
    right: c.right.slice(0, 36),
    def: c.defaultDecision,
  });
}

const analyzer = suggestUncertainLinebreakDecisions(candidates, {
  forceEnabled: true,
  analyze: analyzeLine,
});
const applied = applyUncertainSuggestionsToCandidates(candidates, analyzer);
const afterSpace = applied.filter((c) => c.defaultDecision === 'space').length;
const midAfterYFixed = rows.filter(
  (r) => r.label === 'Y' && analyzer.suggestions[r.id] === 'space',
).length;
const midAfterAFp = rows.filter(
  (r) => r.label === 'A' && analyzer.suggestions[r.id] === 'space',
).length;

const fixture = JSON.parse(
  readFileSync(
    join(root, 'src/lib/fixtures/txt-softwrap-glue-regression.json'),
    'utf8',
  ),
);
let aFpFixture = 0;
let aMidFixture = 0;
for (const row of fixture.A_nospace) {
  const aPages = [
    {
      pageNum: 1,
      lines: [String(row.left).trim(), String(row.right).trim()],
    },
  ];
  const cands = analyzeParagraphFlow(aPages).candidates.filter(
    (c) => c.reason === 'midword' && c.defaultDecision === 'nospace',
  );
  aMidFixture += cands.length;
  const res = suggestUncertainLinebreakDecisions(cands, {
    forceEnabled: true,
    analyze: analyzeLine,
  });
  aFpFixture += Object.values(res.suggestions).filter((d) => d === 'space')
    .length;
}

clearKiwiAnalyzeCache();
clearKiwiInstance();

const out = {
  pdf: basename(pdfPath),
  pdfPath,
  measuredAt: new Date().toISOString(),
  method:
    'Kiwi: token spans join → A; no span → Y. analyzer force ON for Y→space.',
  flowStats: flow.stats,
  modalCap: candidates.length,
  byReason,
  midword: {
    n: midword,
    A_correctNospace: midA,
    Y_shouldSpace: midY,
    skip: midSkip,
    Y_rate_among_midword:
      midword - midSkip > 0
        ? Number((midY / (midword - midSkip)).toFixed(4))
        : null,
    Y_rate_among_modal80:
      candidates.length > 0
        ? Number((midY / candidates.length).toFixed(4))
        : null,
  },
  analyzerForceOn: {
    metrics: analyzer.metrics,
    yCaughtOfModalY: midAfterYFixed,
    yCatchRate: midY ? Number((midAfterYFixed / midY).toFixed(4)) : null,
    aFalsePositive: midAfterAFp,
    modalDefaultsSpaceAfter: afterSpace,
  },
  softwrapA_FP: {
    midwordCandidates: aMidFixture,
    flippedToSpace: aFpFixture,
    rate: aMidFixture
      ? Number((aFpFixture / aMidFixture).toFixed(4))
      : null,
  },
  sampleY: rows.filter((r) => r.label === 'Y').slice(0, 12),
  sampleA: rows.filter((r) => r.label === 'A').slice(0, 8),
};

mkdirSync(join(root, 'tmp'), { recursive: true });
const outPath = join(root, 'tmp', 'pdf-vs-txt-modal-midword-y.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.error(`wrote ${outPath}`);
