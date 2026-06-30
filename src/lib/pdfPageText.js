/**
 * PDF 텍스트 항목 → page.text 조립 (pdfjs·Vite worker 없음 — Node 스크립트·테스트용)
 */

import { splitSpreadColumns } from './spreadColumnSplit.js';

/**
 * @typedef {Object} TextItemRef
 * @property {number} start
 * @property {number} end
 * @property {number} itemIndex
 */

/** @typedef {{ item: import('pdfjs-dist').TextItem, itemIndex: number }} TextEntry */
/** @typedef {{ y: number, entries: TextEntry[] }} BuiltLine */

/** @param {string} s */
function endsWithHangulSyllable(s) {
  const t = String(s).trimEnd();
  if (!t) return false;
  const ch = t[t.length - 1];
  return ch >= '\uAC00' && ch <= '\uD7A3';
}

/** @param {string} s */
function startsWithHangulSyllable(s) {
  const t = String(s).trimStart();
  if (!t) return false;
  const ch = t[0];
  return ch >= '\uAC00' && ch <= '\uD7A3';
}

/** 조판 자간 수준 gap — 이보다 좁으면 같은 어절로 보고 공백을 넣지 않음 */
const SYLLABLE_BOUNDARY_MIN_GAP_RATIO = 0.1;
/** 본용언+보조용언 경계는 PDF 추출에서 붙는 경우가 많아 기준을 완화 */
const AUX_BOUNDARY_MIN_GAP_RATIO = 0.015;

const AUXILIARY_LEAD_SYLLABLES = new Set([
  '주',
  '줄',
  '보',
  '본',
  '지',
  '하',
  '가',
  '오',
  '있',
  '두',
  '내',
  '놓',
]);

/** @param {string} leftStr @param {string} rightStr */
function isLikelyAuxiliaryBoundary(leftStr, rightStr) {
  const left = String(leftStr ?? '').trimEnd();
  const right = String(rightStr ?? '').trimStart();
  if (!left || !right) return false;
  const leftLast = left[left.length - 1];
  const rightLead = right[0];
  return (
    (leftLast === '어' || leftLast === '아' || leftLast === '해') &&
    AUXILIARY_LEAD_SYLLABLES.has(rightLead)
  );
}

/** 본용언+보조용언 — 넓은 gap(어절·칸)만 공백, 음절 자간 삽입 없음 */
export function shouldInsertLayoutSpaceBetweenPdfItems(gap, lineH) {
  return gap > lineH;
}

export function shouldInsertSpaceBetweenPdfItems(gap, lineH, leftStr, rightStr) {
  if (shouldInsertLayoutSpaceBetweenPdfItems(gap, lineH)) return true;
  const minGap =
    lineH *
    (isLikelyAuxiliaryBoundary(leftStr, rightStr)
      ? AUX_BOUNDARY_MIN_GAP_RATIO
      : SYLLABLE_BOUNDARY_MIN_GAP_RATIO);
  return (
    gap >= minGap &&
    endsWithHangulSyllable(leftStr) &&
    startsWithHangulSyllable(rightStr)
  );
}

/** 소제목·본문이 비슷한 y인데 포인트만 다를 때 한 줄로 묶지 않음 */
const FONT_LINE_SPLIT_RATIO = 1.18;
/** 왼쪽 여백으로 다시 돌아오면 새 줄(인디자인 소제목) */
const LINE_X_RESET_PT = 36;
/** 조판 PDF 검색·출력 이중 레이어 — 좌표 양자화(한컴 등 x·y 1~2pt 흔들림) */
const OVERLAY_POS_BUCKET_PT = 2;

/**
 * Hancom·인디자인 등 — 동일 (x,y)에 같은 str이 2번 들어오면 검수 건수가 2배로 늘어남
 * @param {import('pdfjs-dist').TextItem[]} items
 */
