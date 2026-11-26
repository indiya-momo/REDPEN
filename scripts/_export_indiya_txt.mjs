/**
 * 인디야 TXT 변환과 동일 경로 (Node).
 * 사용: node scripts/_export_indiya_txt.mjs "<pdfPath>" [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPageText } from '../src/lib/pdfPageText.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { joinPagesWithMarkers } from '../src/lib/pdfTxtLinebreakReview.js';

/** 터미널 TXT만 150MB (브라우저 검수·TXT는 100MB 유지) */
const PDF_MAX_BYTES_TERMINAL = 150 * 1024 * 1024;

function txtFilenameFromPdfName(filename) {
  const stem = String(filename ?? 'document')
    .replace(/\.pdf$/i, '')
    .replace(/_검수전$/u, '')
    .trim();
  return `${stem || 'document'}_검수전.txt`;
}

function encodeTxtForDownload(text) {
  const body = String(text ?? '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  return `\uFEFF${body}`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const pdfPath = process.argv[2];
const outDir =
  process.argv[3] ||
  path.join(process.env.USERPROFILE || '', 'OneDrive', '바탕 화면');

if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error('PDF 경로가 없습니다:', pdfPath);
  process.exit(1);
}

const fileName = path.basename(pdfPath);
const outName = txtFilenameFromPdfName(fileName);
const outPath = path.join(outDir, outName);
const workspaceOut = path.join(root, 'tmp', outName);

const pdfSizeBytes = fs.statSync(pdfPath).size;
const sizeMb = pdfSizeBytes / 1024 / 1024;
console.log('[indiya-txt] pdf=', pdfPath);
console.log(
  '[indiya-txt] sizeMB=',
  sizeMb.toFixed(1),
  '/ limit=150MB (terminal)',
);
if (pdfSizeBytes > PDF_MAX_BYTES_TERMINAL) {
  console.error(
    `[indiya-txt] PDF ${sizeMb.toFixed(1)}MB — 터미널 TXT 상한 150MB 초과. 파일을 나눈 뒤 다시 시도해 주세요.`,
  );
  process.exit(1);
}

const fileBuf = fs.readFileSync(pdfPath);
const data = new Uint8Array(
  fileBuf.buffer,
  fileBuf.byteOffset,
  fileBuf.byteLength,
);
const pdf = await pdfjsLib.getDocument({
  data,
  cMapUrl: `${pathToFileURL(path.join(root, 'public/pdfjs/cmaps')).href}/`,
  cMapPacked: true,
}).promise;

const total = pdf.numPages;
console.log('[indiya-txt] pages=', total);

/** @type {{ pageNum: number, text?: string, visualText?: string, items?: unknown[] }[]} */
const pages = [];
for (let i = 1; i <= total; i += 1) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent({ includeMarkedContent: false });
  const items = content.items.filter((it) => typeof it?.str === 'string');
  const built = buildPageText(items);
  pages.push({
    pageNum: i,
    text: built.text ?? built.visualText ?? '',
    visualText: built.visualText ?? built.text ?? '',
    items,
  });
  if (i === 1 || i % 10 === 0 || i === total) {
    console.log(`[indiya-txt] extract ${i}/${total}`);
  }
}
await pdf.destroy?.();

const cleanedPages = cleanPageLinesForTxt(pages);
const draft = joinPagesWithMarkers(cleanedPages);
if (!draft.trim()) {
  console.error('글자를 읽지 못했습니다.');
  process.exit(2);
}

const encoded = encodeTxtForDownload(draft);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(workspaceOut), { recursive: true });
fs.writeFileSync(outPath, encoded, 'utf8');
fs.writeFileSync(workspaceOut, encoded, 'utf8');

console.log('[indiya-txt] chars=', draft.length);
console.log('[indiya-txt] wrote', outPath);
console.log('[indiya-txt] wrote', workspaceOut);
console.log('[indiya-txt] filename', outName);
