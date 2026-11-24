/**
 * LayoutMark → 인디자인 Replace found/replacement.
 * 스펙: 2026-11-23-layout-mark-symbols-design.md §2 · §5.1
 */

import {
  LAYOUT_INDENT_SPACE,
  LAYOUT_MARK_SOURCE,
} from './layoutMarkTypes.js';

/** 시작 어절: 한글 음절·영숫자 연속 */
const WORD_CHAR = /[\uAC00-\uD7A3A-Za-z0-9]/;

/**
 * @param {string} ch
 */
function isWordChar(ch) {
  return Boolean(ch && WORD_CHAR.test(ch));
}

/**
 * `index`에서 시작 어절 W와 구간 [start, end).
 * @param {string} pageText
 * @param {number} index
 * @returns {{ w: string, start: number, end: number } | null}
 */
export function extractStartEojeol(pageText, index) {
  const text = String(pageText ?? '');
  if (!text) return null;
  let i = Math.max(0, Math.min(Number(index) || 0, text.length));
  while (i < text.length && !isWordChar(text[i] ?? '')) i += 1;
  if (i >= text.length) return null;
  let start = i;
  while (start > 0 && isWordChar(text[start - 1] ?? '')) start -= 1;
  let end = i + 1;
  while (end < text.length && isWordChar(text[end] ?? '')) end += 1;
  const w = text.slice(start, end);
  if (!w) return null;
  return { w, start, end };
}

/**
 * 클릭 위치 → 그 줄의 첫 글자 인덱스 (들여·줄 머리용).
 * @param {string} pageText
 * @param {number} index
 */
export function lineStartIndex(pageText, index) {
  const text = String(pageText ?? '');
  let i = Math.max(0, Math.min(Number(index) || 0, text.length));
  while (i > 0 && text[i - 1] !== '\n') i -= 1;
  return i;
}

/**
 * 들여·행갈이·내어는 **그 줄의 첫 어절**만. 중간 어절이면 null (줄 머리로 스냅하지 않음).
 * 줄바꿈(paraSplit)은 줄 어디 어절이든 가능.
 * @param {string} pageText
 * @param {number} index
 * @param {import('./layoutMarkTypes.js').LayoutMarkKind} kind
 */
export function resolveAnchorEojeol(pageText, index, kind) {
  const hit = extractStartEojeol(pageText, Number(index) || 0);
  if (!hit) return null;
  if (kind === 'indent' || kind === 'outdent' || kind === 'paraGap') {
    const first = extractStartEojeol(pageText, lineStartIndex(pageText, hit.start));
    if (!first || first.start !== hit.start) return null;
  }
  return hit;
}

/**
 * 단일 kind → replacement (합성 전).
 * @param {import('./layoutMarkTypes.js').LayoutMarkKind} kind
 * @param {string} w
 */
export function replacementForKind(kind, w) {
  const W = String(w ?? '');
  if (!W) return '';
  if (kind === 'paraSplit') return `\n${W}`;
  if (kind === 'paraGap') return `\n\n${W}`;
  if (kind === 'indent') return `${LAYOUT_INDENT_SPACE}${W}`;
  return '';
}

/**
 * @param {import('./layoutMarkTypes.js').LayoutMark} mark
 * @param {string} [pageText] — after가 없으면 여기서 W 추출
 * @returns {{ found: string, replacement: string, start: number, end: number } | null}
 */
export function layoutMarkToReplacePayload(mark, pageText = '') {
  if (!mark || mark.source !== LAYOUT_MARK_SOURCE) return null;
  if (mark.kind === 'outdent') return null;
  let w = String(mark.after ?? '').trim();
  let start = Number(mark.index) || 0;
  let end = start + w.length;
  if (!w && pageText) {
    const hit = resolveAnchorEojeol(pageText, mark.index, mark.kind);
    if (!hit) return null;
    w = hit.w;
    start = hit.start;
    end = hit.end;
  }
  if (!w) return null;
  const replacement = replacementForKind(mark.kind, w);
  if (!replacement) return null;
  return { found: w, replacement, start, end };
}

/**
 * 같은 페이지·같은 found 구간의 기호를 한 Replace로 합성.
 * 개행: paraGap > paraSplit. 들여: indent면 전각 1자.
 * @param {import('./layoutMarkTypes.js').LayoutMark[]} marks
 * @param {string} pageText
 * @returns {{ found: string, replacement: string, start: number, end: number, pageNum: number, kinds: import('./layoutMarkTypes.js').LayoutMarkKind[] }[]}
 */
export function composeAllLayoutMarkReplaces(marks, pageText) {
  const list = (marks ?? []).filter(
    (m) => m && m.kind !== 'outdent' && m.source === LAYOUT_MARK_SOURCE,
  );
  /** @type {Map<string, { pageNum: number, start: number, end: number, w: string, kinds: Set<string> }>} */
  const byKey = new Map();

  for (const m of list) {
    const hit = resolveAnchorEojeol(pageText, m.index, m.kind);
    if (!hit) continue;
    const pageNum = Number(m.pageNum);
    const key = `${pageNum}:${hit.start}:${hit.end}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        pageNum,
        start: hit.start,
        end: hit.end,
        w: hit.w,
        kinds: new Set(),
      };
      byKey.set(key, g);
    }
    g.kinds.add(m.kind);
  }

  /** @type {{ found: string, replacement: string, start: number, end: number, pageNum: number, kinds: import('./layoutMarkTypes.js').LayoutMarkKind[] }[]} */
  const out = [];
  for (const g of byKey.values()) {
    const hasGap = g.kinds.has('paraGap');
    const hasSplit = g.kinds.has('paraSplit');
    const hasIndent = g.kinds.has('indent');
    let prefix = '';
    if (hasGap) prefix = '\n\n';
    else if (hasSplit) prefix = '\n';
    const indent = hasIndent ? LAYOUT_INDENT_SPACE : '';
    const replacement = `${prefix}${indent}${g.w}`;
    if (replacement === g.w) continue;
    /** @type {import('./layoutMarkTypes.js').LayoutMarkKind[]} */
    const kinds = [];
    if (hasGap) kinds.push('paraGap');
    else if (hasSplit) kinds.push('paraSplit');
    if (hasIndent) kinds.push('indent');
    out.push({
      found: g.w,
      replacement,
      start: g.start,
      end: g.end,
      pageNum: g.pageNum,
      kinds,
    });
  }
  return out;
}