export function dedupeOverlayTextItems(items) {
  const seen = new Set();
  /** @type {import('pdfjs-dist').TextItem[]} */
  const out = [];
  for (const item of items) {
    if (!('str' in item) || !item.str) continue;
    const t = item.transform ?? [];
    const x =
      Math.round(((t[4] ?? 0) / OVERLAY_POS_BUCKET_PT)) *
      OVERLAY_POS_BUCKET_PT;
    const y =
      Math.round(((t[5] ?? 0) / OVERLAY_POS_BUCKET_PT)) *
      OVERLAY_POS_BUCKET_PT;
    const key = `${item.str}\0${x}\0${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }[]} entries
 */
function builtLineSignature(entries) {
  return [...entries]
    .sort(
      (a, b) =>
        (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
    )
    .map(({ item }) => item.str ?? '')
    .join('');
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }[]} entries
 */
function normalizeBuiltLineSignature(entries) {
  return builtLineSignature(entries).replace(/\s+/g, ' ').trim();
}

/**
 * 페이지 전체가 [A,B,C,A,B,C]처럼 반복되면 앞 절반만 유지
 * @param {typeof builtLines} builtLines
 */
function dedupeMirroredPageBlock(builtLines) {
  const sigs = builtLines.map((line) =>
    normalizeBuiltLineSignature(line.entries),
  );
  const n = sigs.length;
  if (n < 2 || n % 2 !== 0) return builtLines;
  const half = n / 2;
  for (let i = 0; i < half; i++) {
    if (sigs[i] !== sigs[i + half]) return builtLines;
  }
  return builtLines.slice(0, half);
}

/**
 * 같은 줄 문장이 다른 y(검색·출력 레이어)로 한 번 더 들어온 경우 — 첫 줄만
 * @param {typeof builtLines} builtLines — y 내림차순(위→아래)
 */
function dedupeRepeatedBuiltLines(builtLines) {
  const seen = new Set();
  /** @type {typeof builtLines} */
  const kept = [];
  for (const line of builtLines) {
    const sig = normalizeBuiltLineSignature(line.entries);
    if (!sig) continue;
    if (seen.has(sig)) continue;
    seen.add(sig);
    kept.push(line);
  }
  return kept;
}

/**
 * @param {typeof builtLines} builtLines
 */
function dedupeOverlayBuiltLines(builtLines) {
  return dedupeRepeatedBuiltLines(dedupeMirroredPageBlock(builtLines));
}

/**
 * @param {import('pdfjs-dist').TextItem} item
 */
function pdfItemFontSize(item) {
  const t = item.transform ?? [];
  return Math.max(
    Math.abs(t[0] ?? 0),
    Math.abs(t[3] ?? 0),
    Math.hypot(t[2] ?? 0, t[3] ?? 0),
    8,
  );
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }} prev
 * @param {import('pdfjs-dist').TextItem} item
 */
function shouldStartNewTextLine(prev, item) {
  if (!prev) return false;
  const prevItem = prev.item;
  if (prevItem.hasEOL) return true;

  const y0 = prevItem.transform?.[5] ?? 0;
  const y1 = item.transform?.[5] ?? 0;
  const s0 = pdfItemFontSize(prevItem);
  const s1 = pdfItemFontSize(item);
  const lineH = Math.max(s0, s1) * 0.55;
  if (Math.abs(y0 - y1) > lineH) return true;

  const ratio = Math.max(s0, s1) / Math.min(s0, s1);
  if (ratio > FONT_LINE_SPLIT_RATIO) return true;

  const f0 = prevItem.fontName ?? '';
  const f1 = item.fontName ?? '';
  if (f0 && f1 && f0 !== f1) return true;

  const prevStr = prevItem.str ?? '';
  // Hancom 등: 공백 항목 width가 다음 글자까지 넓게 잡혀 x-reset 오탐 → 어절마다 줄바꿈
  if (!/^\s+$/.test(prevStr)) {
    const xEnd =
      (prevItem.transform?.[4] ?? 0) +
      (prevItem.width ?? prevItem.str.length * s0 * 0.5);
    const xStart = item.transform?.[4] ?? 0;
    if (xStart < xEnd - LINE_X_RESET_PT) return true;
  }

  return false;
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }[]} entries
 * @param {string} text
 * @param {TextItemRef[]} itemRefs
 * @param {(gap: number, lineH: number, left: string, right: string) => boolean} shouldGapSpace
 */
function appendBuiltLine(entries, text, itemRefs, shouldGapSpace) {
  if (!entries.length) return text;

  entries.sort(
    (a, b) => (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
  );

  for (let i = 0; i < entries.length; i++) {
    const { item, itemIndex } = entries[i];
    const start = text.length;
    text += item.str;
    itemRefs.push({ start, end: text.length, itemIndex });
    if (i < entries.length - 1) {
      const gap =
        (entries[i + 1].item.transform?.[4] ?? 0) -
        ((item.transform?.[4] ?? 0) + (item.width ?? 0));
      const lineH =
        Math.max(
          Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0),
          8,
        ) * 0.35;
      const nextStr = entries[i + 1].item.str ?? '';
      if (shouldGapSpace(gap, lineH, item.str, nextStr)) {
        text += ' ';
      }
    }
  }
  return `${text}\n`;
}

/**
 * @param {TextEntry[]} orderedEntries — sourceItems 순서의 부분집합
 * @returns {BuiltLine[]}
 */
function buildBuiltLinesFromEntries(orderedEntries) {
  /** @type {BuiltLine[]} */
  const builtLines = [];
  /** @type {TextEntry[]} */
  let bucket = [];

  const flush = () => {
    if (!bucket.length) return;
    const y = bucket[0].item.transform?.[5] ?? 0;
    builtLines.push({ y, entries: bucket });
    bucket = [];
  };

  for (const row of orderedEntries) {
    if (bucket.length && shouldStartNewTextLine(bucket[bucket.length - 1], row.item)) {
      flush();
    }
    bucket.push(row);
    if (row.item.hasEOL) flush();
  }
  flush();

  builtLines.sort((a, b) => b.y - a.y);
  return dedupeOverlayBuiltLines(builtLines);
}

/**
 * @param {import('pdfjs-dist').TextItem[]} sourceItems
 * @returns {BuiltLine[]}
 */
function buildUniqueLines(sourceItems) {
  /** @type {TextEntry[]} */
  const allEntries = [];
  sourceItems.forEach((item, itemIndex) => {
    if (!('str' in item) || !item.str) return;
    allEntries.push({ item, itemIndex });
  });

  const spread = splitSpreadColumns(sourceItems);
  if (!spread) {
    return buildBuiltLinesFromEntries(allEntries);
  }

  return [
    ...buildBuiltLinesFromEntries(spread.left),
    ...buildBuiltLinesFromEntries(spread.right),
  ];
}

/**
 * @param {import('pdfjs-dist').TextItem[]} items
 */
export function buildPageText(items) {
  const sourceItems = dedupeOverlayTextItems(items);
  const uniqueLines = buildUniqueLines(sourceItems);

  let text = '';
  let textLayout = '';
  /** @type {TextItemRef[]} */
  const itemRefs = [];
  /** @type {TextItemRef[]} */
  const itemRefsLayout = [];
  for (const line of uniqueLines) {
    text = appendBuiltLine(
      line.entries,
      text,
      itemRefs,
      shouldInsertSpaceBetweenPdfItems,
    );
    textLayout = appendBuiltLine(
      line.entries,
      textLayout,
      itemRefsLayout,
      (gap, lineH) => shouldInsertLayoutSpaceBetweenPdfItems(gap, lineH),
    );
  }

  return { text, itemRefs, textLayout, itemRefsLayout };
}
