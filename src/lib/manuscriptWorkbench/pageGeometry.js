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
    const box = rects[0];
    if (!box) continue;
    out.push({
      ...box,
      start: ref.start,
      end: ref.end,
      itemIndex: ref.itemIndex,
      str,
    });
  }
  return out;
}
