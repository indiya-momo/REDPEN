/**
 * 띄움 짧은 체언+조사 휴리스틱 (좌우 공통).
 * source: manual-heuristic — 수확(꼬리 JSON)만으로는 내가·등이 형태를 못 닫음.
 * 관형형(붉은) 오탐 방지를 위해 은/는은 대명사 어간만.
 *
 * 처소·여격(에/에서/에게): Kiwi 프로브상 N*+JKB (앞에·곳에서·금융에·캐나다에).
 * 어간 음절 수 제한 없음 — 명사+조사이므로 표기통일 복합 성분 아님.
 * 격조사(이/가/을/를)만 1음절 체언으로 유지.
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
/** 격조사 — 1음절 체언만 (내가·등이) */
const SPACED_LEFT_CASE_JOSA = new Set(['이', '가', '을', '를']);
/** 처소·여격 — Kiwi JKB. 어간 길이 무제한 (캐나다에) */
const SPACED_LEFT_ADVERBIAL_JOSA = new Set(['에', '에서', '에게']);
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
    if (n < 1) continue;
    // 대부분+의 — 예외 어절은 길이 제한 없이
    if (UNIFY_NOISE_EXCEPTION_EOJEOLS.has(stem)) return true;
    // 처소·여격은 음절 수와 무관 (캐나다에 = NNP+JKB)
    if (SPACED_LEFT_ADVERBIAL_JOSA.has(josa)) return true;
    if (n > 2) continue;
    if (SPACED_LEFT_CASE_JOSA.has(josa) && n === 1) return true;
    if (
      SPACED_LEFT_TOPIC_JOSA.has(josa) &&
      n === 1 &&
      SPACED_LEFT_PRONOUN_STEMS.has(stem)
    ) {
      return true;
    }
  }
  return false;
}
