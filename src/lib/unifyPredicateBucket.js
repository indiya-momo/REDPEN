/**
 * 표기 통일 목록 — 단일 항목 중 용언(동사·형용사·보조용언 어간) 추정.
 * SLM 없이 규칙만. 정렬용 버킷 (단일 → @계열 → 용언).
 */

import { hangulSyllableCount, UNIFY_TRAILING_JOSA } from './unifyCandidateDiscover.js';
import {
  UNIFY_AMBIGUOUS_JOSA_SUFFIXES,
  UNIFY_LOW_RISK_JOSA,
} from './unifyJosaReview.js';

/** 활용형·연결어미로 흔한 끝 음절 (만들어·보여·생각해·알려·싶어·빠져) */
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
  '져', // 빠지다→빠져, 깨지다→깨져
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
  '져가',
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
 * 끝 음절 휴리스틱에 안 잡히지만 용언 어간으로 뒤로 보낼 표기.
 * (`보자`·`나가` — 청유·보조 활용형. 해당 음절 전체 허용은 명사 오탐.
 *  `개의`는 의존명사+의 — 화이트리스트 금지, 용언 2차 SLM에 위임)
 * `오래`는 넣지 않음 — 부사 MAG는 잡음 예외, `오래다`는 형용사(VA)라
 * 띄어쓰기 용언 시드·PREDICATE 화이트리스트 대상이 아님.
 * @type {ReadonlySet<string>}
 */
const PREDICATE_KNOWN_STEMS = new Set(['보자', '나가']);

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
 * 의존명사·대용 1음절 — 조사·이다 활용 잡음 어간으로 허용 (것/곳/글…).
 * 일반 1음절 명사(집·말)는 넣지 않음.
 * @type {ReadonlySet<string>}
 */
const SHORT_DEPENDENT_NOUN_STEMS = Object.freeze(
  new Set(['것', '곳', '글', '수', '줄', '데', '바', '때', '중', '듯', '양', '체', '지']),
);

/**
 * @param {string} stem
 * @returns {boolean}
 */
function isAllowedNoiseStem(stem) {
  const n = hangulSyllableCount(stem);
  if (n >= 2) return true;
  return n === 1 && SHORT_DEPENDENT_NOUN_STEMS.has(stem);
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
  if (isUnifyHadaConjugationKey(h)) return true;
  if (isUnifyIdaConjugationKey(h)) return true;
  if (h.length >= 2 && PREDICATE_END_DIGRAPHS.has(h.slice(-2))) return true;
  // 캘리포니아·아시아 등 —ia 외래 지명 (끝 `아`/`어` 오탐 방지)
  if (endsWithLoanwordIaTail(h)) return false;
  const last = h.slice(-1);
  return PREDICATE_END_SYLLABLES.has(last);
}

/**
 * 연결·종결 어미가 붙은 활용형 — 알아내고·알아듣지·알아차리지.
 * 시트에 없어도 「용언 추정」 표시용. 긴 어미 우선.
 * @type {readonly string[]}
 */
