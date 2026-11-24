/**
 * 조판 layout-point 히트 정책 (PdfViewer 바깥).
 * DOM 글자 rect 우선 → 실패 시 PDF glyph. DEV conflict 로그만 병행 계산.
 */

import { pointerToTextIndex } from './pageGeometry.js';
import {
  hitFromSingleIndex,
  layoutIndexFromClientPoint,
} from './textLayerHitFromClient.js';

/**
 * @param {{
 *   pageData: import('../pdfService.js').PageData | null | undefined,
 *   root: Element | null | undefined,
 *   wrap: Element | null | undefined,
 *   itemBoxes: Array<{ left: number, top: number, width: number, height: number, start: number, end: number }> | null | undefined,
 *   clientX: number,
 *   clientY: number,
 *   eventTarget?: EventTarget | null,
 *   localX?: number | null,
 *   localY?: number | null,
 *   page?: import('pdfjs-dist').PDFPageProxy | null,
 *   viewport?: import('pdfjs-dist').PageViewport | null,
 *   isTrusted?: boolean,
 * }} args
 * @returns {import('./types.js').TextHit | null}
 */
export function resolveLayoutPointHit({
  pageData,
  root,
  wrap,
  itemBoxes,
  clientX,
  clientY,
  eventTarget = null,
  localX = null,
  localY = null,
  page = null,
  viewport = null,
  isTrusted = false,
}) {
  if (!pageData) return null;

  // 우선순위 고정: DOM → 실패 시 glyph. conflict 로그용으로만 glyph 병행.
  const domIndex = layoutIndexFromClientPoint({
    root,
    wrap,
    itemBoxes,
    clientX,
    clientY,
    eventTarget,
  });
  let glyphIndex = /** @type {number | null} */ (null);
  if (
    page &&
    viewport &&
    Number.isFinite(localX) &&
    Number.isFinite(localY)
  ) {
    glyphIndex = pointerToTextIndex(
      page,
      viewport,
      pageData,
      /** @type {number} */ (localX),
      /** @type {number} */ (localY),
      itemBoxes,
    );
  }

  let rawIndex = domIndex;
  let hit = hitFromSingleIndex(pageData, rawIndex);
  let source = hit ? 'dom' : '';
  if (!hit && glyphIndex != null) {
    rawIndex = glyphIndex;
    hit = hitFromSingleIndex(pageData, rawIndex);
    if (hit) source = 'glyph';
  }

  if (import.meta.env.DEV) {
    const t = String(pageData.visualText ?? pageData.text ?? '');
    const chAt = (i) => {
      if (!Number.isFinite(i)) return null;
      const c = t[/** @type {number} */ (i)] ?? '';
      return c === ' ' ? '␠' : c;
    };
    const aroundAt = (i) => {
      if (!Number.isFinite(i)) return null;
      const n = /** @type {number} */ (i);
      return t.slice(Math.max(0, n - 4), Math.min(t.length, n + 5));
    };
    console.log('[layout-hit-1-index]', {
      source: hit ? source : null,
      rawIndex: hit ? rawIndex : null,
      rawCh: hit ? chAt(rawIndex) : null,
      around: hit ? aroundAt(rawIndex) : null,
      hitStart: hit?.start ?? null,
      matched: hit?.matchedText ?? null,
      clientX,
      clientY,
      isTrusted: isTrusted === true,
    });
    if (
      Number.isFinite(domIndex) &&
      Number.isFinite(glyphIndex) &&
      domIndex !== glyphIndex
    ) {
      console.log('[layout-hit-conflict]', {
        domIndex,
        domCh: chAt(domIndex),
        domAround: aroundAt(domIndex),
        glyphIndex,
        glyphCh: chAt(glyphIndex),
        glyphAround: aroundAt(glyphIndex),
        chosen: hit ? source : null,
        isTrusted: isTrusted === true,
      });
    }
  }

  return hit;
}
