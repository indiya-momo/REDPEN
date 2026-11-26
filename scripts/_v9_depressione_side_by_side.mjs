/**
 * V9 육안용: depressione p.12–13 PDF 렌더 + 최종 TXT 조각을 한 HTML로.
 */
import { createCanvas } from '@napi-rs/canvas';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
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
const outDir = join(process.cwd(), 'tmp/v9-depressione');
const artifactDir = 'C:/Users/gikan/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-c6a659ed-089d-452f-b243-094599fcd514/files/media';

if (!existsSync(pdfPath)) {
  console.error('PDF missing', pdfPath);
  process.exit(2);
}
for (const d of [outDir, artifactDir]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

const data = new Uint8Array(readFileSync(pdfPath));
const pdfJs = await pdfjsLib.getDocument({ data }).promise;

/**
 * @param {number} pageNum 1-based
 */
async function renderPage(pageNum) {
  const page = await pdfJs.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const png = canvas.toBuffer('image/png');
  const name = `depressione-p${pageNum}.png`;
  writeFileSync(join(outDir, name), png);
  writeFileSync(join(artifactDir, name), png);
  return { name, width: canvas.width, height: canvas.height };
}

const r12 = await renderPage(12);
const r13 = await renderPage(13);

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);
const pipe = runTxtPipeline(cleaned, {
  mode: 'analyzer-off',
  decisionsMode: 'untouched',
});

const p12 = cleaned.find((p) => p.pageNum === 12);
const p13 = cleaned.find((p) => p.pageNum === 13);
const lines12 = (p12?.lines ?? []).slice(-6);
const lines13 = (p13?.lines ?? []).slice(0, 8);

const idx = pipe.finalTxt.indexOf('이 새로운 불치병');
const snippet =
  idx >= 0
    ? pipe.finalTxt.slice(Math.max(0, idx - 30), idx + 180)
    : '(불치병 구문 없음)';

const idx2 = pipe.finalTxt.indexOf('세워야만 한다. 그러');
const snippet2 =
  idx2 >= 0
    ? pipe.finalTxt.slice(idx2, idx2 + 80)
    : '(그러 구문 없음)';

const joinOk = /불치병\s*의\s*희생자/u.test(pipe.finalTxt);
const joinBad = /불치병\s*지\s*않는다면/u.test(pipe.finalTxt);
const softHasNewline = /그러\s*\n\s*지\s*않는다면/u.test(pipe.finalTxt);
const softJoined = /그러\s*지\s*않는다면/u.test(pipe.finalTxt.replace(/\n/g, ''));

const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8" />
<title>V9 depressione p.12–13 PDF ↔ TXT</title>
<style>
  body { font-family: "Pretendard", "Malgun Gothic", sans-serif; margin: 16px; background: #f6f4ef; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  figure { margin: 0; background: #fff; border: 1px solid #ddd; padding: 8px; }
  img { max-width: 100%; height: auto; display: block; }
  pre { white-space: pre-wrap; background: #fff; border: 1px solid #ddd; padding: 12px; font-size: 14px; line-height: 1.45; }
  .ok { color: #0a7a32; font-weight: 700; }
  .bad { color: #b00020; font-weight: 700; }
  .warn { color: #9a5b00; font-weight: 700; }
  .note { font-size: 0.92rem; color: #444; }
</style>
<h1>V9 — depressione p.12–13 (PDF 렌더 ↔ 최종 TXT)</h1>
<p class="note">커밋 맥락: hero <code>cursor/pdf-txt-page-join-4bb2</code> · analyzer-off / untouched · Asia/Seoul</p>
<div class="grid">
  <figure>
    <figcaption>PDF p.12</figcaption>
    <img src="${r12.name}" alt="depressione page 12" width="${r12.width}" />
  </figure>
  <figure>
    <figcaption>PDF p.13</figcaption>
    <img src="${r13.name}" alt="depressione page 13" width="${r13.width}" />
  </figure>
</div>
<h2>추출 줄 (청소 후)</h2>
<pre>p.12 끝 6줄:
${lines12.map((l, i) => `${i}: ${l}`).join('\n')}

p.13 앞 8줄:
${lines13.map((l, i) => `${i}: ${l}`).join('\n')}</pre>
<h2>최종 TXT 조각</h2>
<pre>${snippet.replace(/</g, '&lt;')}

---

${snippet2.replace(/</g, '&lt;')}</pre>
<h2>판정 (육안 보조)</h2>
<ul>
  <li>쪽 넘김 올바른 이음 <code>불치병…의 희생자</code>: <span class="${joinOk ? 'ok' : 'bad'}">${joinOk ? '있음' : '없음'}</span></li>
  <li>잘못된 이음 <code>불치병…지 않는다면</code>: <span class="${joinBad ? 'bad' : 'ok'}">${joinBad ? '있음(나쁨)' : '없음'}</span></li>
  <li>같은 쪽 soft-wrap <code>그러|지</code>에 줄바꿈 잔존: <span class="${softHasNewline ? 'warn' : 'ok'}">${softHasNewline ? '있음(붙여야 할 수 있음)' : '없음'}</span></li>
  <li>공백 제거 시 <code>그러지 않는다면</code> 연속: <span class="${softJoined ? 'ok' : 'bad'}">${softJoined ? '예' : '아니오'}</span></li>
</ul>
<p class="note">PDF 이미지와 위 TXT를 눈으로 맞춰 보세요. 앱 UI(7777)에서도 같은 PDF로 TXT 변환 후 p.12–13을 확인하면 됩니다.</p>
`;

writeFileSync(join(outDir, 'index.html'), html, 'utf8');
writeFileSync(join(artifactDir, 'v9-depressione-side-by-side.html'), html, 'utf8');

const summary = {
  outDir,
  artifactDir,
  pages: [r12, r13],
  joinOk,
  joinBad,
  softHasNewline,
  softJoined,
  lines12,
  lines13,
  snippet,
  snippet2,
};
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
