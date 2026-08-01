/**
 * C 벤치 — reading order / 하이라이트 갈라보기
 *
 * PDF.js 원시 item vs buildPageText(visualText) vs 기하 (page,-y,x) 순서를
 * 같은 needle로 비교한다. MuPDF/Sumatra는 수동 oracle (박스 순서)로만 적는다.
 *
 * Usage:
 *   node scripts/bench-reading-order.mjs "<pdf>" --page=81 --phrase=명지
 *   node scripts/bench-reading-order.mjs "<pdf>" --page=81 --phrase=명지 --out=tmp/ro-bench.json
 *
 * @see project-docs/reading-order-find-benchmark-2026-08-02.md §C
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPageText } from '../src/lib/pdfPageText.js';
import { findRefForTextIndex } from '../src/toc-body/lib/pdfHeadingExtract.js';
import {
  findPhraseHitsInPdfItems,
  sortPhraseHitsReadingOrder,
} from '../src/lib/pdfItemPhraseFind.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmapCandidates = [
  path.resolve(__dirname, '../node_modules/pdfjs-dist/cmaps'),
  path.resolve(__dirname, '../docs/pdfjs/cmaps'),
  path.resolve(__dirname, '../public/pdfjs/cmaps'),
];
const cmapDir = cmapCandidates.find((p) => {
  try {
    return fs.existsSync(p) && fs.readdirSync(p).length > 0;
  } catch {
    return false;
  }
});
if (!cmapDir) {
  console.error('cMap 디렉터리 없음 (public/pdfjs/cmaps | pdfjs-dist/cmaps)');
  process.exit(1);
}
const cmapUrl = `${cmapDir.replace(/\\/g, '/')}/`;
console.error(`cMap: ${cmapUrl}`);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(
    __dirname,
    '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  ),
).href;

const args = process.argv.slice(2);
const pdfPath = args.find((a) => !a.startsWith('--'));
const pageArg = args.find((a) => a.startsWith('--page='));
const phraseArg = args.find((a) => a.startsWith('--phrase='));
const outArg = args.find((a) => a.startsWith('--out='));

const targetPage = pageArg ? Number.parseInt(pageArg.split('=')[1], 10) : null;
const phrase = phraseArg
  ? decodeURIComponent(phraseArg.split('=').slice(1).join('='))
  : '명지';
const outPath = outArg ? path.resolve(outArg.split('=').slice(1).join('=')) : null;

if (!pdfPath || !targetPage || !Number.isFinite(targetPage)) {
  console.error(
    'Usage: node scripts/bench-reading-order.mjs "<pdf>" --page=N [--phrase=명지] [--out=path.json]',
  );
  process.exit(1);
}

const resolvedPdf = path.resolve(pdfPath);
if (!fs.existsSync(resolvedPdf)) {
  console.error(`PDF 없음: ${resolvedPdf}`);
  process.exit(1);
}

/** @param {string} s */
function glue(s) {
  return String(s ?? '').replace(/\s+/g, '');
}

/**
 * 원시 items에서 공백 무시 needle 출현 (스트림 순).
 * @param {import('pdfjs-dist').TextItem[]} items
 * @param {string} needle
 */
