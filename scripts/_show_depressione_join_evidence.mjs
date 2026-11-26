/**
 * 사람 눈으로 볼 증거: depressione 불치병·그러 쪽 넘김이
 * 추출/최종 TXT에서 실제로 어떻게 붙었는지 보여 준다.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { runTxtPipeline } from './lib/runTxtPipeline.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const sampleDir = 'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF';
const pdfPath = join(sampleDir, 'depressione_PDF_v1.pdf');
if (!existsSync(pdfPath)) {
  console.error('PDF 없음', pdfPath);
  process.exit(2);
}

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);

const needles = [
  {
    id: '불치병→의_희생자',
    left: '이 새로운 불치병',
    expectNext: '의 희생자',
    forbidNext: '지 않는다면',
    expectInFinal: /불치병\s*의\s*희생자/u,
    forbidInFinal: /불치병\s*지\s*않는다면/u,
  },
  {
    id: '그러→지_않는다면',
    left: '세워야만 한다. 그러',
    expectNext: '지 않는다면',
    forbidNext: '의 희생자',
    expectInFinal: /그러\s*지\s*않는다면/u,
    forbidInFinal: /그러\s*의\s*희생자/u,
  },
];

/** @type {{ pageNum: number, lineIndex: number, text: string }[]} */
const flat = [];
for (const page of cleaned) {
  (page.lines ?? []).forEach((text, lineIndex) => {
    flat.push({ pageNum: page.pageNum, lineIndex, text });
  });
}

const off = runTxtPipeline(cleaned, {
  mode: 'analyzer-off',
  decisionsMode: 'untouched',
});

const evidence = {
  measuredAt: new Date().toISOString(),
  commitHint: 'local hero cursor/pdf-txt-page-join-4bb2',
  pdf: pdfPath,
  cases: needles.map((n) => {
    const hits = flat
      .map((row, i) => ({ i, row }))
      .filter(({ row }) => row.text.includes(n.left));
    const hit = hits[0];
    const next = hit ? flat[hit.i + 1] : null;
    const nextText = next?.text ?? '';
    const extractOk =
      Boolean(nextText) &&
      nextText.trimStart().startsWith(n.expectNext) &&
      !nextText.trimStart().startsWith(n.forbidNext);
    const expectFinal = n.expectInFinal.test(off.finalTxt);
    const forbidFinal = n.forbidInFinal.test(off.finalTxt);
    const m = off.finalTxt.match(
      new RegExp(`.{0,40}${n.expectInFinal.source}.{0,40}`, 'u'),
    );
    const bad = off.finalTxt.match(
      new RegExp(`.{0,40}${n.forbidInFinal.source}.{0,40}`, 'u'),
    );
    // page candidate around left
    const pageCand = (off.candidates ?? []).find(
      (c) =>
        String(c.id).endsWith(':page') &&
        String(c.left ?? '').includes(n.left.slice(-6)),
    );
    return {
      id: n.id,
      extract: {
        left: hit?.row ?? null,
        next: next
          ? { pageNum: next.pageNum, lineIndex: next.lineIndex, text: next.text }
          : null,
        hitCount: hits.length,
        ok: extractOk,
      },
      finalTxt: {
        expectPresent: expectFinal,
        forbidPresent: forbidFinal,
        ok: expectFinal && !forbidFinal,
        snippetExpect: m?.[0] ?? null,
        snippetForbid: bad?.[0] ?? null,
      },
      pageCandidate: pageCand
        ? {
            id: pageCand.id,
            reason: pageCand.reason,
            defaultDecision: pageCand.defaultDecision,
            leftTail: String(pageCand.left).slice(-60),
            rightHead: String(pageCand.right).slice(0, 60),
          }
        : null,
      verdict: extractOk && expectFinal && !forbidFinal ? 'OK' : 'BAD',
    };
  }),
};

const tmp = join(process.cwd(), 'tmp');
if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
const outPath = join(tmp, 'depressione-join-evidence.json');
writeFileSync(outPath, JSON.stringify(evidence, null, 2), 'utf8');

console.log(JSON.stringify(evidence, null, 2));
console.log('\nWrote', outPath);
