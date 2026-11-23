/**
 * 닫힌 표면 (정규식·사전 게이트 없음).
 * ruleEngine 비부착. 띄어쓰기 폴더 findHits만.
 */

import { shouldKeepDaboMatchInText } from './daboInsideCompoundKeep.js';

export const CLOSED_SPACING_FIXES_CATEGORY = '닫힌 띄어·오자';
export const CLOSED_SPACING_FIXES_LABEL = '닫힌 띄어·오자';
export const CLOSED_SPACING_FIXES_TIP =
  '한글 맞춤법 제2항(단어 띄어쓰기)·오자 교정. 닫힌 표면만.';

const BASE_LITERAL_ROWS = [
  { find: '오래 된', replace: '오래된', kind: 'attach' },
  { find: '다보면', replace: '다 보면', kind: 'split' },
  { find: '무릎위에', replace: '무릎 위에', kind: 'split' },
];

/** Sheet parity for haejil surfaces (equality test). Dual-report risk if folder wires this module. */
export const CLOSED_HAE_JIL_LITERAL_ROWS = Object.freeze([
  // leading Hangul boundary. residual FP: haejida(wear)+rieul
  { find: "해질 무렵", replace: "해 질 무렵", kind: "split", leadingHangulBoundary: true },
  { find: "해질녘", replace: "해 질 녘", kind: "split", leadingHangulBoundary: true },
  { find: "해질무렵", replace: "해 질 무렵", kind: "split", leadingHangulBoundary: true },
]);

/** @type {{ find: string, replace: string, kind: string, leadingHangulBoundary?: boolean }[]} */
const LITERAL_ROWS = [...BASE_LITERAL_ROWS, ...CLOSED_HAE_JIL_LITERAL_ROWS];

/** @param {string} ch */
function isHangulSyllable(ch) {
  return ch.length === 1 && ch >= '\uAC00' && ch <= '\uD7A3';
}

/**
 * `넘어 서` → `넘어서` (연결어미 붙임).
 * 뒤 어절이 `있`으로 시작하면 제외 (담을 넘어 서 있는…).
 * @param {string} text
 * @param {(start: number, end: number) => boolean} overlaps
 * @param {(start: number, end: number, matched: string, suggested: string, kind: string) => void} take
 */
function scanNeomeoSeo(text, overlaps, take) {
  const find = '넘어 서';
  let from = 0;
  while (from < text.length) {
    const idx = text.indexOf(find, from);
    if (idx === -1) break;
    const end = idx + find.length;
    from = end;
    if (overlaps(idx, end)) continue;
    const after = text.slice(end);
    const next = after.match(/^[ \u00A0]*([\uAC00-\uD7A3]+)/);
    if (next && next[1].startsWith('있')) continue;
    take(idx, end, find, '넘어서', 'attach');
  }
}

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findClosedSpacingFixHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  const take = (start, end, matchedText, suggestedText, kind) => {
    if (matchedText === suggestedText) return;
    if (overlaps(start, end)) return;
    occupied.push([start, end]);
    hits.push({ index: start, matchedText, suggestedText, kind });
  };

  const rows = [...LITERAL_ROWS].sort((a, b) => b.find.length - a.find.length);
  for (const row of rows) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(row.find, from);
      if (idx === -1) break;
      const end = idx + row.find.length;
      from = end;
      if (
        (row.find === '다보면' || row.find === '다보니') &&
        shouldKeepDaboMatchInText(text, idx, row.find)
      ) {
        continue;
      }
      if (
        row.leadingHangulBoundary &&
        idx > 0 &&
        isHangulSyllable(text[idx - 1] ?? '')
      ) {
        continue;
      }
      take(idx, end, row.find, row.replace, row.kind);
    }
  }

  scanNeomeoSeo(text, overlaps, take);
  return hits;
}
