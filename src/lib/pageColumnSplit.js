/**
 * 페이지 내 2단(column) — 읽기 영역 분할 (buildPageText 전용)
 * 펼침면(spreadColumnSplit)과 threshold·page ratio를 공유하지 않는다.
 * @see project-docs/page-column-reading-order-2026-08-01.md
 */

import { getPdfItemXSpan } from './spreadColumnSplit.js';

/** @typedef {import('pdfjs-dist').TextItem} PdfTextItem */
/** @typedef {{ item: PdfTextItem, itemIndex: number }} TextEntry */

/** gutter / pageWidth — 절대 pt보다 비율 (합의 ~8–10%) */
const MIN_GUTTER_WIDTH_RATIO = 0.09;
const MIN_SPAN_ITEMS = 10;
const MIN_SIDE_ITEM_RATIO = 0.22;
const MIN_SIDE_CHAR_RATIO = 0.18;
const MAX_GUTTER_BAND_ITEM_RATIO = 0.08;
const MIN_COLUMN_Y_SPAN_RATIO = 0.28;
/** 각 단에 최소 몇 개의 독립 y 밴드(줄)가 있어야 본문 덩어리로 본다 */
const MIN_SIDE_Y_BANDS = 3;
/**
 * 펼침면 후보는 이 모듈에서 다루지 않음 (spreadColumnSplit 전담).
 * width/height·최소 폭이 펼침면 쪽과 겹치면 null.
 */
const SPREAD_MIN_WIDTH_PT = 360;
const SPREAD_WIDTH_HEIGHT_RATIO = 1.15;

/**
 * @param {{ y: number, fs: number }[]} spans
 */
function countYBands(spans) {
  if (!spans.length) return 0;
  const sorted = [...spans].sort((a, b) => b.y - a.y);
  let bands = 0;
  let lastY = null;
  for (const s of sorted) {
    const tol = Math.max(s.fs, 8) * 0.55;
    if (lastY == null || Math.abs(s.y - lastY) > tol) {
      bands += 1;
      lastY = s.y;
    }
  }
  return bands;
}

/**
 * @param {PdfTextItem[]} sourceItems — dedupeOverlayTextItems 이후
 * @returns {{ gutterX: number, gutterGap: number, pageWidth: number } | null}
 */
export function detectPageColumns(sourceItems) {
  /** @type {{ cx: number, y: number, fs: number, chars: number }[]} */
  const spans = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of sourceItems) {
    if (!('str' in item) || !item.str || !item.transform) continue;
    const { x0, x1, cx, fs } = getPdfItemXSpan(item);
    const y = item.transform[5] ?? 0;
    const chars = String(item.str).replace(/\s+/g, '').length;
    spans.push({ cx, y, fs, chars: Math.max(chars, 1) });
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (spans.length < MIN_SPAN_ITEMS) return null;

  const width = maxX - minX;
  const height = Math.max(maxY - minY, 1);
  if (width < 80) return null;

  // 펼침면 후보는 비공유 — spread 모듈에 맡김
  if (width >= SPREAD_MIN_WIDTH_PT && width / height >= SPREAD_WIDTH_HEIGHT_RATIO) {
    return null;
  }

  const xs = spans.map((s) => s.cx).sort((a, b) => a - b);
  const zoneMin = minX + width * 0.22;
  const zoneMax = minX + width * 0.78;

  /** @type {{ gap: number, mid: number }[]} */
  const midGaps = [];
  /** @type {number[]} */
  const allGaps = [];
  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i] - xs[i - 1];
    if (gap <= 0) continue;
    allGaps.push(gap);
    const mid = (xs[i] + xs[i - 1]) / 2;
    if (mid >= zoneMin && mid <= zoneMax) {
      midGaps.push({ gap, mid });
    }
  }
  if (!midGaps.length) return null;

  midGaps.sort((a, b) => b.gap - a.gap);
  const bestGap = midGaps[0].gap;
  const gutterX = midGaps[0].mid;

  if (bestGap / width < MIN_GUTTER_WIDTH_RATIO) return null;

  // 표처럼 비슷한 간격이 여러 개면 "지배적 gutter"가 아님
  const secondGap = midGaps[1]?.gap ?? 0;
  if (midGaps.length >= 2 && secondGap > 0 && bestGap < secondGap * 1.85) {
    return null;
  }
  if (allGaps.length >= 4) {
    allGaps.sort((a, b) => a - b);
    const medianGap = allGaps[Math.floor(allGaps.length / 2)] || 0;
    if (medianGap > 0 && bestGap < medianGap * 2.2) return null;
  }

  const margin = Math.max(bestGap * 0.1, 4);
  const left = spans.filter((s) => s.cx < gutterX - margin);
  const right = spans.filter((s) => s.cx >= gutterX + margin);
  const gutterBand = spans.filter(
    (s) => s.cx >= gutterX - margin && s.cx < gutterX + margin,
  );

  if (left.length < spans.length * MIN_SIDE_ITEM_RATIO) return null;
  if (right.length < spans.length * MIN_SIDE_ITEM_RATIO) return null;
  if (gutterBand.length > spans.length * MAX_GUTTER_BAND_ITEM_RATIO) return null;

  const totalChars = spans.reduce((s, x) => s + x.chars, 0);
  const leftChars = left.reduce((s, x) => s + x.chars, 0);
  const rightChars = right.reduce((s, x) => s + x.chars, 0);
  if (leftChars < totalChars * MIN_SIDE_CHAR_RATIO) return null;
  if (rightChars < totalChars * MIN_SIDE_CHAR_RATIO) return null;

  const ySpan = (list) => {
    if (!list.length) return 0;
    return Math.max(...list.map((s) => s.y)) - Math.min(...list.map((s) => s.y));
  };
  const minYSpan = height * MIN_COLUMN_Y_SPAN_RATIO;
  if (ySpan(left) < minYSpan || ySpan(right) < minYSpan) return null;

  if (countYBands(left) < MIN_SIDE_Y_BANDS) return null;
  if (countYBands(right) < MIN_SIDE_Y_BANDS) return null;

  return { gutterX, gutterGap: bestGap, pageWidth: width };
}

/**
 * @param {PdfTextItem[]} sourceItems
 * @param {number} gutterX
 * @returns {{ left: TextEntry[], right: TextEntry[] }}
 */
export function partitionPageColumnEntries(sourceItems, gutterX) {
  /** @type {TextEntry[]} */
  const left = [];
  /** @type {TextEntry[]} */
  const right = [];

  sourceItems.forEach((item, itemIndex) => {
    if (!('str' in item) || !item.str || !item.transform) return;
    const { cx } = getPdfItemXSpan(item);
    const row = { item, itemIndex };
    if (cx < gutterX) left.push(row);
    else right.push(row);
  });

  return { left, right };
}

/**
 * 확실한 페이지 내 2단만 분할. 애매하면 null → 기존 단일 조립.
 * @param {PdfTextItem[]} sourceItems
 * @returns {{ left: TextEntry[], right: TextEntry[], gutterX: number } | null}
 */
export function splitPageColumns(sourceItems) {
  const layout = detectPageColumns(sourceItems);
  if (!layout) return null;
  const { left, right } = partitionPageColumnEntries(
    sourceItems,
    layout.gutterX,
  );
  if (!left.length || !right.length) return null;
  return { left, right, gutterX: layout.gutterX };
}
