/**
 * PDF 텍스트 추출 진단 (일회성)
 * Usage: node scripts/diagnose-pdf-text.mjs "<path>"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

function buildPageText(items) {
  const lines = [];
  items.forEach((item, itemIndex) => {
    if (!('str' in item) || !item.str) return;
    const y = item.transform?.[5] ?? 0;
    const lineH =
      Math.max(Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0), 8) * 0.55;
    let line = lines.find((l) => Math.abs(l.y - y) <= lineH);
    if (!line) {
      line = { y, entries: [] };
      lines.push(line);
    }
    line.entries.push({ item, itemIndex });
  });
  lines.sort((a, b) => b.y - a.y);
  let text = '';
  for (const line of lines) {
    line.entries.sort(
      (a, b) => (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
    );
    for (let i = 0; i < line.entries.length; i++) {
      const { item } = line.entries[i];
      text += item.str;
      if (i < line.entries.length - 1) {
        const gap =
          (line.entries[i + 1].item.transform?.[4] ?? 0) -
          ((item.transform?.[4] ?? 0) + (item.width ?? 0));
        const lineH =
          Math.max(Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0), 8) * 0.35;
        if (gap > lineH) text += ' ';
      }
    }
    text += '\n';
  }
  return text;
}

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

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/diagnose-pdf-text.mjs "<path>"');
  process.exit(1);
}

const fileBuf = fs.readFileSync(pdfPath);
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
  const content = await page.getTextContent();
  const items = content.items.filter((it) => 'str' in it);
  const text = buildPageText(content.items);
  scored.push({ pageNum, ...scorePage(items, text), text, items });
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
