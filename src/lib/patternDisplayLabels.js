import { encodeSpacesVisible } from './spaceVisibleText.js';

/**
 * 일관성 목록·검사 결과 — 등록 문자열만 (˅ = 공백 위치)
 * @param {string} tailWord
 */
export function formatConsistencyListLabel(tailWord) {
  return encodeSpacesVisible(tailWord.trim());
}

/** @param {string} tail */
export function formatCompoundTailLabel(tail) {
  return formatConsistencyListLabel(tail);
}

/** @param {string} tail */
export function formatCompoundSpacingLabel(tail) {
  return formatConsistencyListLabel(tail);
}
