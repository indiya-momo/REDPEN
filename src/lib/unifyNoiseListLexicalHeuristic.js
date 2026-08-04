/**
 * 띄움 어절 — 닫힌 접속·부사(-히) 휴리스틱 (좌우 공통).
 * source: manual-heuristic — Kiwi: MAJ/접속·MAG(*히). 생산 패턴 없음 → 닫힌 Set.
 * 구(句)「뿐만 아니라」「다시 말해」는 어절 단위만 (아니라·다시는 예외/별도).
 * 짧은 형태(또·단·즉·그럼…)는 완전 일치만 — 베타 원고 오탐 점검 권장.
 */
import { hangulOnlyNoise } from './unifyNoiseListData.js';

/**
 * 편집기 1차 예외 후보와 동일 계열 — 기능별 닫힌 접속·담화 표지.
 * (완전 일치, 띄움 좌우)
 */
const SPACED_CLOSED_CONJUNCTION_LIST = Object.freeze([
  // 순접·나열
  '그리고',
  '또',
  '또한',
  '아울러',
  '더불어',
  '게다가',
  // 역접·대조
  '그러나',
  '하지만',
  '그렇지만',
  '그런데',
  '반면',
  '반면에',
  '오히려',
  '도리어',
  // 인과
  '그래서',
  '그러므로',
  '따라서',
  '그러니까',
  '그러니',
  '왜냐하면',
  // 조건·가정
  '그러면',
  '그렇다면',
  '그럼',
  // 전환
  '한편',
  '다음으로',
  '아무튼',
  '어쨌든',
  '여하튼',
  '하여튼',
  // 첨가·보충 (「뿐만 아니라」→ 뿐만; 아니라=예외 JSON)
  '더구나',
  '뿐만',
  '특히',
  '다만',
  '단',
  // 요약·결론 (「다시 말해」→ 다시=예외 MAG)
  '결국',
  '요컨대',
  '즉',
  '말하자면',
  // 시간·순서
  '이어서',
  '그다음',
  '이후',
  '먼저',
  '우선',
]);

/** @type {ReadonlySet<string>} */
export const SPACED_CLOSED_CONJUNCTIONS = Object.freeze(
  new Set(SPACED_CLOSED_CONJUNCTION_LIST),
);

/**
 * @param {string} eojeol
 */
export function isSpacedClosedConjunctionNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  return Boolean(h) && SPACED_CLOSED_CONJUNCTIONS.has(h);
}

/**
 * 부사 파생 -히 (꾸준히·신속히·간단히…).
 * 한글 2음절 이상 + 끝음절 히.
 * @param {string} eojeol
 */
export function isSpacedAdverbHiNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;
  return h.endsWith('히');
}
