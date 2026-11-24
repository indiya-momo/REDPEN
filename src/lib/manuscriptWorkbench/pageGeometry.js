import { highlightRectsForTextRange } from '../pdfService.js';

/**
 * 텍스트 레이어 선택을 page 오프셋 구간으로.
 * @param {import('../pdfService.js').PageData | null | undefined} pageData
 * @param {import('./types.js').TextLayerSelection | null | undefined} sel
 * @returns {import('./types.js').TextHit | null}
 */
export function selectionToRange(pageData, sel) {
  if (!pageData || !sel) return null;
  const refs = pageData.itemRefs ?? [];
  const startRef = refs.find((ref) => ref.itemIndex === sel.startItemIndex);
  const endRef = refs.find((ref) => ref.itemIndex === sel.endItemIndex);
  if (!startRef || !endRef) return null;

  let start = startRef.start + Math.max(0, sel.startOffset ?? 0);
  let end = endRef.start + Math.max(0, sel.endOffset ?? 0);
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  const text = String(pageData.visualText ?? pageData.text ?? '');
  start = Math.max(0, Math.min(start, text.length));
  end = Math.max(0, Math.min(end, text.length));
  if (end <= start) return null;
  return {
    pageNum: pageData.pageNum,
    start,
    end,
    matchedText: text.slice(start, end),
  };
}

/**
 * 같은 줄 이웃 글자 사이 x 중점으로 히트 폭을 나눈다.
 * 공백·어절 틈은 **공백 박스를 포함**해 두고(호출측), 틈 전부를 앞 글자에
 * 주면 다음 어절 왼쪽 절반이 앞 어절로 가서 「뭘 찍어도 왼쪽」이 된다.
 * @param {Array<{ left: number, top: number, width: number, height: number, index: number }>} charBoxes
 * @returns {Array<{ left: number, top: number, width: number, height: number, index: number }>}
 */
export function expandCharBoxesVoronoiX(charBoxes) {
  if (!Array.isArray(charBoxes) || !charBoxes.length) return [];
  const items = charBoxes
    .map((b) => ({
      left: Number(b.left),
      top: Number(b.top),
      width: Math.max(Number(b.width) || 0, 1),
      height: Math.max(Number(b.height) || 0, 1),
      index: Number(b.index),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.left) &&
        Number.isFinite(b.top) &&
        Number.isFinite(b.index),
    );
  if (items.length <= 1) return items;

  const sorted = items
    .slice()
    .sort((a, b) => a.top - b.top || a.left - b.left);
  /** @type {typeof items[]} */
  const lines = [];
  for (const b of sorted) {
    const line = lines.find(
      (row) =>
        Math.abs(row[0].top - b.top) <
        Math.max(row[0].height, b.height) * 0.6,
    );
    if (line) line.push(b);
    else lines.push([b]);
  }

  /** @type {typeof items} */
  const out = [];
  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);
    for (let i = 0; i < line.length; i += 1) {
      const cur = line[i];
      const prev = line[i - 1];
      const next = line[i + 1];
      const curRight = cur.left + cur.width;
      let hitLeft = cur.left;
      let hitRight = curRight;
      if (prev) {
        const mid = (prev.left + prev.width + cur.left) / 2;
        hitLeft = Math.min(cur.left, mid);
      } else {
        hitLeft = cur.left - Math.max(cur.width, 4) * 0.25;
      }
      if (next) {
        const mid = (curRight + next.left) / 2;
        hitRight = Math.max(curRight, mid);
      } else {
        hitRight = curRight + Math.max(cur.width, 4) * 0.25;
      }
      out.push({
        ...cur,
        left: hitLeft,
        width: Math.max(hitRight - hitLeft, 1),
      });
    }
  }
  return out;
}

/**
 * 글자 bbox 목록에서 (x,y)에 가장 가까운 page 인덱스.
 * scaleX 텍스트 레이어는 브라우저 선택이 어긋나므로 PDF 좌표로 보정할 때 쓴다.
 * @param {Array<{ left: number, top: number, width: number, height: number, index: number }>} charBoxes
 * @param {number} x
 * @param {number} y
 * @returns {number | null}
 */
export function nearestCharIndexAtPoint(charBoxes, x, y) {
  if (!Array.isArray(charBoxes) || !charBoxes.length) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  /** @type {Array<{ left: number, top: number, width: number, height: number, index: number }>} */
  const normalized = [];
  for (const b of charBoxes) {
    const left = Number(b.left);
    const top = Number(b.top);
    const width = Math.max(Number(b.width) || 0, 1);
    const height = Math.max(Number(b.height) || 0, 1);
    const index = Number(b.index);
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(index)) {
      continue;
    }
    normalized.push({ left, top, width, height, index });
  }
  if (!normalized.length) return null;

  /** @type {{ index: number, d: number } | null} */
  let contained = null;
  for (const b of normalized) {
    const inside =
      x >= b.left &&
      x <= b.left + b.width &&
      y >= b.top &&
      y <= b.top + b.height;
    if (inside) {
      const d = Math.abs(x - (b.left + b.width / 2));
      if (!contained || d < contained.d) contained = { index: b.index, d };
    }
  }
  if (contained) return contained.index;

  // 같은 줄: 캐럿식 — left <= x 인 글자 중 가장 오른쪽 (갭에서는 왼쪽 글자)
  const line = normalized
    .filter((b) => {
      const pad = Math.max(4, b.height * 0.25);
      return y >= b.top - pad && y <= b.top + b.height + pad;
    })
    .sort((a, b) => a.left - b.left);
  if (line.length) {
    let choice = line[0].index;
    for (const b of line) {
      if (b.left <= x) choice = b.index;
      else break;
    }
    return choice;
  }

  let bestIndex = null;
  let bestDist = Infinity;
  for (const b of normalized) {
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = b.index;
    }
  }
  return bestIndex;
}

