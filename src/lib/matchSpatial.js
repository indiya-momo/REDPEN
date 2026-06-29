import {
  getLineContextAtTextIndex,
  getTextItemFontSize,
} from '../toc-body/lib/pdfHeadingExtract.js';

/** 단어·자간보다 넓은 x 점프 — 펼침면 책등(칼럼 경계) 오탐 차단 */
const MIN_COLUMN_GAP_PT = 28;
const MAX_INTRA_MATCH_GAP_LINE_H = 4;

/** @param {import('./pdfService.js').PageData['items'][number]} item */
function getItemXSpan(item) {
  const x0 = item.transform?.[4] ?? 0;
  const fs = getTextItemFontSize(item);
  const w =
    (item.width ?? 0) > 0 ? item.width : fs * (item.str?.length ?? 1) * 0.5;
  return { x0, x1: x0 + w, fs };
}

/**
 * 매치 구간의 연속 itemRefs 사이 x 점프가 칼럼(책등) 수준이면 true
 * @param {import('./pdfService.js').PageData} pageData
 * @param {import('./pdfPageText.js').TextItemRef[]} refs
 */
function hasColumnSpanningHorizontalGap(pageData, refs) {
  const items = pageData.items ?? [];
  if (refs.length < 2) return false;

  const sorted = [...refs].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prevItem = items[sorted[i - 1].itemIndex];
    const nextItem = items[sorted[i].itemIndex];
    if (!prevItem?.transform || !nextItem?.transform) continue;

    const prev = getItemXSpan(prevItem);
    const next = getItemXSpan(nextItem);
    const gap = next.x0 - prev.x1;
    if (gap <= 0) continue;

    const lineH = Math.max(Math.min(prev.fs, next.fs) * 0.55, 8);
    const maxAllowedGap = Math.max(
      lineH * MAX_INTRA_MATCH_GAP_LINE_H,
      MIN_COLUMN_GAP_PT,
    );
    if (gap > maxAllowedGap) return true;
  }
  return false;
}

/**
 * @param {import('./pdfService.js').PageData} pageData
 * @param {number} matchStart
 * @param {number} matchEnd
 * @param {number} [maxLineGap=2.8]
 */
export function isMatchSpatiallyCoherent(pageData, matchStart, matchEnd, maxLineGap = 2.8) {
  const refs = pageData.itemRefs?.filter(
    (ref) => ref.end > matchStart && ref.start < matchEnd,
  );
  if (!refs?.length) return true;

  if (hasColumnSpanningHorizontalGap(pageData, refs)) {
    return false;
  }

  const ctx = getLineContextAtTextIndex(pageData, matchStart);
  if (
    ctx &&
    matchStart >= ctx.lineStart &&
    matchEnd <= ctx.lineEnd
  ) {
    return true;
  }

  const ys = [];
  const heights = [];

  for (const ref of refs) {
    const item = pageData.items[ref.itemIndex];
    if (!item?.transform) continue;
    ys.push(item.transform[5]);
    heights.push(
      Math.max(Math.hypot(item.transform[2], item.transform[3]), 8),
    );
  }

  if (!ys.length) return true;

  const avgH = heights.reduce((a, b) => a + b, 0) / heights.length;
  const lineH = Math.max(avgH * 0.55, 8);
  const anchorY = ys[0];
  if (ys.every((y) => Math.abs(y - anchorY) <= lineH)) {
    return true;
  }

  const span = Math.max(...ys) - Math.min(...ys);
  return span <= avgH * maxLineGap;
}
