/**
 * 플래그 ON + Kiwi boot 후 depressione 모달 후보 space 제안 스모크.
 * npx vite-node scripts/_smoke_txt_analyzer_flag.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { analyzeParagraphFlow } from '../src/lib/pdfTxtParagraph.js';
import { isTxtLinebreakAnalyzerEnabled } from '../src/lib/featureFlags.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../src/lib/pdfTxtUncertainAnalyzer.js';
import { clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

const pdfPath =
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF/depressione_PDF_v1.pdf';

const flag = isTxtLinebreakAnalyzerEnabled();
const envRaw = import.meta.env.VITE_TXT_LINEBREAK_ANALYZER;

await loadKiwiNode({ rootDir: root, register: true });

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);
const flow = analyzeParagraphFlow(cleaned);

const analyzed = suggestUncertainLinebreakDecisions(flow.candidates);
const applied = applyUncertainSuggestionsToCandidates(
  flow.candidates,
  analyzed,
);
const spaceDefaults = applied.filter((c) => c.defaultDecision === 'space').length;

clearKiwiAnalyzeCache();
clearKiwiInstance();

const out = {
  measuredAt: new Date().toISOString(),
  envVITE_TXT_LINEBREAK_ANALYZER: envRaw,
  isTxtLinebreakAnalyzerEnabled: flag,
  viteUrl: 'http://127.0.0.1:5173',
  modalCandidates: flow.candidates.length,
  analyzerEnabled: analyzed.enabled,
  skipped: analyzed.metrics.skipped,
  yToSpace: analyzed.metrics.yToSpace,
  spaceDefaultsAfterApply: spaceDefaults,
  ok:
    flag === true &&
    analyzed.enabled === true &&
    analyzed.metrics.yToSpace >= 1 &&
    spaceDefaults >= 1,
};
mkdirSync(join(root, 'tmp'), { recursive: true });
const outPath = join(root, 'tmp', 'txt-analyzer-flag-smoke.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
if (!out.ok) process.exitCode = 1;
