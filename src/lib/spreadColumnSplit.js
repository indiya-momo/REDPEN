/**
 * 펼침면 PDF — 책등(gutter) 기준 좌/우 단 분할 (buildPageText 전용)
 */

/** @typedef {import('pdfjs-dist').TextItem} PdfTextItem */
/** @typedef {{ item: PdfTextItem, itemIndex: number }} TextEntry */

const MIN_GUTTER_GAP_PT = 28;
const SPREAD_MIN_WIDTH_PT = 360;
const SPREAD_WIDTH_HEIGHT_RATIO = 1.15;
const MIN_SPAN_ITEMS = 8;
const MIN_SIDE_ITEM_RATIO = 0.12;
const MAX_GUTTER_BAND_ITEM_RATIO = 0.1;
const MIN_COLUMN_Y_SPAN_RATIO = 0.22;

/**
 * @param {PdfTextItem} item
 */
export function getPdfItemXSpan(item) {
  const x0 = item.transform?.[4] ?? 0;
  const t = item.transform ?? [];
  const fs = Math.max(
    Math.abs(t[0] ?? 0),
    Math.abs(t[3] ?? 0),
    Math.hypot(t[2] ?? 0, t[3] ?? 0),
    8,
  );
  const w =
    (item.width ?? 0) > 0 ? item.width : fs * (item.str?.length ?? 1) * 0.5;
  return { x0, x1: x0 + w, cx: x0 + w / 2, fs };
}

/**
 * @param {PdfTextItem[]} sourceItems — dedupeOverlayTextItems 이후
 * @returns {{ gutterX: number, gutterGap: number } | null}
 */
export function detectSpreadGutter(sourceItems) {
  /** @type {{ cx: number, y: number, fs: number }[]} */
  const spans = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let fsSum = 0;

  for (const item of sourceItems) {
    if (!('str' in item) || !item.str || !item.transform) continue;
    const { x0, x1, cx, fs } = getPdfItemXSpan(item);
    const y = item.transform[5] ?? 0;
    spans.push({ cx, y, fs });
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    fsSum += fs;
  }

  if (spans.length < MIN_SPAN_ITEMS) return null;

  const width = maxX - minX;
  const height = Math.max(maxY - minY, 1);
  if (width < SPREAD_MIN_WIDTH_PT || width / height < SPREAD_WIDTH_HEIGHT_RATIO) {
    return null;
  }

  const avgFs = fsSum / spans.length;
  const minGap = Math.max(MIN_GUTTER_GAP_PT, avgFs * 2);
  const xs = spans.map((s) => s.cx).sort((a, b) => a - b);
  const zoneMin = minX + width * 0.2;
  const zoneMax = minX + width * 0.8;

  let bestGap = 0;
  let gutterX = (minX + maxX) / 2;

  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i] - xs[i - 1];
    const mid = (xs[i] + xs[i - 1]) / 2;
    if (gap > bestGap && mid >= zoneMin && mid <= zoneMax) {
      bestGap = gap;
      gutterX = mid;
    }
  }

  if (bestGap < minGap) {
    gutterX = (minX + maxX) / 2;
    const leftW = gutterX - minX;
    const rightW = maxX - gutterX;
    if (leftW < minGap || rightW < minGap) return null;
    bestGap = Math.max(leftW, rightW) * 0.35;
  }

  const margin = Math.max(bestGap * 0.08, 6);
  const left = spans.filter((s) => s.cx < gutterX - margin);
  const right = spans.filter((s) => s.cx >= gutterX + margin);
  const gutterBand = spans.filter(
    (s) => s.cx >= gutterX - margin && s.cx < gutterX + margin,
  );

  if (left.length < spans.length * MIN_SIDE_ITEM_RATIO) return null;
  if (right.length < spans.length * MIN_SIDE_ITEM_RATIO) return null;
  if (gutterBand.length > spans.length * MAX_GUTTER_BAND_ITEM_RATIO) return null;

  const ySpan = (list) => {
    if (!list.length) return 0;
    return Math.max(...list.map((s) => s.y)) - Math.min(...list.map((s) => s.y));
  };
  const minYSpan = height * MIN_COLUMN_Y_SPAN_RATIO;
  if (ySpan(left) < minYSpan || ySpan(right) < minYSpan) return null;

  return { gutterX, gutterGap: bestGap };
}

/**
 * @param {PdfTextItem[]} sourceItems
 * @param {number} gutterX
 * @returns {{ left: TextEntry[], right: TextEntry[] }}
 */
export function partitionSpreadEntries(sourceItems, gutterX) {
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
 * @param {PdfTextItem[]} sourceItems
 * @returns {{ left: TextEntry[], right: TextEntry[], gutterX: number } | null}
 */
export function splitSpreadColumns(sourceItems) {
  const layout = detectSpreadGutter(sourceItems);
  if (!layout) return null;
  const { left, right } = partitionSpreadEntries(sourceItems, layout.gutterX);
  if (!left.length || !right.length) return null;
  return { left, right, gutterX: layout.gutterX };
}
