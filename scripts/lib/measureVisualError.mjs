/**
 * 시각 오차 측정 유스케이스 — 골든 파일 + 파이프라인 + 평가기.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../../src/lib/pdfTxtBodyClean.js';
import { evaluateGolden } from '../../src/lib/visualGolden/evaluateGolden.js';
import { validateVisualGolden } from '../../src/lib/visualGolden/goldenSchema.js';
import { resolveSample } from './sampleResolver.mjs';
import { runTxtPipeline } from './runTxtPipeline.mjs';

// vite-node에서 pdfService의 ?url worker가 깨질 수 있어 파일 URL로 고정.
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  ),
).href;

/**
 * @param {string} goldenPath
 * @param {{
 *   root: string,
 *   sampleDirs?: string[],
 *   mode?: 'analyzer-off' | 'analyzer-on',
 *   decisionsMode?: 'untouched' | 'accept-defaults',
 *   analyze?: (line: string) => unknown,
 * }} opts
 */
export async function measureBookFromGolden(goldenPath, opts) {
  const raw = JSON.parse(readFileSync(goldenPath, 'utf8'));
  const validated = validateVisualGolden(raw);
  if (!validated.ok) {
    return {
      status: 'invalid-golden',
      goldenPath,
      errors: validated.errors,
    };
  }
  const golden = validated.golden;
  const sample = resolveSample({
    pdfFileName: golden.book.pdfFileName,
    sampleDirs: opts.sampleDirs,
  });
  if (sample.status === 'missing') {
    return {
      status: 'skipped',
      bookId: golden.book.id,
      goldenPath,
      tried: sample.tried,
      reason: 'sample-pdf-missing',
    };
  }

  const buf = readFileSync(sample.path);
  const pdf = await loadPdfFromBuffer(
    new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  );
  const pages = await extractAllPagesText(pdf);
  await pdf.destroy?.();
  const cleaned = cleanPageLinesForTxt(pages);
  const pipe = runTxtPipeline(cleaned, {
    mode: opts.mode ?? 'analyzer-off',
    decisionsMode: opts.decisionsMode ?? 'untouched',
    analyze: opts.analyze,
  });
  const report = evaluateGolden(golden, {
    mode: pipe.mode,
    decisionsMode: pipe.decisionsMode,
    extractLines: pipe.extractLines,
    finalTxt: pipe.finalTxt,
    columnDecisions: pipe.columnDecisions,
    candidates: pipe.candidates,
  });

  return {
    status: 'measured',
    bookId: golden.book.id,
    pdf: sample.path,
    goldenPath,
    report,
    pageCandidates: (pipe.candidates ?? [])
      .filter((c) => String(c.id).endsWith(':page'))
      .slice(0, 20)
      .map((c) => ({
        id: c.id,
        decided: c.defaultDecision,
        reason: c.reason,
        left: String(c.left ?? '').slice(-48),
        right: String(c.right ?? '').slice(0, 48),
      })),
  };
}

/**
 * @param {string} root
 */
export function defaultGoldenDir(root) {
  return join(root, 'test-fixtures/visual-golden');
}