const PREDICATE_CONNECTIVE_ECS = Object.freeze(
  [
    '으면서',
    '으면',
    '아서',
    '어서',
    '여서',
    '고서',
    '지만',
    '으며',
    '면서',
    '고',
    '지',
    '며',
    '면',
    '니',
    '냐',
    '네',
    '세',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/**
 * 어간에 자주 오는 용언 줄기 끝 (EC 앞) — 내·듣·리·하 등.
 * @type {ReadonlySet<string>}
 */
const PREDICATE_STEM_END_SYLLABLES = Object.freeze(
  new Set([
    ...PREDICATE_END_SYLLABLES,
    '하',
    '내',
    '듣',
    '리',
    '키',
    '기',
    '지',
    '추',
    '우',
    '이',
  ]),
);

/**
 * @param {string} stem
 * @returns {boolean}
 */
function stemLooksLikeVerbBeforeEc(stem) {
  const s = hangulKey(stem);
  if (s.length < 2) return false;
  if (looksLikePredicateKey(s)) return true;
  const lemma = `${s}다`;
  if (endsWithPredicateDictionaryTail(lemma)) return true;
  if (isUnifyHadaConjugationKey(lemma)) return true;
  // 알아듣다·알아차리다 등 사전 꼬리에 없는 복합 동사 어간
  if (s.length >= 3 && PREDICATE_STEM_END_SYLLABLES.has(s.slice(-1))) {
    return true;
  }
  return false;
}

/**
 * 활용형까지 포함한 용언 추정 (표기통일 배지·용언 구간).
 * @param {string} key
 * @returns {boolean}
 */
export function looksLikeInflectedPredicateKey(key) {
  const h = hangulKey(key);
  if (h.length < 3) return looksLikePredicateKey(h);
  if (looksLikePredicateKey(h)) return true;
  for (const ec of PREDICATE_CONNECTIVE_ECS) {
    if (!h.endsWith(ec)) continue;
    if (h.length <= ec.length + 1) continue;
    const stem = h.slice(0, -ec.length);
    if (stemLooksLikeVerbBeforeEc(stem)) return true;
  }
  return false;
}

/**
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster} cluster
 * @returns {boolean}
 */
function clusterLooksLikeInflectedPredicate(cluster) {
  const key = cluster?.key ?? '';
  if (looksLikeInflectedPredicateKey(key)) return true;
  for (const v of cluster?.variants ?? []) {
    if (looksLikeInflectedPredicateKey(String(v).replace(/\s+/g, ''))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster} cluster
 * @returns {boolean}
 */
export function isUnifyPredicateCluster(cluster) {
  if (cluster?.auxReview?.status === 'review') return true;
  if (cluster?.predicateReview?.status === 'needs_review') return true;
  return clusterLooksLikeInflectedPredicate(cluster);
}

/**
 * 본+보조가 아닌 용언 활용에 「용언 추정, 검토 필요」.
 * SLM이 이미 붙인 predicateReview는 유지. auxReview가 있으면 안 붙임(본+보조 문구 우선).
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]}
 */
export function attachPredicateReviewHints(clusters) {
  if (!clusters?.length) return clusters;
  return clusters.map((cluster) => {
    if (cluster?.auxReview?.status === 'review') return cluster;
    if (cluster?.predicateReview?.status === 'needs_review') return cluster;
    if (!clusterLooksLikeInflectedPredicate(cluster)) return cluster;
    return {
      ...cluster,
      predicateReview: {
        status: /** @type {const} */ ('needs_review'),
        source: 'heuristic',
      },
    };
  });
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
 * 명사+하다 활용·명령·연결 — 표기통일 띄어쓰기 후보에서 제외.
 * 긴 것부터 매칭. 어간 한글 2음절+ 일 때만 (북한·전함 등 단음절 어간 명사 보호).
 * @type {readonly string[]}
 */
const HADA_CONJUGATION_TAILS = Object.freeze(
  [
    '하였습니다',
    '하겠습니다',
    '했습니다',
    '합니다',
    '합니까',
    '하였다가',
    '하였으나',
    '하였으니',
    '하였을',
    '하였다',
    '하였던',
    '하였',
    '합시다',
    '하자고',
    '하도록',
    '한다면',
    '하려면',
    '하므로',
    '함으로',
    '함과',
    '함이',
    '함을',
    '하자',
    '하라',
    '하여',
    '해라',
    '한다',
    '했다',
    '했던',
    '하면',
    '하니',
    '하고',
    '해서',
    '할지',
    '할',
    '함',
    '해',
    '하다',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/**
 * 명사 어간(≥2음절, 또는 의존명사 1음절)+하다 활용형인가.
 * 예: 기록하라·기록하여·기록하였던·기록해라·기록하다
 * @param {string} key
 * @returns {boolean}
 */
export function isUnifyHadaConjugationKey(key) {
  const h = hangulKey(key);
  if (h.length < 3) return false;
  for (const tail of HADA_CONJUGATION_TAILS) {
    if (!h.endsWith(tail)) continue;
    const stem = h.slice(0, -tail.length);
    if (isAllowedNoiseStem(stem)) return true;
  }
  return false;
}

/**
 * 명사+이다 활용 — 표기통일 띄어쓰기 후보에서 제외.
 * `인`/`일` 단음절은 한국인·내일 등 오탐이 커서 넣지 않음.
 * @type {readonly string[]}
 */
const IDA_CONJUGATION_TAILS = Object.freeze(
  [
    '이었던',
    '이었다가',
    '이었으나',
    '이었으니',
    '이었을',
    '이었다',
    '이었',
    '였던',
    '였다가',
    '였으나',
    '였으니',
    '였을',
    '였다',
    '이라고',
    '이라는',
    '이라니',
    '이라도',
    '이라서',
    '이라면',
    '이라',
    '이면서',
    '이지만',
    '이며',
    '이고',
    '이면',
    '이니',
    '인데',
    '인지',
    '인가',
    '임을',
    '임이',
    '임과',
    '임으로',
    '이다',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/**
 * 명사 어간(≥2음절, 또는 의존명사 1음절)+이다 활용형인가.
 * 예: 과학자였던·교사였다·학생이다·것이고
 * @param {string} key
 * @returns {boolean}
 */
export function isUnifyIdaConjugationKey(key) {
  const h = hangulKey(key);
  if (h.length < 3) return false;
  for (const tail of IDA_CONJUGATION_TAILS) {
    if (!h.endsWith(tail)) continue;
    const stem = h.slice(0, -tail.length);
    if (isAllowedNoiseStem(stem)) return true;
  }
  return false;
}

/**
 * 하다/이다 활용형 뒤에 명사가 붙은 글루 키 — 가정하고공무원·것이고공무원.
 * @param {string} key
 * @returns {boolean}
 */
export function isUnifyConjugationPlusNounKey(key) {
  const h = hangulKey(key);
  if (h.length < 5) return false;
  for (let split = 3; split <= h.length - 2; split += 1) {
    const left = h.slice(0, split);
    const right = h.slice(split);
    if (!isNounTailHeuristic(right)) continue;
    if (isUnifyHadaConjugationKey(left) || isUnifyIdaConjugationKey(left)) {
      return true;
    }
  }
  return false;
}

/**
 * 조사 바로 뒤 꼬리가 용언인지 (규칙 안전망).
 * @param {string} tail
 */
export function isPredicateTailHeuristic(tail) {
  const t = hangulKey(tail);
  if (t.length < 1) return false;
  if (endsWithPredicateDictionaryTail(t)) return true;
  if (INFLECTED_PREDICATE_TAILS.has(t)) return true;
  if (isUnifyHadaConjugationKey(t) || HADA_CONJUGATION_TAILS.some((x) => t === x)) {
    return true;
  }
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
 * 조사 바로 뒤가 명사 꼬리인지 (용언 꼬리 제외, 한글 2음절+).
 * @param {string} tail
 */
export function isNounTailHeuristic(tail) {
  const t = hangulKey(tail);
  if (hangulSyllableCount(t) < 2) return false;
  if (isPredicateTailHeuristic(t)) return false;
  return true;
}

/**
 * `명사+조사` 계열 affix용 — 끝이 격조사·보조사인 경우.
 * 키 전체에 쓸 때는 이/가 등 어휘 끝음절 오탐이 커서 STRICT만 쓴다.
 * @type {readonly string[]}
 */
const NOUN_PLUS_JOSA_ENDINGS_STRICT = Object.freeze(
  [
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
    '대로',
    '을',
    '를',
    '은',
    '는',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/** 계열 affix(`경제가@`)용 — 이/가 등 포함 */
const NOUN_PLUS_JOSA_ENDINGS_AFFIX = Object.freeze(
  [
    ...NOUN_PLUS_JOSA_ENDINGS_STRICT,
    '이',
    '가',
    '의',
    '에',
    '와',
    '과',
    '도',
    '만',
    '로',
    '께',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/** `@`+조사+명사(어간 없음) — 명사 첫음절과 겹치는 이/가 등은 제외 */
const BARE_JOSA_PLUS_NOUN = new Set([
  '을',
  '를',
  '은',
  '는',
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
  '대로',
  '에서부터',
  '에게서',
  '으로부터',
  '으로서',
  '으로써',
  '에서는',
  '에서도',
]);

/**
 * `@`+조사+명사 — 예: 을시장·가치를평가.
 * @param {string} keyOrAffix
 * @returns {{ stem: string, josa: string, tail: string } | null}
 */
export function parseUnifyJosaPlusNoun(keyOrAffix) {
  const h = hangulKey(keyOrAffix);
  if (h.length < 3) return null;

  for (const josa of JOSA_BEFORE_PREDICATE) {
    const maxTail = h.length - josa.length;
    for (let tailLen = maxTail; tailLen >= 2; tailLen--) {
      const tail = h.slice(-tailLen);
      const before = h.slice(0, -tailLen);
      if (!before.endsWith(josa)) continue;
      const stem = before.slice(0, -josa.length);
      if (stem && !isAllowedNoiseStem(stem)) continue;
      if (!isNounTailHeuristic(tail)) continue;
      // @을시장 — 가/이로 시작하는 명사(가치·이상) 오탐 방지
      if (!stem && !BARE_JOSA_PLUS_NOUN.has(josa)) continue;
      return { stem, josa, tail };
    }
  }
  return null;
}

/**
 * 명사+조사(+끝) — 계열 `시장을@`·`경제가@` 등.
 * @param {string} keyOrAffix
 * @param {{ asSeriesAffix?: boolean }} [opts]
 * @returns {{ stem: string, josa: string } | null}
 */
export function parseUnifyNounPlusJosa(keyOrAffix, opts = {}) {
  const h = hangulKey(keyOrAffix);
  if (h.length < 3) return null;
  const endings = opts.asSeriesAffix
    ? NOUN_PLUS_JOSA_ENDINGS_AFFIX
    : NOUN_PLUS_JOSA_ENDINGS_STRICT;
  for (const josa of endings) {
    if (!h.endsWith(josa) || h.length <= josa.length) continue;
    const stem = h.slice(0, -josa.length);
    if (hangulSyllableCount(stem) < 2) continue;
    if (isPredicateTailHeuristic(stem)) continue;
    return { stem, josa };
  }
  return null;
}

/**
 * `@`+조사+명사 또는 어간+조사+명사.
 * @param {string} keyOrAffix
 */
export function isUnifyJosaPlusNounKey(keyOrAffix) {
  return parseUnifyJosaPlusNoun(keyOrAffix) != null;
}

/**
 * 명사+조사 — `시장을@` 형태.
 * @param {string} keyOrAffix
 * @param {{ asSeriesAffix?: boolean }} [opts]
 */
export function isUnifyNounPlusJosaKey(keyOrAffix, opts = {}) {
  return parseUnifyNounPlusJosa(keyOrAffix, opts) != null;
}

/**
 * 조사 끼인 띄움 잡음 — 용언·명사 패턴 모두.
 * @param {string} keyOrAffix
 * @param {{
 *   isPredicateTail?: (tail: string) => boolean,
 *   stdictPredicateKeys?: Set<string> | Iterable<string>,
 *   asSeriesAffix?: boolean,
 * }} [opts]
 */
export function isUnifyJosaGluedNoiseKey(keyOrAffix, opts = {}) {
  if (isUnifyHadaConjugationKey(keyOrAffix)) return true;
  if (isUnifyIdaConjugationKey(keyOrAffix)) return true;
  if (isUnifyConjugationPlusNounKey(keyOrAffix)) return true;
  if (isUnifyJosaPlusPredicateKey(keyOrAffix, opts)) return true;
  if (isUnifyJosaPlusNounKey(keyOrAffix)) return true;
  if (isUnifyNounPlusJosaKey(keyOrAffix, opts)) return true;
  return false;
}

/**
 * 목록 전 구간에서 조사+용언·조사+명사·명사+조사 패턴 제거.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{
 *   isPredicateTail?: (tail: string) => boolean,
 *   stdictPredicateKeys?: Set<string> | Iterable<string>,
 * }} [opts]
 * @returns {import('./unifyCandidateGrouping.js').ClusterGroup[]}
 */
export function dropJosaPlusPredicateFromGroups(groups, opts = {}) {
  if (!groups?.length) return groups;

  const dropKey = (key) => isUnifyJosaGluedNoiseKey(key, opts);

  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const next = [];

  for (const group of groups) {
    if (group.type === 'series') {
      if (dropKey(group.affix)) continue;
      const clusters = group.clusters.filter((c) => !dropKey(c.key));
      if (clusters.length === 0) continue;
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
