/**
 * midword인데 gap으로 끊히던 쌍이 수정 후 join인지 표본 스캔.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import {
  buildParagraphContext,
  classifyParagraphPair,
  paragraphJoinGlue,
} from '../src/lib/pdfTxtParagraph.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const sampleDir = 'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF';
const books = [
  'depressione_PDF_v1.pdf',
  '260107_스트리트 이코노미-본문(4교).pdf',
];

const GAP_RATIO = 1.75;

for (const file of books) {
  const path = join(sampleDir, file);
  if (!existsSync(path)) {
    console.log(JSON.stringify({ file, missing: true }));
    continue;
  }
  const buf = readFileSync(path);
  const pdf = await loadPdfFromBuffer(
    new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  );
  const pages = await extractAllPagesText(pdf);
  await pdf.destroy?.();
  const cleaned = cleanPageLinesForTxt(pages);
  let midwordWide = 0;
  let stillGap = 0;
  /** @type {object[]} */
  const samples = [];
  for (const page of cleaned) {
    const lines = page.lines ?? [];
    const layouts = page.lineLayout ?? [];
    const ctx = buildParagraphContext(lines, layouts);
    for (let i = 0; i < lines.length - 1; i += 1) {
      const L = layouts[i];
      const R = layouts[i + 1];
      if (!L || !R || !Number.isFinite(L.y) || !Number.isFinite(R.y)) continue;
      const dy = L.y - R.y;
      const ref = Math.max(L.fontH || 0, R.fontH || 0, 8);
      if (!(dy > ref * GAP_RATIO)) continue;
      const glue = paragraphJoinGlue(lines[i], lines[i + 1], {
        trailSpace: Boolean(L.trailSpace),
      });
      if (glue !== '') continue;
      midwordWide += 1;
      const v = classifyParagraphPair(lines[i], lines[i + 1], L, R, ctx);
      if (v.action === 'keep' && v.reason === 'gap') {
        stillGap += 1;
        if (samples.length < 5) {
          samples.push({
            page: page.pageNum,
            i,
            left: String(lines[i]).slice(-40),
            right: String(lines[i + 1]).slice(0, 40),
          });
        }
      }
    }
  }
  console.log(
    JSON.stringify({
      file,
      midwordWideDy: midwordWide,
      stillGapKeep: stillGap,
      samples,
    }),
  );
}