function findHitsInRawItems(items, needle) {
  const target = glue(needle);
  if (!target) return [];

  /** @type {{ ch: string, itemIndex: number, x: number, y: number }[]} */
  const chars = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const str = it?.str ?? '';
    const x = it.transform?.[4] ?? 0;
    const y = it.transform?.[5] ?? 0;
    for (let c = 0; c < str.length; c += 1) {
      if (/\s/.test(str[c])) continue;
      chars.push({ ch: str[c], itemIndex: i, x, y });
    }
  }

  /** @type {{ streamRank: number, itemIndex: number, x: number, y: number, snippet: string }[]} */
  const hits = [];
  for (let i = 0; i <= chars.length - target.length; i += 1) {
    let ok = true;
    for (let j = 0; j < target.length; j += 1) {
      if (chars[i + j].ch !== target[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const anchor = chars[i];
    const end = chars[i + target.length - 1];
    hits.push({
      streamRank: hits.length + 1,
      itemIndex: anchor.itemIndex,
      x: Number((((anchor.x + end.x) / 2)).toFixed(2)),
      y: Number((((anchor.y + end.y) / 2)).toFixed(2)),
      snippet: items
        .slice(Math.max(0, anchor.itemIndex - 1), anchor.itemIndex + 4)
        .map((it) => it.str)
        .join(''),
    });
  }
  return hits;
}

/**
 * visualText에서 needle (연속 또는 자간 공백 허용).
 * @param {string} text
 * @param {string} needle
 * @param {import('../src/lib/pdfPageText.js').TextItemRef[]} itemRefs
 * @param {import('pdfjs-dist').TextItem[]} items
 */
function findHitsInVisualText(text, needle, itemRefs, items) {
  const target = glue(needle);
  /** @type {{ visualRank: number, index: number, x: number, y: number, hasRef: boolean }[]} */
  const hits = [];
  if (!target || !text) return hits;

  /** @type {number[]} */
  const starts = [];
  let pos = 0;
  while (pos <= text.length - needle.length) {
    const idx = text.indexOf(needle, pos);
    if (idx < 0) break;
    starts.push(idx);
    pos = idx + 1;
  }
  if (!starts.length) {
    // 자간: 비공백만 모아 매칭 후 원문 오프셋 복원
    /** @type {number[]} */
    const map = [];
    let compact = '';
    for (let i = 0; i < text.length; i += 1) {
      if (/\s/.test(text[i])) continue;
      map.push(i);
      compact += text[i];
    }
    pos = 0;
    while (pos <= compact.length - target.length) {
      const idx = compact.indexOf(target, pos);
      if (idx < 0) break;
      starts.push(map[idx] ?? 0);
      pos = idx + 1;
    }
  }

  for (const index of starts) {
    const ref = findRefForTextIndex(itemRefs ?? [], index);
    const item = ref ? items[ref.itemIndex] : null;
    const x = item?.transform?.[4] ?? null;
    const y = item?.transform?.[5] ?? null;
    const end = Math.min(text.length, index + Math.max(needle.length, 2) + 12);
    const start = Math.max(0, index - 6);
    hits.push({
      visualRank: hits.length + 1,
      index,
      x: x == null ? null : Number(x.toFixed(2)),
      y: y == null ? null : Number(y.toFixed(2)),
      hasRef: Boolean(ref && item),
      snippet: text.slice(start, end).replace(/\n/g, '↵'),
    });
  }
  return hits;
}

/** @param {{ x: number, y: number }[]} hits */
function geometricOrder(hits) {
  const ranked = hits
    .map((h, i) => ({ ...h, _i: i }))
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
      if (Math.abs(a.x - b.x) > 0.5) return a.x - b.x;
      return a._i - b._i;
    });
  return ranked.map((h) => h.streamRank ?? h.visualRank);
}

function permutationLabel(order) {
  return order.join('');
}

const fileBuf = fs.readFileSync(resolvedPdf);
const data = new Uint8Array(fileBuf.buffer, fileBuf.byteOffset, fileBuf.byteLength);
const pdf = await pdfjsLib.getDocument({
  data,
  cMapUrl: cmapUrl,
  cMapPacked: true,
}).promise;
const page = await pdf.getPage(targetPage);
const content = await page.getTextContent({ disableCombineTextItems: true });
const items = content.items.filter((it) => 'str' in it && it.str);
const { text, visualText, itemRefs, textLayout } = buildPageText(items);
const visual = visualText ?? text;

const rawHits = findHitsInRawItems(items, phrase);
const visualHits = findHitsInVisualText(visual, phrase, itemRefs, items);

const rawGeom = geometricOrder(rawHits);
const visualGeom = geometricOrder(
  visualHits.map((h) => ({
    ...h,
    x: h.x ?? 0,
    y: h.y ?? 0,
    streamRank: h.visualRank,
  })),
);
const visualStream = visualHits.map((h) => h.visualRank);

const rawMissingHighlight = visualHits.filter((h) => !h.hasRef).length;

/** @type {'raw_stream' | 'assembly' | 'geometry_weak' | 'ok_unknown'} */
let verdict = 'ok_unknown';
const rawStreamLabel = permutationLabel(rawHits.map((h) => h.streamRank));
const rawGeomLabel = permutationLabel(rawGeom);
const visualLabel = permutationLabel(visualStream);
const visualGeomLabel = permutationLabel(visualGeom);

