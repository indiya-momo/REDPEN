/**
 * 출판 고유명사 초안 — Kiwi build 시 `userWords`로 주입.
 * P0에서 `명지`가 명/NNB+지/NNG로 쪼개지는 문제 완화.
 *
 * @type {readonly { word: string, tag: string, score?: number }[]}
 */
export const KIWI_DEFAULT_USER_WORDS = Object.freeze([
  { word: '명지', tag: 'NNP', score: 10 },
  { word: '명지계곡', tag: 'NNP', score: 12 },
  { word: '폴크루그먼', tag: 'NNP', score: 10 },
  { word: '크루그먼', tag: 'NNP', score: 10 },
]);
