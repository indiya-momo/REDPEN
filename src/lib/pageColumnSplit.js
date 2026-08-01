/**
 * 페이지 내 2단(column) — 읽기 영역 분할 (buildPageText 전용)
 * 펼침면(spreadColumnSplit)과 threshold·page ratio를 공유하지 않는다.
 * @see project-docs/page-column-reading-order-2026-08-01.md
 */

import { getPdfItemXSpan } from './spreadColumnSplit.js';

/** @typedef {import('pdfjs-dist').TextItem} PdfTextItem */
/** @typedef {{ item: PdfTextItem, itemIndex: number }} TextEntry */
/** @typedef {{ cx: number, y: number, fs: number, chars: number }} Span */

/**
 * gutter / pageWidth — 절대 pt보다 비율.
 * 교재 점선 단 구분(~5–8%)도 잡되, 표 격자 오탐은 후보 점수·밸런스로 막는다.
 */
const MIN_GUTTER_WIDTH_RATIO = 0.05;
const MIN_SPAN_ITEMS = 10;
const MIN_SIDE_ITEM_RATIO = 0.18;
const MIN_SIDE_CHAR_RATIO = 0.15;
const MAX_GUTTER_BAND_ITEM_RATIO = 0.1;
const MIN_COLUMN_Y_SPAN_RATIO = 0.22;
/** 각 단에 최소 몇 개의 독립 y 밴드(줄)가 있어야 본문 덩어리로 본다 */
const MIN_SIDE_Y_BANDS = 3;
/**
 * 펼침면 후보는 이 모듈에서 다루지 않음 (spreadColumnSplit 전담).
 * width/height·최소 폭이 펼침면 쪽과 겹치면 null.
 */
const SPREAD_MIN_WIDTH_PT = 360;
const SPREAD_WIDTH_HEIGHT_RATIO = 1.15;
/** 점수 비슷한 유효 후보가 2개 이상이면 표/격자 — 분리하지 않음 */
const AMBIGUOUS_SCORE_RATIO = 0.82;

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
 * @param {Span[]} spans
 * @param {number} gutterX
 * @param {number} gap
 * @param {number} height
 * @returns {{
 *   ok: boolean,
 *   score: number,
 *   gutterX: number,
 *   gutterGap: number,
 * } | null}
 */
function scoreGutterCandidate(spans, gutterX, gap, height) {
  const margin = Math.max(gap * 0.1, 3);
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

  const leftBands = countYBands(left);
  const rightBands = countYBands(right);
  if (leftBands < MIN_SIDE_Y_BANDS) return null;
  if (rightBands < MIN_SIDE_Y_BANDS) return null;

  const itemBalance =
    Math.min(left.length, right.length) / Math.max(left.length, right.length);
  const charBalance =
    Math.min(leftChars, rightChars) / Math.max(leftChars, rightChars);
  const bandBalance =
    Math.min(leftBands, rightBands) / Math.max(leftBands, rightBands);
  // 표 안쪽 칸 경계는 한쪽에 글이 몰려 balance가 낮고, 본문 2단 gutter는 높다.
  const score = gap * (0.45 * itemBalance + 0.35 * charBalance + 0.2 * bandBalance);

  return { ok: true, score, gutterX, gutterGap: gap };
}

/**
 * @param {PdfTextItem[]} sourceItems — dedupeOverlayTextItems 이후
 * @returns {{ gutterX: number, gutterGap: number, pageWidth: number } | null}
 */
export function detectPageColumns(sourceItems) {
  /** @type {Span[]} */
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
  const zoneMin = minX + width * 0.18;
  const zoneMax = minX + width * 0.82;

  /** @type {{ gap: number, mid: number }[]} */
  const midGaps = [];
  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i] - xs[i - 1];
    if (gap <= 0) continue;
    const mid = (xs[i] + xs[i - 1]) / 2;
    if (mid < zoneMin || mid > zoneMax) continue;
    if (gap / width < MIN_GUTTER_WIDTH_RATIO) continue;
    midGaps.push({ gap, mid });
  }
  if (!midGaps.length) return null;

  // 같은 mid 근처 중복 gap은 최대만 남김
  midGaps.sort((a, b) => b.gap - a.gap);
  /** @type {{ gap: number, mid: number }[]} */
  const uniqueGaps = [];
  for (const g of midGaps) {
    if (uniqueGaps.some((u) => Math.abs(u.mid - g.mid) < width * 0.04)) continue;
    uniqueGaps.push(g);
  }

  /** @type {{ ok: boolean, score: number, gutterX: number, gutterGap: number }[]} */
  const scored = [];
  for (const g of uniqueGaps) {
    const result = scoreGutterCandidate(spans, g.mid, g.gap, height);
    if (result) scored.push(result);
  }
  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // 점수 비슷한 유효 분할이 여럿이면 표/격자 — 오분할 위험이 큼
  if (
    scored.length >= 2 &&
    scored[1].score >= best.score * AMBIGUOUS_SCORE_RATIO
  ) {
    return null;
  }

  return {
    gutterX: best.gutterX,
    gutterGap: best.gutterGap,
    pageWidth: width,
  };
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
