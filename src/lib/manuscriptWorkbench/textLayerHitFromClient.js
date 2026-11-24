/**
 * scaleX text-layer에서 client/로컬 좌표 → page 텍스트 인덱스.
 * span 배치는 textLayerBoxes(left/top/width)와 동일 좌표를 쓴다.
 */

import {
  expandCharBoxesVoronoiX,
  nearestCharIndexAtPoint,
} from './pageGeometry.js';

/**
 * @param {Node | null | undefined} node
 * @param {Element | null | undefined} root
 * @returns {HTMLElement | null}
 */
export function closestTextItemSpan(node, root) {
  let el = node && node.nodeType === 3 ? node.parentElement : node;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.dataset.itemIndex != null) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * @param {Array<{ left: number, top: number, width: number, height: number }>} boxes
 * @param {number} x
 * @param {number} y
 */
function pickCandidateItemBoxes(boxes, x, y) {
  if (!Array.isArray(boxes) || !boxes.length) return [];
  // 같은 줄 전부 — 최근접 1개만 쓰면 「하고」옆 「인사」만 잡히는 것과 같은 문제
  const sameLine = boxes
    .filter((b) => {
      const pad = Math.max(4, (Number(b.height) || 0) * 0.25);
      return y >= b.top - pad && y <= b.top + Math.max(b.height, 1) + pad;
    })
    .slice()
    .sort((a, b) => a.left - b.left);
  if (sameLine.length) return sameLine;

  let best = null;
  let bestDist = Infinity;
  for (const b of boxes) {
    const cx = b.left + Math.max(b.width, 1) / 2;
    const cy = b.top + Math.max(b.height, 1) / 2;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best ? [best] : [];
}

/**
 * 캔버스 로컬 (x,y) + textLayerBoxes → page index (균일 비율, scaleX와 동일 가정).
 * @param {Array<{ left: number, top: number, width: number, height: number, start: number, end: number }> | null | undefined} itemBoxes
 * @param {number} x
 * @param {number} y
 * @returns {number | null}
 */
export function indexFromItemBoxesAtPoint(itemBoxes, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const candidates = pickCandidateItemBoxes(itemBoxes ?? [], x, y);
  if (!candidates.length) return null;
  // 같은 줄 전부일 때 [0]은 맨 왼쪽 item — 클릭 아래/최근접 item을 고른다
  let box = candidates.find((b) => {
    const w = Math.max(Number(b.width) || 0, 1);
    const h = Math.max(Number(b.height) || 0, 1);
    return (
      x >= b.left &&
      x <= b.left + w &&
      y >= b.top &&
      y <= b.top + h
    );
  });
  if (!box) {
    let bestD = Infinity;
    for (const b of candidates) {
      const w = Math.max(Number(b.width) || 0, 1);
      const cx = b.left + w / 2;
      const cy = b.top + Math.max(Number(b.height) || 0, 1) / 2;
      const yOverlap = y >= b.top && y <= b.top + Math.max(Number(b.height) || 0, 1);
      const dx = x < b.left ? b.left - x : x > b.left + w ? x - (b.left + w) : 0;
      const dy = yOverlap ? 0 : y - cy;
      const d = dx * dx + dy * dy * 4;
      if (d < bestD) {
        bestD = d;
        box = b;
      }
    }
  }
  if (!box) return null;
  const start = Number(box.start);
  const end = Number(box.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const len = end - start;
  const width = Math.max(Number(box.width) || 0, 1);
  const left = Number(box.left) || 0;
  const clamped = Math.min(Math.max(x, left), left + width - 1e-6);
  const ratio = (clamped - left) / width;
  const local = Math.min(len - 1, Math.max(0, Math.floor(ratio * len)));
  return start + local;
}

/**
 * @param {Element | null | undefined} root
 * @param {number} clientX
 * @param {number} clientY
 * @returns {HTMLElement | null}
 */
export function findTextLayerSpanAtClient(root, clientX, clientY) {
  if (!root || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  /** @type {HTMLElement | null} */
  let best = null;
  let bestDist = Infinity;
  const items = root.querySelectorAll('.pdf-text-layer__item');
  for (const el of items) {
    if (!(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) continue;
    const inside =
      clientX >= r.left &&
      clientX <= r.right &&
      clientY >= r.top &&
      clientY <= r.bottom;
    if (inside) return el;

    const yOverlap = clientY >= r.top && clientY <= r.bottom;
    const dx =
      clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
    const cy = (r.top + r.bottom) / 2;
    const dy = yOverlap ? 0 : clientY - cy;
    const d = dx * dx + dy * dy * 4;
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
}

/**
 * 한 줄 item을 글자 수 비율로 나누면 「어찌」클릭이 「그리」가 된다.
 * Range 글리프 rect + 보로노이 (균일 비율보다 우선).
 * @param {Element | null | undefined} span
 * @param {number} start
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number | null}
 */
function indexFromSpanCharRects(span, start, clientX, clientY) {
  const node = span?.firstChild;
  if (!node || node.nodeType !== 3) return null;
  if (!node || node.nodeType !== 3) return null;
  const text = node.nodeValue ?? '';
  if (!text) return null;
  /** @type {Array<{ left: number, top: number, width: number, height: number, index: number }>} */
  const boxes = [];
  for (let i = 0; i < text.length; i += 1) {
    // 공백도 포함 — 빼면 「그」·「모」중점이 공백 한가운데라 「그 」클릭이 「모」가 됨.
    // 공백 index는 extractStartEojeol trailing → 앞 어절.
    const range = document.createRange();
    try {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
    } catch {
      return null;
    }
    const r = range.getClientRects()[0];
    if (!r || !(r.width > 0) || !(r.height > 0)) continue;
    boxes.push({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      index: start + i,
    });
  }
  if (boxes.length < 2) return null;
  const y = Number.isFinite(clientY)
    ? clientY
    : boxes[0].top + boxes[0].height / 2;
  return nearestCharIndexAtPoint(expandCharBoxesVoronoiX(boxes), clientX, y);
}

/**
 * span visual → page index (data-start 기준).
 * 글자 rect가 있으면 그걸 쓰고, 없으면 폭 비율 (테스트 더블·빈 span).
 * @param {Pick<HTMLElement, 'dataset' | 'getBoundingClientRect'> | null | undefined} span
 * @param {number} clientX
 * @param {number} [clientY]
 * @returns {number | null}
 */
export function indexFromTextLayerSpan(span, clientX, clientY) {
  if (!span || !Number.isFinite(clientX)) return null;
  const start = Number(span.dataset?.start);
  const end = Number(span.dataset?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const fromChars = indexFromSpanCharRects(
    /** @type {Element} */ (span),
    start,
    clientX,
    clientY,
  );
  if (fromChars != null) return fromChars;

  const rect = span.getBoundingClientRect();
  const width = Number(rect?.width) || 0;
  const left = Number(rect?.left) || 0;
  const len = end - start;
  if (!(width > 0)) return start;

  const x = Math.min(Math.max(clientX, left), left + width - 1e-6);
  const ratio = (x - left) / width;
  const local = Math.min(len - 1, Math.max(0, Math.floor(ratio * len)));
  return start + local;
}

/**
 * @param {Element | null | undefined} root
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number | null}
 */
export function indexFromTextLayerClientPoint(root, clientX, clientY) {
  const span = findTextLayerSpanAtClient(root, clientX, clientY);
  if (!span) return null;
  return indexFromTextLayerSpan(span, clientX, clientY);
}

/**
 * 레이아웃 마크용 단일 점 히트 (우선: itemBoxes 로컬, 보조: DOM span).
 * @param {{
 *   root: Element | null | undefined,
 *   wrap: Element | null | undefined,
 *   itemBoxes: Array<{ left: number, top: number, width: number, height: number, start: number, end: number }> | null | undefined,
 *   clientX: number,
 *   clientY: number,
 *   eventTarget?: EventTarget | null,
 * }} args
 * @returns {number | null}
 */
export function layoutIndexFromClientPoint({
  root,
  wrap,
  itemBoxes,
  clientX,
  clientY,
  eventTarget = null,
}) {
  // DOM 글자 Range rect 우선 (scaleX 뒤에도 화면과 맞음). 균일 비율·글리프는 폴백.
  const fromTarget = closestTextItemSpan(
    /** @type {Node | null} */ (eventTarget),
    root,
  );
  if (fromTarget) {
    const idx = indexFromTextLayerSpan(fromTarget, clientX, clientY);
    if (idx != null) return idx;
  }
  const fromDom = indexFromTextLayerClientPoint(root, clientX, clientY);
  if (fromDom != null) return fromDom;

  if (wrap && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const wr = wrap.getBoundingClientRect();
    const localX = clientX - wr.left;
    const localY = clientY - wr.top;
    const fromBoxes = indexFromItemBoxesAtPoint(itemBoxes, localX, localY);
    if (fromBoxes != null) return fromBoxes;
  }
  return null;
}

/**
 * 레이아웃 마크용: 단일 page index → TextHit (한 글자; 어절 확장은 appendLayoutMark).
 * @param {import('../pdfService.js').PageData | null | undefined} pageData
 * @param {number | null | undefined} index
 * @returns {import('./types.js').TextHit | null}
 */
export function hitFromSingleIndex(pageData, index) {
  if (!pageData || !Number.isFinite(index)) return null;
  const text = String(pageData.visualText ?? pageData.text ?? '');
  const start = Math.max(0, Math.min(Math.floor(/** @type {number} */ (index)), text.length));
  if (start >= text.length) return null;
  const end = start + 1;
  return {
    pageNum: pageData.pageNum,
    start,
    end,
    matchedText: text.slice(start, end),
  };
}
