/**
 * O5 실측: page-layout keep 비율 · near/deferred · analyzer-off V1
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import {
  classifyParagraphPair,
  crossPageLayoutTrust,
} from '../src/lib/pdfTxtParagraph.js';
import { evaluateGolden } from '../src/lib/visualGolden/evaluateGolden.js';
import { runTxtPipeline } from './lib/runTxtPipeline.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const sampleDir = 'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF';
const books = [
  {
    id: 'depressione',
    file: 'depressione_PDF_v1.pdf',
    golden: 'test-fixtures/visual-golden/depressione.golden.json',
  },
  {
    id: 'street',
    file: '260107_스트리트 이코노미-본문(4교).pdf',
    golden: 'test-fixtures/visual-golden/street.golden.json',
  },
];

async function loadCleaned(path) {
  const buf = readFileSync(path);
  const pdf = await loadPdfFromBuffer(
    new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  );
  const pages = await extractAllPagesText(pdf);
  await pdf.destroy?.();
  return cleanPageLinesForTxt(pages);
}

for (const b of books) {
  const path = join(sampleDir, b.file);
  if (!existsSync(path)) {
    console.log(JSON.stringify({ id: b.id, missing: true }));
    continue;
  }
  const cleaned = await loadCleaned(path);
  const filled = cleaned.filter((p) => (p.lines ?? []).length);
  let pageLayoutKeeps = 0;
  let trustedJoins = 0;
  /** @type {Record<string, number>} */
  const untrustedWhy = {};
  for (let i = 0; i < filled.length - 1; i += 1) {
    const trust = crossPageLayoutTrust(filled[i], filled[i + 1]);
    const left = filled[i].lines.at(-1);
    const right = filled[i + 1].lines[0];
    const v = classifyParagraphPair(
      left,
      right,
      filled[i].lineLayout?.at(-1),
      filled[i + 1].lineLayout?.[0],
      null,
      trust,
    );
    if (v.reason === 'page-layout') {
      pageLayoutKeeps += 1;
      const why = trust.untrustedWhy || 'unknown';
      untrustedWhy[why] = (untrustedWhy[why] || 0) + 1;
    } else if (v.action === 'join') {
      trustedJoins += 1;
    }
  }
  const pageCount = filled.length;
  const ratio = pageCount ? pageLayoutKeeps / pageCount : 0;

  let deferred = 0;
  let nearTwo = 0;
  let single = 0;
  let two = 0;
  /** @type {Record<string, number>} */
  const reasons = {};
  for (const p of cleaned) {
    if (p.column?.kind === 'two') two += 1;
    else single += 1;
    if (p.column?.deferred) deferred += 1;
    if (p.column?.kind === 'two' && p.column?.margin === 'near') nearTwo += 1;
    const r = p.column?.reason || 'none';
    reasons[r] = (reasons[r] || 0) + 1;
  }

  const golden = JSON.parse(readFileSync(b.golden, 'utf8'));
  const modes = [
    ['analyzer-off', 'untouched'],
    ['analyzer-off', 'accept-defaults'],
  ];
  /** @type {Record<string, object>} */
  const modeTotals = {};
  for (const [mode, decisionsMode] of modes) {
    const pipe = runTxtPipeline(cleaned, { mode, decisionsMode });
    const report = evaluateGolden(golden, {
      extractLines: pipe.extractLines,
      finalTxt: pipe.finalTxt,
      candidates: pipe.candidates,
      columnDecisions: pipe.columnDecisions,
    });
    modeTotals[`${mode}/${decisionsMode}`] = report.totals;
  }

  console.log(
    JSON.stringify(
      {
        id: b.id,
        pageCount,
        pageLayoutKeeps,
        pageLayoutPerPage: Number(ratio.toFixed(4)),
        over10pct: ratio > 0.1,
        untrustedWhy,
        trustedJoins,
        columns: { single, two, deferred, nearTwo, reasons },
        modeTotals,
      },
      null,
      2,
    ),
  );
}
