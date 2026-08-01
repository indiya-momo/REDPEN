/** 공백·NBSP·PDF 깨진 글리프(U+FFFD)를 입력·결과 화면에서 아래 쐐기(˅)로 보이게 함 */

export const SPACE_VISIBLE_CHAR = '\u02C5';

/** PDF ToUnicode 실패 등으로 공백 자리에 들어오는 치환 문자 */
const PDF_REPLACEMENT_CHAR = '\uFFFD';

const SPACE_CHARS = /[\u00A0 ]/g;
const VISIBLE_CHAR_RE = /\u02C5/g;

/**
 * PDF 조각 문자열 — � 은 길이 1→1 공백으로 (itemRefs 오프셋 유지).
 * @param {string} value
 */
export function sanitizePdfTextFragment(value) {
  return String(value ?? '').replaceAll(PDF_REPLACEMENT_CHAR, ' ');
}

/** @param {string} value */
export function encodeSpacesVisible(value) {
  return sanitizePdfTextFragment(value).replace(SPACE_CHARS, SPACE_VISIBLE_CHAR);
}

/** @param {string} display */
export function decodeSpacesVisible(display) {
  return String(display ?? '').replace(VISIBLE_CHAR_RE, ' ');
}
