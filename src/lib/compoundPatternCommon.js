/** 붙임·띄움 공통 — 앞말 캡처 (공백 아닌 문자 2자 이상) */
export const COMPOUND_PREFIX = String.raw`(\S{2,})`;

/** 공백·NBSP 1칸 이상 */
export const FLEX_SPACE = String.raw`[ \u00A0]+`;

/** @param {string} s */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * tailWord 안 띄어쓰기 — PDF 추출 공백/NBSP 허용
 * @param {string} tailWord
 */
export function tailRegexFragment(tailWord) {
  const parts = tailWord.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.map(escapeRegex).join(FLEX_SPACE);
}
