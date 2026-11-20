import { selectionToRange } from './pageGeometry.js';

/**
 * 텍스트 레이어 선택 → TextHit.
 * @param {import('../pdfService.js').PageData | null | undefined} pageData
 * @param {import('./types.js').TextLayerSelection | null | undefined} sel
 * @returns {import('./types.js').TextHit | null}
 */
export function resolveTextSelection(pageData, sel) {
  return selectionToRange(pageData, sel);
}
