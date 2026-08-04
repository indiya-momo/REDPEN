/**
 * 띄움 왼쪽 짧은 체언+조사 휴리스틱.
 * source: manual-heuristic — 수확(꼬리 JSON)만으로는 내가·등이 형태를 못 닫음.
 * 관형형(붉은) 오탐 방지를 위해 은/는은 대명사 어간만.
 *
 * discover가 unifyNoiseList.js를 import하면 순환이 나서 분리.
 */
import {
  hangulOnlyNoise,
  UNIFY_NOISE_EXCEPTION_EOJEOLS,
} from './unifyNoiseListData.js';

const SPACED_LEFT_SHORT_JOSA = Object.freeze(
  ['에서', '에게', '으로', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만'].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  ),
);
const SPACED_LEFT_CASE_JOSA = new Set(['이', '가', '을', '를']);
const SPACED_LEFT_TOPIC_JOSA = new Set(['은', '는']);
const SPACED_LEFT_PRONOUN_STEMS = new Set(['나', '너', '저', '그', '이']);

/**
 * @param {string} eojeol
 */
export function isSpacedLeftJosaNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h) return false;
  for (const josa of SPACED_LEFT_SHORT_JOSA) {
    if (!h.endsWith(josa) || h.length <= josa.length) continue;
    const stem = h.slice(0, -josa.length);
    const n = hangulOnlyNoise(stem).length;
    if (n < 1 || n > 2) continue;
    if (UNIFY_NOISE_EXCEPTION_EOJEOLS.has(stem)) return true;
    if (n !== 1) continue;
    if (SPACED_LEFT_CASE_JOSA.has(josa)) return true;
    if (SPACED_LEFT_TOPIC_JOSA.has(josa) && SPACED_LEFT_PRONOUN_STEMS.has(stem)) {
      return true;
    }
  }
  return false;
}
