/**
 * 표기 통일 목록 — 단일 항목 중 용언(동사·형용사·보조용언 어간) 추정.
 * SLM 없이 규칙만. 정렬용 버킷 (단일 → @계열 → 용언).
 */

/** 활용형·연결어미로 흔한 끝 음절 (만들어·보여·생각해·알려·싶어) */
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
  '려', // 알리다→알려, 올리다→올려
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
  '려가',
]);

/**
 * 기본형·보조용언 꼬리 (`@보다`·`@내다`·살펴보다).
 * 긴 것부터 매칭. `다` 일반 종결은 바다 등 명사 오탐이 커서 허용 목록만.
 * (bon-bojo 본용언+보조 계열과 맞춤)
 */
const PREDICATE_DICTIONARY_TAILS = Object.freeze([
  '버리다',
  '보다',
  '내다',
  '가다',
  '오다',
  '두다',
  '놓다',
  '주다',
  '지다',
  '나다',
  '되다',
  '싶다',
  '있다',
  '없다',
  '하다',
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
  '고려',
  '배려',
  '사려',
  '무려',
]);

/**
 * 끝 음절 휴리스틱에 안 잡히지만 용언·부사 어간으로 뒤로 보낼 표기.
 * (`오래`←오래다 — 끝이 `래`; `개의`←개의하다 — 끝이 `의`.
 *  해당 음절 전체 허용은 노래·미래·의미 등 오탐)
 * @type {ReadonlySet<string>}
 */
const PREDICATE_KNOWN_STEMS = new Set(['오래', '개의']);

/**
 * 외래 지명·국명 등 -ia → ~아 표기 (캘리포니아·펜실베니아·아시아).
 * 끝 `아`만 보면 용언 오탐.
 * @type {readonly string[]}
 */
const LOANWORD_IA_TAILS = Object.freeze([
  '니아',
  '리아',
  '시아',
  '피아',
  '티아',
  '미아',
  '비아',
  '디아',
  '지아',
  '키아',
  '히아',
  '디어', // 미디어 등 — 끝은 어이나 동일 계열
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
 * @param {string} h hangul-only
 * @returns {boolean}
 */
function endsWithLoanwordIaTail(h) {
  if (h.length < 3) return false;
  const tail2 = h.slice(-2);
  return LOANWORD_IA_TAILS.includes(tail2);
}

/**
 * @param {string} h hangul-only
 * @returns {boolean}
 */
function endsWithPredicateDictionaryTail(h) {
  for (const tail of PREDICATE_DICTIONARY_TAILS) {
    if (h === tail || h.endsWith(tail)) return true;
  }
  return false;
}

/**
 * @param {string} key glued key (공백 없음)
 * @returns {boolean}
 */
export function looksLikePredicateKey(key) {
  const h = hangulKey(key);
  if (h.length < 2) return false;
  if (NOUN_FALSE_POSITIVES.has(h)) return false;
  if (PREDICATE_KNOWN_STEMS.has(h)) return true;
  if (endsWithPredicateDictionaryTail(h)) return true;
  if (h.length >= 2 && PREDICATE_END_DIGRAPHS.has(h.slice(-2))) return true;
  // 캘리포니아·아시아 등 —ia 외래 지명 (끝 `아`/`어` 오탐 방지)
  if (endsWithLoanwordIaTail(h)) return false;
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