/**
 * @param {Array<{ left: number, top: number, width: number, height: number }>} boxes
 * @param {number} x
 * @param {number} y
 */
export function pickCandidateItemBoxes(boxes, x, y) {
  // 같은 줄 item을 모두 후보에 넣는다.
  // 최근접 1개만 쓰면 「하고」item 박스 밖 클릭이 「인사」item만 잡혀 rawCh=인 이 된다.
  const padY = (b) => Math.max(4, (Number(b.height) || 0) * 0.25);
  const sameLine = boxes
    .filter((b) => {
      const pad = padY(b);
      return y >= b.top - pad && y <= b.top + Math.max(b.height, 1) + pad;
    })
    .slice()
    .sort((a, b) => a.left - b.left);
  if (sameLine.length) return sameLine;

  let best = null;
  let bestDist = Infinity;
  for (const b of boxes) {
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best ? [best] : [];
}

/**
 * 캔버스 로컬 (x,y) → page 텍스트 인덱스.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {import('../pdfService.js').PageData} pageData
 * @param {number} x
 * @param {number} y
 * @param {Array<{ left: number, top: number, width: number, height: number, start: number, end: number, itemIndex: number, str: string }> | null} [itemBoxes]
 * @returns {number | null}
 */
export function pointerToTextIndex(page, viewport, pageData, x, y, itemBoxes = null) {
  if (!page || !viewport || !pageData) return null;
  const boxes =
    itemBoxes && itemBoxes.length
      ? itemBoxes
      : textLayerItemBoxes(page, viewport, pageData);
  const candidates = pickCandidateItemBoxes(boxes, x, y);
  if (!candidates.length) return null;

  const text = String(pageData.visualText ?? pageData.text ?? '');
  /** @type {Array<{ left: number, top: number, width: number, height: number, index: number }>} */
  const charBoxes = [];
  for (const box of candidates) {
    const from = Math.max(0, Number(box.start) || 0);
    const to = Math.max(from, Number(box.end) || from);
    for (let i = from; i < to; i += 1) {
      // 공백도 후보. 빼면 어절 틈 중점이 다음 글자(「그 」→「모」).
      // 공백 index는 extractStartEojeol trailing → 앞 어절.
      const rects = highlightRectsForTextRange(
        page,
        viewport,
        pageData.items,
        pageData.itemRefs,
        i,
        i + 1,
        pageData,
      );
      const r = rects[0];
      if (!r) continue;
      charBoxes.push({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        index: i,
      });
    }
  }
  return nearestCharIndexAtPoint(expandCharBoxesVoronoiX(charBoxes), x, y);
}

/**
 * 드래그 시작·끝 글자 인덱스 → TextHit (끝 인덱스는 포함).
 * @param {import('../pdfService.js').PageData | null | undefined} pageData
 * @param {number | null | undefined} startIndex
 * @param {number | null | undefined} endIndex
 * @returns {import('./types.js').TextHit | null}
 */
export function hitFromPointerIndexes(pageData, startIndex, endIndex) {
  if (!pageData) return null;
  if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) return null;
  const text = String(pageData.visualText ?? pageData.text ?? '');
  let start = Math.min(/** @type {number} */ (startIndex), /** @type {number} */ (endIndex));
  let end = Math.max(/** @type {number} */ (startIndex), /** @type {number} */ (endIndex)) + 1;
  start = Math.max(0, Math.min(start, text.length));
  end = Math.max(0, Math.min(end, text.length));
  if (end <= start) return null;
  return {
    pageNum: pageData.pageNum,
    start,
    end,
    matchedText: text.slice(start, end),
  };
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {import('../pdfService.js').PageData} pageData
 * @param {{ start: number, end: number }} hit
 */
export function hitToRects(page, viewport, pageData, hit) {
  if (!pageData || !hit || hit.end <= hit.start) return [];
  return highlightRectsForTextRange(
    page,
    viewport,
    pageData.items,
    pageData.itemRefs,
    hit.start,
    hit.end,
    pageData,
  );
}

/**
 * 보이는 페이지 item마다 선택용 박스.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {import('../pdfService.js').PageData} pageData
 * @returns {Array<{
 *   left: number, top: number, width: number, height: number,
 *   start: number, end: number, itemIndex: number, str: string,
 * }>}
 */
export function textLayerItemBoxes(page, viewport, pageData) {
  const refs = pageData?.itemRefs ?? [];
  const items = pageData?.items ?? [];
  /** @type {Array<{
   *   left: number, top: number, width: number, height: number,
   *   start: number, end: number, itemIndex: number, str: string,
   * }>} */
  const out = [];
  for (const ref of refs) {
    const str = String(items[ref.itemIndex]?.str ?? '');
    if (!str) continue;
    const rects = highlightRectsForTextRange(
      page,
      viewport,
      items,
      [ref],
      ref.start,
      ref.end,
      pageData,
    );
    if (!rects.length) continue;
    // 줄바꿈으로 조각난 item은 첫 rect만 쓰면 줄 끝 글자(「서」)가 박스 밖이 된다
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const r of rects) {
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.left + r.width);
      bottom = Math.max(bottom, r.top + r.height);
    }
    out.push({
      left,
      top,
      width: Math.max(right - left, 4),
      height: Math.max(bottom - top, 6),
      start: ref.start,
      end: ref.end,
      itemIndex: ref.itemIndex,
      str,
    });
  }
  return out;
}
