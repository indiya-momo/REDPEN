import { getTextItemFontSize } from '../toc-body/lib/pdfHeadingExtract.js';

/** @typedef {import('./pdfService.js').PageData} PageData */
/** @typedef {import('./ruleEngine.js').MatchInstance} MatchInstance */

const MIN_GUTTER_GAP_PT = 28;
const SPREAD_WIDTH_HEIGHT_RATIO = 1.15;
const SPREAD_MIN_WIDTH_PT = 360;

/** @type {WeakMap<PageData, { isSpread: boolean, gutterX: number, lineH: number }>} */
const layoutCache = new WeakMap();

/** @param {PageData['items'][number]} item */
function getItemXSpan(item) {
  const x0 = item.transform?.[4] ?? 0;
  const fs = getTextItemFontSize(item);
  const w =
    (item.width ?? 0) > 0 ? item.width : fs * (item.str?.length ?? 1) * 0.5;
  return { x0, x1: x0 + w, fs };
}

/**
 * @param {PageData} pageData
 * @returns {{ isSpread: boolean, gutterX: number, lineH: number }}
 */
export function getPageSpreadLayout(pageData) {
  const cached = layoutCache.get(pageData);
  if (cached) return cached;

  const items = pageData.items ?? [];
  const xs = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let fsSum = 0;
  let fsN = 0;

  for (const item of items) {
    if (!item?.transform) continue;
    const { x0, x1, fs } = getItemXSpan(item);
    const y = item.transform[5] ?? 0;
    const cx = (x0 + x1) / 2;
    xs.push(cx);
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    fsSum += fs;
    fsN += 1;
  }

  if (!fsN || !Number.isFinite(minX)) {
    const fallback = { isSpread: false, gutterX: 0, lineH: 10 };
    layoutCache.set(pageData, fallback);
    return fallback;
  }

  const width = maxX - minX;
  const height = Math.max(maxY - minY, 1);
  const avgFs = fsSum / fsN;
  const lineH = Math.max(avgFs * 0.55, 8);
  const isSpread =
    width >= SPREAD_MIN_WIDTH_PT && width / height >= SPREAD_WIDTH_HEIGHT_RATIO;

  let gutterX = (minX + maxX) / 2;
  if (isSpread && xs.length >= 4) {
    const sorted = [...xs].sort((a, b) => a - b);
    const zoneMin = minX + width * 0.2;
    const zoneMax = minX + width * 0.8;
    let bestGap = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i] - sorted[i - 1];
      const mid = (sorted[i] + sorted[i - 1]) / 2;
      if (gap > bestGap && mid >= zoneMin && mid <= zoneMax) {
        bestGap = gap;
        gutterX = mid;
      }
    }
    if (bestGap < MIN_GUTTER_GAP_PT) {
      gutterX = (minX + maxX) / 2;
    }
  }

  const layout = { isSpread, gutterX, lineH };
  layoutCache.set(pageData, layout);
  return layout;
}

/**
 * @param {PageData} pageData
 * @param {number} startIndex
 * @param {number} endIndex
 */
function getMatchAnchor(pageData, startIndex, endIndex) {
  const refs =
    pageData.itemRefs?.filter(
      (ref) => ref.end > startIndex && ref.start < endIndex,
    ) ?? [];
  const items = pageData.items ?? [];
  if (!refs.length) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let ySum = 0;
  let fsSum = 0;
  let n = 0;

  for (const ref of refs) {
    const item = items[ref.itemIndex];
    if (!item?.transform) continue;
    const { x0, x1, fs } = getItemXSpan(item);
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    ySum += item.transform[5] ?? 0;
    fsSum += fs;
    n += 1;
  }

  if (!n) return null;
  return {
    x: (minX + maxX) / 2,
    y: ySum / n,
    fs: fsSum / n,
  };
}

/**
 * @param {MatchInstance} inst
 * @param {Map<number, PageData>} pageByNum
 */
function getReadingSortKey(inst, pageByNum) {
  const page = pageByNum.get(inst.pageNum);
  const end = inst.index + (inst.matchedText?.length ?? 1);
  const anchor = page ? getMatchAnchor(page, inst.index, end) : null;
  if (!page || !anchor) {
    return {
      pageNum: inst.pageNum,
      column: 0,
      y: 0,
      x: inst.index,
      index: inst.index,
      hasSpatial: false,
    };
  }

  const layout = getPageSpreadLayout(page);
  const column =
    layout.isSpread && anchor.x >= layout.gutterX ? 1 : 0;

  return {
    pageNum: inst.pageNum,
    column,
    y: anchor.y,
    x: anchor.x,
    index: inst.index,
    hasSpatial: true,
    lineH: layout.lineH,
  };
}

/**
 * @param {MatchInstance} a
 * @param {MatchInstance} b
 * @param {Map<number, PageData>} pageByNum
 */
export function compareInstancesReadingOrder(a, b, pageByNum) {
  if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;

  const ka = getReadingSortKey(a, pageByNum);
  const kb = getReadingSortKey(b, pageByNum);

  if (!ka.hasSpatial || !kb.hasSpatial) {
    return a.index - b.index;
  }

  if (ka.column !== kb.column) return ka.column - kb.column;

  const lineH = Math.max(ka.lineH ?? 8, kb.lineH ?? 8);
  if (Math.abs(ka.y - kb.y) > lineH * 0.45) {
    return kb.y - ka.y;
  }

  if (Math.abs(ka.x - kb.x) > 0.5) {
    return ka.x - kb.x;
  }

  return a.index - b.index;
}

/**
 * @param {MatchInstance[]} instances
 * @param {Map<number, PageData>} pageByNum
 * @returns {MatchInstance[]}
 */
export function sortInstancesReadingOrder(instances, pageByNum) {
  if (!pageByNum.size) return [...instances];
  return [...instances].sort((a, b) =>
    compareInstancesReadingOrder(a, b, pageByNum),
  );
}

/**
 * @param {(PageData | { pageNum: number })[]} pages
 * @returns {Map<number, PageData>}
 */
export function buildPageByNum(pages) {
  /** @type {Map<number, PageData>} */
  const map = new Map();
  for (const page of pages) {
    if (page?.items?.length && page.itemRefs?.length) {
      map.set(page.pageNum, /** @type {PageData} */ (page));
    }
  }
  return map;
}
