import { searchManuscriptText } from './manuscriptTextIndex.js';

/**
 * 검색 유스케이스 — 질의 한 줄.
 * @param {import('../pdfService.js').PageData[]} pageTexts
 * @param {string} query
 * @param {{ maxHits?: number }} [opts]
 * @returns {import('./types.js').TextHit[]}
 */
export function searchManuscript(pageTexts, query, opts) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  return searchManuscriptText(pageTexts, q, opts);
}
