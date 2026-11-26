/**
 * PDF → TXT 문단 이음 실측 (layout 있음 vs 없음).
 * 사용: npx vite-node scripts/_measure_pdf_vs_txt.mjs [pdfPath]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import {
  analyzeParagraphFlow,
  buildParagraphContext,
  classifyParagraphPair,
  paragraphJoinGlue,
} from '../src/lib/pdfTxtParagraph.js';
import {
  applyLinebreakDecisions,
  joinPagesWithMarkers,
} from '../src/lib/pdfTxtLinebreakReview.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/** 텍스트·문단 이음 실측 기본 표본 (로사 지정). */
const DEFAULT_PDF =
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF/depressione_PDF_v1.pdf';

const pdfPath = process.argv[2]
  ? resolve(root, process.argv[2])
  : DEFAULT_PDF;

/**
 * @param {string} label
 * @param {{ pageNum: number, lines: string[], lineLayout?: object[] }[]} cleanedPages
 */
function summarize(label, cleanedPages) {
  const flow = analyzeParagraphFlow(cleanedPages);
  const draft = joinPagesWithMarkers(cleanedPages);
  const finalText = applyLinebreakDecisions(cleanedPages, {});
  /** @type {Record<string, number>} */
  const reasonKeep = {};
  /** @type {Record<string, number>} */
  const reasonCand = {};
  let pairs = 0;
  let keepN = 0;
  let joinN = 0;
  for (const page of cleanedPages) {
    const lines = page.lines ?? [];
    const layouts = page.lineLayout ?? [];
    const ctx = buildParagraphContext(lines, layouts);
    for (let i = 0; i < lines.length - 1; i += 1) {
      pairs += 1;
      const v = classifyParagraphPair(
        lines[i],
        lines[i + 1],
        layouts[i],
        layouts[i + 1],
        ctx,
      );
      if (v.action === 'keep') {
        keepN += 1;
        reasonKeep[v.reason] = (reasonKeep[v.reason] || 0) + 1;
      } else {
        joinN += 1;
      }
    }
  }
  for (const c of flow.candidates) {
    reasonCand[c.reason] = (reasonCand[c.reason] || 0) + 1;
  }
  const layoutFilled = cleanedPages.reduce(
    (n, p) =>
      n +
      (p.lineLayout || []).filter((l) => Number.isFinite(l?.endX)).length,
    0,
  );
  const lineCount = cleanedPages.reduce(
    (n, p) => n + (p.lines || []).length,
    0,
  );
  return {
    label,
    pages: cleanedPages.length,
    lines: lineCount,
    layoutRowsWithEndX: layoutFilled,
    pairs,
    join: joinN,
    keep: keepN,
    joinRate: pairs ? Number((joinN / pairs).toFixed(4)) : null,
    keepRate: pairs ? Number((keepN / pairs).toFixed(4)) : null,
    flowStats: flow.stats,
    candidatesShown: flow.candidates.length,
    candidateReasons: reasonCand,
    keepReasons: reasonKeep,
    draftChars: draft.length,
    finalChars: finalText.length,
    draftNewlines: (draft.match(/\n/g) || []).length,
    finalNewlines: (finalText.match(/\n/g) || []).length,
    sampleMidword: flow.candidates
      .filter((c) => c.reason === 'midword')
      .slice(0, 8)
      .map((c) => ({
        left: c.left.slice(-28),
        right: c.right.slice(0, 28),
        def: c.defaultDecision,
      })),
  };
}

/**
 * @param {{ left: string, right: string }[]} rows
 * @param {'' | ' '} want
 */
function score(rows, want) {
  let ok = 0;
  for (const r of rows) {
    if (paragraphJoinGlue(r.left, r.right) === want) ok += 1;
  }
  return {
    n: rows.length,
    ok,
    rate: rows.length ? Number((ok / rows.length).toFixed(4)) : null,
  };
}

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();

const cleaned = cleanPageLinesForTxt(pages);
const stripLayout = cleaned.map((p) => ({
  pageNum: p.pageNum,
  lines: p.lines,
  lineLayout: [],
}));

const withL = summarize('with-layout', cleaned);
const noL = summarize('no-layout', stripLayout);

const fixture = JSON.parse(
  readFileSync(
    join(root, 'src/lib/fixtures/txt-softwrap-glue-regression.json'),
    'utf8',
  ),
);
const softwrap = {
  A_nospace: score(fixture.A_nospace, ''),
  Y_space_ok: score(fixture.Y_space, ' '),
  Y_known_want_space: score(fixture.Y_known_wrong_nospace, ' '),
};

const out = {
  pdf: basename(pdfPath),
  pdfPath,
  measuredAt: new Date().toISOString(),
  softwrapFixture: softwrap,
  withLayout: withL,
  noLayout: noL,
  delta: {
    joinRate_with_minus_no: Number((withL.joinRate - noL.joinRate).toFixed(4)),
    keepRate_with_minus_no: Number((withL.keepRate - noL.keepRate).toFixed(4)),
    candidates_with_minus_no: withL.candidatesShown - noL.candidatesShown,
    finalNewlines_with_minus_no: withL.finalNewlines - noL.finalNewlines,
  },
};

mkdirSync(join(root, 'tmp'), { recursive: true });
const outPath = join(root, 'tmp', 'pdf-vs-txt-measure.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.error(`wrote ${outPath}`);
