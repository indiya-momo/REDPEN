import { readFileSync, existsSync } from 'node:fs';
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
import { applyLinebreakDecisions } from '../src/lib/pdfTxtLinebreakReview.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const pdfPath = join(
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF',
  'depressione_PDF_v1.pdf',
);
const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);
const p13 = cleaned.find((p) => p.pageNum === 13);
const lines = p13.lines;
const layouts = p13.lineLayout;
const i = lines.findIndex((l) => l.includes('세워야만 한다. 그러'));
const left = lines[i];
const right = lines[i + 1];
const ctx = buildParagraphContext(lines, layouts);
const verdict = classifyParagraphPair(
  left,
  right,
  layouts[i],
  layouts[i + 1],
  ctx,
);
const glue = paragraphJoinGlue(left, right, {
  trailSpace: Boolean(layouts[i]?.trailSpace),
});
console.log(
  JSON.stringify(
    {
      i,
      left,
      right,
      leftLayout: layouts[i],
      rightLayout: layouts[i + 1],
      glue,
      verdict,
      finalAround: applyLinebreakDecisions([p13], {})
        .split('그러')[1]
        ?.slice(0, 40),
    },
    null,
    2,
  ),
);
