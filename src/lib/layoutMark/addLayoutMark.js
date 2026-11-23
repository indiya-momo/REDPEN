/**
 * LayoutMark 추가·삭제.
 */

import {
  LAYOUT_MARK_KINDS_PHASE1,
  LAYOUT_MARK_SOURCE,
} from './layoutMarkTypes.js';
import { resolveAnchorEojeol } from './layoutMarkReplace.js';

/**
 * @param {string} kind
 */
export function isPhase1LayoutKind(kind) {
  return LAYOUT_MARK_KINDS_PHASE1.includes(
    /** @type {import('./layoutMarkTypes.js').LayoutMarkKind} */ (kind),
  );
}

/**
 * @param {import('./layoutMarkTypes.js').LayoutMark[] | null | undefined} marks
 * @param {{
 *   pageNum: number,
 *   index: number,
 *   kind: import('./layoutMarkTypes.js').LayoutMarkKind,
 *   tip?: string,
 * }} input
 * @param {{ text?: string } | null | undefined} page
 * @returns {import('./layoutMarkTypes.js').LayoutMark[] | null} null이면 추가 불가
 */
export function appendLayoutMark(marks, input, page) {
  if (!isPhase1LayoutKind(input?.kind)) return null;
  const pageNum = Number(input.pageNum);
  if (!Number.isFinite(pageNum)) return null;
  const text = String(page?.text ?? '');
  const hit = resolveAnchorEojeol(text, input.index, input.kind);
  if (!hit) return null;
  const before = text.slice(Math.max(0, hit.start - 8), hit.start);
  const after = hit.w;
  /** @type {import('./layoutMarkTypes.js').LayoutMark} */
  const row = {
    id: `lm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pageNum,
    index: hit.start,
    kind: input.kind,
    tip: input.tip ? String(input.tip) : undefined,
    before,
    after,
    source: LAYOUT_MARK_SOURCE,
  };
  return [...(marks ?? []), row];
}

/**
 * @param {import('./layoutMarkTypes.js').LayoutMark[] | null | undefined} marks
 * @param {string} id
 */
export function removeLayoutMarkById(marks, id) {
  const q = String(id ?? '');
  if (!q) return marks ?? [];
  return (marks ?? []).filter((m) => m.id !== q);
}
