/** 공백·NBSP를 입력 화면에서 아래 쐐기(˅)로 보이게 함 */

export const SPACE_VISIBLE_CHAR = '\u02C5';

const SPACE_CHARS = /[\u00A0 ]/g;
const VISIBLE_CHAR_RE = /\u02C5/g;

/** @param {string} value */
export function encodeSpacesVisible(value) {
  return String(value ?? '').replace(SPACE_CHARS, SPACE_VISIBLE_CHAR);
}

/** @param {string} display */
export function decodeSpacesVisible(display) {
  return String(display ?? '').replace(VISIBLE_CHAR_RE, ' ');
}
