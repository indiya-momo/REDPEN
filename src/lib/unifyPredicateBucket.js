/**
 * 표기 통일 목록 — 단일 항목 중 용언(동사·형용사·보조용언 어간) 추정.
 * SLM 없이 규칙만. 정렬용 버킷 (단일 → @계열 → 용언).
 */

import { hangulSyllableCount, UNIFY_TRAILING_JOSA } from './unifyCandidateDiscover.js';
import {
  UNIFY_AMBIGUOUS_JOSA_SUFFIXES,
  UNIFY_LOW_RISK_JOSA,
} from './unifyJosaReview.js';

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

/** 조사+용언 분해용 — 긴 조사 우선 */
const JOSA_BEFORE_PREDICATE = Object.freeze(
  [
    ...UNIFY_TRAILING_JOSA,
    ...UNIFY_LOW_RISK_JOSA,
    ...UNIFY_AMBIGUOUS_JOSA_SUFFIXES,
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

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
 * (`오래`←오래다 — 끝이 `래`.
 *  해당 음절 전체 허용은 노래·미래 등 오탐. `개의`는 의존명사+의 — 화이트리스트 금지, 용언 2차 SLM에 위임)
 * @type {ReadonlySet<string>}
 */
const PREDICATE_KNOWN_STEMS = new Set(['오래']);

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

/**
 * 기본형 꼬리 + 흔한 활용·청유 (API 전 안전망).
 * 사전 API가 용언으로 확정하면 opts.stdictPredicateKeys로 추가 제외.
 * @type {ReadonlySet<string>}
 */
const INFLECTED_PREDICATE_TAILS = new Set([
  '보자',
  '봅시다',
  '보게',
  '보겠다',
  '하자',
  '합시다',
  '해라',
  '하자고',
  '보자고',
]);

/**
 * 조사 바로 뒤 꼬리가 용언인지 (규칙 안전망).
 * @param {string} tail
 */
export function isPredicateTailHeuristic(tail) {
  const t = hangulKey(tail);
  if (t.length < 1) return false;
  if (endsWithPredicateDictionaryTail(t)) return true;
  if (INFLECTED_PREDICATE_TAILS.has(t)) return true;
  return looksLikePredicateKey(t);
}

/**
 * `어간(≥2)·조사·용언꼬리` 또는 `조사·용언꼬리` 분해.
 * 긴 조사·긴 꼬리 우선.
 * @param {string} keyOrAffix
 * @param {{
 *   isPredicateTail?: (tail: string) => boolean,
 *   stdictPredicateKeys?: Set<string> | Iterable<string>,
 * }} [opts]
 * @returns {{ stem: string, josa: string, tail: string } | null}
 */
export function parseUnifyJosaPlusPredicate(keyOrAffix, opts = {}) {
  const h = hangulKey(keyOrAffix);
  if (h.length < 3) return null;

  const stdictKeys =
    opts.stdictPredicateKeys instanceof Set
      ? opts.stdictPredicateKeys
      : opts.stdictPredicateKeys
        ? new Set(opts.stdictPredicateKeys)
        : null;

  const isTail =
    typeof opts.isPredicateTail === 'function'
      ? opts.isPredicateTail
      : isPredicateTailHeuristic;

  for (const josa of JOSA_BEFORE_PREDICATE) {
    const maxTail = h.length - josa.length;
    for (let tailLen = maxTail; tailLen >= 1; tailLen--) {
      const tail = h.slice(-tailLen);
      const before = h.slice(0, -tailLen);
      if (!before.endsWith(josa)) continue;
      const stem = before.slice(0, -josa.length);
      if (stem && hangulSyllableCount(stem) < 2) continue;
      // 조사만(@을하다): 기본형·안전망 꼬리만 — 「만+들어」←만들어 오탐 방지
      if (!stem) {
        const bareOk =
          endsWithPredicateDictionaryTail(tail) ||
          INFLECTED_PREDICATE_TAILS.has(hangulKey(tail));
        if (!bareOk && !(stdictKeys && stdictKeys.has(h))) continue;
        return { stem, josa, tail };
      }
      if (!isTail(tail) && !(stdictKeys && stdictKeys.has(h))) continue;
      return { stem, josa, tail };
    }
  }
  return null;
}

/**
 * `@`+조사+용언 — 예: 을하다·역할을하다·금리인상을보자.
 * 용언 꼬리는 규칙 휴리스틱 + (선택) 사전 API 용언 키.
 * @param {string} keyOrAffix
 * @param {{
 *   isPredicateTail?: (tail: string) => boolean,
 *   stdictPredicateKeys?: Set<string> | Iterable<string>,
 * }} [opts]
 * @returns {boolean}
 */
export function isUnifyJosaPlusPredicateKey(keyOrAffix, opts = {}) {
  return parseUnifyJosaPlusPredicate(keyOrAffix, opts) != null;
}

/**
 * 목록 전 구간에서 조사+용언 패턴 제거.
 * `@을하다` 계열·`역할을하다`·`금리인상을보자` 등.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{
 *   isPredicateTail?: (tail: string) => boolean,
 *   stdictPredicateKeys?: Set<string> | Iterable<string>,
 * }} [opts]
 * @returns {import('./unifyCandidateGrouping.js').ClusterGroup[]}
 */
export function dropJosaPlusPredicateFromGroups(groups, opts = {}) {
  if (!groups?.length) return groups;

  const dropKey = (key) => isUnifyJosaPlusPredicateKey(key, opts);

  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const next = [];

  for (const group of groups) {
    if (group.type === 'series') {
      if (dropKey(group.affix)) continue;
      const clusters = group.clusters.filter((c) => !dropKey(c.key));
      if (clusters.length === 0) continue;
      // 계열이 너무 작아지면 단일로 내리지 않고 버림(조사+용언 잔여 방지)
      const conflicts = clusters.filter((c) => c.kind !== 'single-form');
      if (conflicts.length === 0 && clusters.length < 2) continue;
      next.push({ ...group, clusters });
      continue;
    }

    if (group.type === 'single' || group.type === 'predicate') {
      const clusters = group.clusters.filter((c) => !dropKey(c.key));
      if (clusters.length === 0) continue;
      next.push({ ...group, clusters });
      continue;
    }

    next.push(group);
  }

  return next;
}
