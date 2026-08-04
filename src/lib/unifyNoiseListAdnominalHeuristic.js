/**
 * 띄움 왼쪽 용언 관형형 휴리스틱.
 * source: manual-heuristic — 무한 어간 × 닫힌 관형 어미(는/던/은).
 * harvest로 어간을 다 넣을 수 없고, Kiwi 2차 ready 전 fail-open 창을 메운다.
 *
 * `은`도 관형형(붉은·않은·높은) — 명사 아님 → 후보에서 DROP.
 * 조사 오탐(`붉`+`은`) 가드는 {@link ./unifyNoiseListLeftHeuristic.js}가 별도로 담당.
 * `가진`·`만한`(종성 ㄴ만)은 시민·북한과 겹쳐 여기 밖 → Kiwi 2차.
 */
import { hangulOnlyNoise } from './unifyNoiseListData.js';

/** 긴 것 우선 */
const ADNOMINAL_TAILS = Object.freeze(['던', '는', '은']);

/**
 * @param {string} eojeol
 * @returns {boolean}
 */
export function isSpacedLeftAdnominalNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;

  for (const tail of ADNOMINAL_TAILS) {
    if (!h.endsWith(tail)) continue;
    const stem = h.slice(0, -tail.length);
    if (stem.length >= 1) return true;
  }

  return false;
}
