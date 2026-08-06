/**
 * 표기통일·잡음·버킷이 공유하는 한글 기초 (리프 모듈 — 순환 import 방지).
 */

/** 띄움 variant 각 덩어리 최소 한글 음절 수 */
export const UNIFY_SPACED_PART_MIN_HANGUL = 2;

/**
 * 어절 끝 조사·보조사 (긴 것 우선). 경제왕국/경제왕국의 → 경제왕국.
 * @type {readonly string[]}
 */
export const UNIFY_TRAILING_JOSA = Object.freeze([
  '에서부터',
  '에게서',
  '으로부터',
  '으로서',
  '으로써',
  '에서는',
  '에서도',
  '에서',
  '에도',
  '에게',
  '한테',
  '으로',
  '로서',
  '로써',
  '부터',
  '까지',
  '처럼',
  '만큼',
  '보다',
  '대로',
  '이라고',
  '이라서',
  '이라면',
  '이라도',
  '입니다',
  '입니까',
  '이었다',
  '이나',
  '이란',
  '이라',
  '이기',
  '이다',
  '인지',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '와',
  '과',
  '도',
  '만',
  '나',
  '란',
  '로',
  '요',
  '께',
  '들',
]);

/**
 * @param {string} s
 * @returns {number}
 */
export function hangulSyllableCount(s) {
  const str = String(s ?? '');
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) n += 1;
  }
  return n;
}