// 휴리스틱: 기하와 스트림이 다르면 스트림/조립이 reading order가 아님
if (rawHits.length >= 3 && rawStreamLabel !== rawGeomLabel) {
  verdict = 'raw_stream'; // 원시 스트림 순 ≠ 기하 → 조립 전에도 순서 문제 가능, 기하 정렬·B 후보
}
if (rawHits.length >= 3 && rawGeomLabel === rawStreamLabel && visualLabel !== rawGeomLabel) {
  verdict = 'assembly'; // 기하는 스트림과 같은데 visual만 다름 → 조립이 섞음
}
if (
  rawHits.length >= 3 &&
  rawStreamLabel !== rawGeomLabel &&
  visualLabel === rawStreamLabel
) {
  verdict = 'raw_stream'; // visual이 스트림을 따름 → 칩이 스트림 순
}
if (rawHits.length >= 3 && rawGeomLabel === visualGeomLabel && visualLabel !== visualGeomLabel) {
  // visual index 순 ≠ 기하 → 칩을 기하로 바꾸면 개선 가능 (B)
  if (verdict === 'ok_unknown') verdict = 'raw_stream';
}
if (rawHits.length === 0) verdict = 'ok_unknown';

const bHits = sortPhraseHitsReadingOrder(
  findPhraseHitsInPdfItems(items, phrase),
  items,
  targetPage,
);

const report = {
  pdf: resolvedPdf,
  page: targetPage,
  phrase,
  counts: {
    rawItems: items.length,
    rawHits: rawHits.length,
    visualHits: visualHits.length,
    visualHitsWithoutItemRef: rawMissingHighlight,
    textLayoutLen: textLayout?.length ?? 0,
    visualLen: visual.length,
    bHits: bHits.length,
  },
  orders: {
    rawStream: rawStreamLabel,
    rawGeometric: rawGeomLabel,
    visualIndex: visualLabel,
    visualGeometric: visualGeomLabel,
    bReadingOrder: permutationLabel(bHits.map((_, i) => i + 1)),
  },
  verdict,
  verdictHint: {
    raw_stream:
      '원시 item 스트림 순이 기하(위→아래)와 다름. 칩이 스트림/visual index를 따르면 리더와 어긋남 → B(문자+bbox Find) 또는 기하 정렬이 유효 후보. MuPDF oracle과 rawGeom을 비교할 것.',
    assembly:
      '기하≈스트림인데 visual index만 다름 → buildPageText 조립이 순서를 바꿈. 조립 수정·B.',
    geometry_weak:
      '기하 정렬도 리더와 다르면(수동 확인) PDF.js 좌표만으로는 한계 → A(MuPDF) 재검토.',
    ok_unknown: 'hit 부족하거나 판정 불명 — 수동으로 리더/Sumatra 순서와 비교.',
  }[verdict],
  rawHits,
  visualHits,
  bHits,
  decisionTree: {
    nextIfRawAlreadyScrambledVsLeader:
      'rawGeometric을 리더 1…N과 비교. 같으면 B로 충분 가능. 다르면 A 근거.',
    nextIfVisualOnlyScrambled: '조립(B 일부) 우선.',
    highlight: `${rawMissingHighlight}건 hasRef=false → 7번형 투영 후보`,
    bPath: `pdfItemPhraseFind → ${bHits.length}건 (oracle 7이면 개수 OK)`,
  },
};

console.log('=== C bench: reading-order ===');
console.log(JSON.stringify({
  pdf: report.pdf,
  page: report.page,
  phrase: report.phrase,
  counts: report.counts,
  orders: report.orders,
  verdict: report.verdict,
  verdictHint: report.verdictHint,
  decisionTree: report.decisionTree,
}, null, 2));

console.log('\n--- raw hits (stream order) ---');
for (const h of rawHits) {
  console.log(
    `#${h.streamRank} item=${h.itemIndex} x=${h.x} y=${h.y}  ${h.snippet.slice(0, 40)}`,
  );
}
console.log('\n--- visual hits (index order) ---');
for (const h of visualHits) {
  console.log(
    `#${h.visualRank} index=${h.index} x=${h.x} y=${h.y} hasRef=${h.hasRef}  ${h.snippet ?? ''}`,
  );
}

console.log('\n--- B hits (item+bbox, reading order) ---');
bHits.forEach((h, i) => {
  console.log(
    `#${i + 1} ${h.kind} item=${h.itemIndex} x=${h.x} y=${h.y}  ${String(h.snippet).slice(0, 40)}`,
  );
});

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${outPath}`);
}

console.log(`
다음 수동 칸 (리더 / Sumatra):
  oracleOrder: 1…${Math.max(rawHits.length, visualHits.length)} (보는 순)
  rawGeometric vs oracle: (같으면 PDF.js 좌표로 B 가능)
  visualHitsWithoutItemRef > 0 이면 하이라이트 누락 후보
`);
