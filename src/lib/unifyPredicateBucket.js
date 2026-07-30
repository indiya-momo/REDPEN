/**
 * 표기 통일 목록 — 단일 항목 중 용언(동사·형용사·보조용언 어간) 추정.
 * SLM 없이 규칙만. 정렬용 버킷 (단일 → @계열 → 용언).
 */

/** 활용형·연결어미로 흔한 끝 음절 (만들어·보여·생각해·싶어) */
const PREDICATE_END_SYLLABLES = new Set([
  '아',
  '어',
  '여',
  '해',
  '혀',
  '켜',
  '펴',
  '워',
  '와',
]);

/**
 * `돌아가`처럼 마지막이 `가`(가다 계열)인 경우 — 2음절 접미.
 * `물가`/`국가` 등 2음절 명사 오탐을 피한다.
 */
const PREDICATE_END_DIGRAPHS = new Set([
  '아가',
  '어가',
  '여가',
  '해가',
  '혀가',
  '워가',
  '와가',
]);

/**
 * 끝 음절이 어미처럼 보여도 명사인 짧은 표기 (오탐 방지).
 * @type {ReadonlySet<string>}
 */
const NOUN_FALSE_POSITIVES = new Set([
  '언어',
  '용어',
  '고유어',
  '외래어',
  '한자어',
  '고유명',
]);

/**
 * @param {string} key
 * @returns {string}
 */
function hangulKey(key) {
  return String(key ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * @param {string} key glued key (공백 없음)
 * @returns {boolean}
 */
export function looksLikePredicateKey(key) {
  const h = hangulKey(key);
  if (h.length < 2) return false;
  if (NOUN_FALSE_POSITIVES.has(h)) return false;
  if (h.length >= 2 && PREDICATE_END_DIGRAPHS.has(h.slice(-2))) return true;
  const last = h.slice(-1);
  return PREDICATE_END_SYLLABLES.has(last);
}

/**
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster} cluster
 * @returns {boolean}
 */
export function isUnifyPredicateCluster(cluster) {
  if (cluster?.auxReview?.status === 'review') return true;
  return looksLikePredicateKey(cluster?.key ?? '');
}
