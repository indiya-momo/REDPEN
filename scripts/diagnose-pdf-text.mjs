/**
 * PDF 텍스트 추출 진단 (일회성)
 * Usage: node scripts/diagnose-pdf-text.mjs "<path>"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPageText } from '../src/lib/pdfPageText.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

function scorePage(items, text) {
  let charCount = 0;
  let singleCharItems = 0;
  for (const item of items) {
    if (!item.str) continue;
    charCount += item.str.length;
    if (item.str.length === 1) singleCharItems += 1;
  }
  const itemCount = items.length;
  if (charCount < 30) return { skipped: true, charCount, itemCount };
  const fragmentation = itemCount / charCount;
  const singleCharRatio = singleCharItems / Math.max(itemCount, 1);
  return {
    skipped: false,
    charCount,
    itemCount,
    fragmentation: Number(fragmentation.toFixed(2)),
    singleCharRatio: Number(singleCharRatio.toFixed(2)),
    ok: fragmentation <= 2.8 && singleCharRatio <= 0.55,
    textLen: text.length,
    lineCount: text.split('\n').filter(Boolean).length,
    preview: text.replace(/\s+/g, ' ').slice(0, 140),
  };
}

const args = process.argv.slice(2);
const pdfPath = args.find((a) => !a.startsWith('--'));
const pageArg = args.find((a) => a.startsWith('--page='));
const phraseArg = args.find((a) => a.startsWith('--phrase='));
const targetPage = pageArg ? Number.parseInt(pageArg.split('=')[1], 10) : null;
const targetPhrase = phraseArg
  ? decodeURIComponent(phraseArg.split('=').slice(1).join('='))
  : null;

if (!pdfPath) {
  console.error(
    'Usage: node scripts/diagnose-pdf-text.mjs "C:\\path\\to\\file.pdf" [--page=1] [--phrase=담아]',
  );
  console.error('예: node scripts/diagnose-pdf-text.mjs ".\\momo.pdf" --page=1 --phrase=살펴');
  process.exit(1);
}

const resolvedPdf = path.resolve(pdfPath);
if (!fs.existsSync(resolvedPdf)) {
  console.error(`PDF 파일을 찾을 수 없습니다: ${resolvedPdf}`);
  process.exit(1);
}

const fileBuf = fs.readFileSync(resolvedPdf);
const data = new Uint8Array(fileBuf.buffer, fileBuf.byteOffset, fileBuf.byteLength);
const loadingTask = pdfjsLib.getDocument({ data });
const pdf = await loadingTask.promise;

let meta = {};
try {
  const m = await pdf.getMetadata();
  meta = { producer: m?.info?.Producer ?? '', creator: m?.info?.Creator ?? '' };
} catch {
  meta = {};
}

console.log('=== PDF metadata ===');
console.log(JSON.stringify({ ...meta, pages: pdf.numPages, bytes: fileBuf.length }, null, 2));

const scored = [];
for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent({ disableCombineTextItems: true });
  const items = content.items.filter((it) => 'str' in it && it.str);
  const { text, itemRefs } = buildPageText(items);
  scored.push({ pageNum, ...scorePage(items, text), text, items, itemRefs });
  if (pageNum <= 15) {
    console.log(`\n--- page ${pageNum} ---`);
    console.log(JSON.stringify({ pageNum, ...scorePage(items, text) }));
  }
}

const active = scored.filter((s) => !s.skipped);
const bad = active.filter((s) => !s.ok);
console.log(`\n=== Summary: ${active.length} scored pages, ${bad.length} bad ===`);
for (const row of [...bad].sort((a, b) => b.fragmentation - a.fragmentation).slice(0, 10)) {
  console.log(JSON.stringify({ pageNum: row.pageNum, fragmentation: row.fragmentation, singleCharRatio: row.singleCharRatio, preview: row.preview }));
}

const p1 = scored[0];
const rawItems = p1.items;
const sampleItems = rawItems.slice(0, 30).map((it) => ({
  str: it.str,
  x: Number((it.transform?.[4] ?? 0).toFixed(1)),
  y: Number((it.transform?.[5] ?? 0).toFixed(1)),
  w: Number((it.width ?? 0).toFixed(2)),
  hasEOL: it.hasEOL ?? false,
}));

console.log('\n=== Page 1 raw items (first 30) ===');
console.log(JSON.stringify(sampleItems, null, 2));
console.log('\n=== Page 1 assembled text (first 1200 chars) ===');
console.log(p1.text.slice(0, 1200));

const ys = rawItems.map((it) => it.transform?.[5] ?? 0);
const sortedY = [...new Set(ys.map((y) => Math.round(y * 10) / 10))].sort((a, b) => b - a);
console.log(`\n=== Page 1 distinct Y bands (~0.1): ${sortedY.length} ===`);

if (targetPhrase) {
  const pageNum = targetPage && Number.isFinite(targetPage) ? targetPage : 1;
  const row = scored.find((s) => s.pageNum === pageNum);
  if (!row) {
    console.error(`\nNo page ${pageNum}`);
    process.exit(1);
  }
  const needle = targetPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(needle, 'gu');
  console.log(`\n=== Phrase audit: page ${pageNum} "${targetPhrase}" ===`);
  let n = 0;
  let match;
  while ((match = re.exec(row.text)) !== null) {
    n += 1;
    const idx = match.index;
    const lineStart = row.text.lastIndexOf('\n', idx - 1) + 1;
    const lineEnd = row.text.indexOf('\n', idx);
    const lineText = row.text
      .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      .trim();
    const overlapping = [];
    let cursor = 0;
    for (let itemIndex = 0; itemIndex < row.items.length; itemIndex++) {
      const it = row.items[itemIndex];
      if (!it.str) continue;
      const start = cursor;
      const end = cursor + it.str.length;
      if (end > idx && start < idx + match[0].length) {
        const size = Math.max(
          Math.abs(it.transform?.[0] ?? 0),
          Math.abs(it.transform?.[3] ?? 0),
        );
        overlapping.push({
          str: it.str,
          x: Number((it.transform?.[4] ?? 0).toFixed(1)),
          y: Number((it.transform?.[5] ?? 0).toFixed(1)),
          pt: Number(size.toFixed(1)),
        });
      }
      cursor = end + (it.hasEOL ? 1 : 0);
    }
    const standalone =
      lineText === match[0] ||
      (lineText.startsWith(match[0]) && lineText.length <= match[0].length + 12);
    console.log(
      JSON.stringify(
        {
          hit: n,
          index: idx,
          matched: match[0],
          lineText: lineText.slice(0, 120),
          standalone,
          items: overlapping,
        },
        null,
        2,
      ),
    );
  }
  if (!n) {
    console.log('(no matches in assembled page.text — 소제목이 텍스트 레이어에 없을 수 있음)');
  }
}
