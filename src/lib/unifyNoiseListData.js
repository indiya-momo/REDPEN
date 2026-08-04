/**
 * 잡음 리스트 데이터만 — 순환 import 방지용 (discover / unifyExclude).
 * 본보조·조사 휴리스틱은 {@link ./unifyNoiseList.js}.
 */
import noiseListJson from '../data/unify-noise-list.json' with { type: 'json' };

/**
 * @param {string} surface
 */
export function hangulOnlyNoise(surface) {
  return String(surface ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

/**
 * @param {unknown} list
 * @returns {readonly string[]}
 */
function freezeSortedTails(list) {
  const set = new Set(
    (Array.isArray(list) ? list : [])
      .map((s) => hangulOnlyNoise(s))
      .filter((s) => s.length >= 2),
  );
  return Object.freeze(
    [...set].toSorted(
      (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
    ),
  );
}

export const UNIFY_NOISE_EXCEPTION_EOJEOLS = Object.freeze(
  new Set(
    (
      Array.isArray(noiseListJson?.exceptionEojeols)
        ? noiseListJson.exceptionEojeols
        : []
    )
      .map((s) => hangulOnlyNoise(s))
      .filter(Boolean),
  ),
);

/** @deprecated */
export const UNIFY_NOISE_DENY_EOJEOLS = UNIFY_NOISE_EXCEPTION_EOJEOLS;
/** @deprecated */
export const UNIFY_NON_NOUN_COMPOUND_EOJEOLS = UNIFY_NOISE_EXCEPTION_EOJEOLS;

export const UNIFY_NOISE_VERBAL_TAILS = freezeSortedTails(
  noiseListJson?.verbalTails,
);
export const UNIFY_NOISE_COPULA_TAILS = freezeSortedTails(
  noiseListJson?.copulaTails,
);
export const UNIFY_NOISE_HAGO_JC_TAILS = freezeSortedTails(
  noiseListJson?.hagoJcTails,
);

export const UNIFY_NOISE_BON_BOJO_REFS = Object.freeze(
  (
    Array.isArray(noiseListJson?.bonBojoRefs) ? noiseListJson.bonBojoRefs : []
  ).map((id) => String(id)),
);

export const UNIFY_NOISE_TAG_TEMPLATES = Object.freeze(
  (Array.isArray(noiseListJson?.tagTemplates) ? noiseListJson.tagTemplates : []).map(
    (t) =>
      Object.freeze({
        id: String(t.id ?? ''),
        tags: String(t.tags ?? ''),
        filter: String(t.filter ?? ''),
        pass: Number(t.pass) || 0,
      }),
  ),
);

export const UNIFY_NOISE_LIST_META = Object.freeze({
  version: Number(noiseListJson?.version) || 0,
  updatedAt: String(noiseListJson?.updatedAt ?? ''),
  exceptionCount: UNIFY_NOISE_EXCEPTION_EOJEOLS.size,
  verbalTailCount: UNIFY_NOISE_VERBAL_TAILS.length,
  copulaTailCount: UNIFY_NOISE_COPULA_TAILS.length,
  size: UNIFY_NOISE_EXCEPTION_EOJEOLS.size,
});

/**
 * @param {string} stem
 */
function isAllowedStem(stem) {
  const n = hangulOnlyNoise(stem).length;
  // 1음절 용언 어간(들·보) + 연결어미 허용
  if (n >= 1) return true;
  return false;
}

/**
 * @param {string} h
 * @param {readonly string[]} tails
 */
function endsWithAllowedTail(h, tails) {
  for (const tail of tails) {
    if (!h.endsWith(tail)) continue;
    const stem = h.slice(0, -tail.length);
    // 빈 어간 = 꼬리 어절 단독 (결혼 하고자 → 하고자)
    if (!stem || isAllowedStem(stem)) return true;
  }
  return false;
}

/**
 * @param {string} eojeol
 */
export function hasUnifyNoiseDenyEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  return Boolean(h) && UNIFY_NOISE_EXCEPTION_EOJEOLS.has(h);
}

/** 띄움 왼쪽 — 짧은 체언+격조사 (내가·등이). 은/는은 관형형(붉은) 오탐이 커서 대명사만. */
const SPACED_LEFT_SHORT_JOSA = Object.freeze(
  ['에서', '에게', '으로', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만'].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  ),
);
const SPACED_LEFT_CASE_JOSA = new Set(['이', '가', '을', '를']);
const SPACED_LEFT_TOPIC_JOSA = new Set(['은', '는']);
const SPACED_LEFT_PRONOUN_STEMS = new Set(['나', '너', '저', '그', '이']);

/**
 * 띄움 왼쪽 짧은 체언+조사 (내가·등이).
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
    // 내가·등이 — 격조사. 나는 — 대명사+은/는. 붉은(관형)은 제외.
    if (SPACED_LEFT_CASE_JOSA.has(josa)) return true;
    if (SPACED_LEFT_TOPIC_JOSA.has(josa) && SPACED_LEFT_PRONOUN_STEMS.has(stem)) {
      return true;
    }
  }
  return false;
}

/**
 * 예외·수확 꼬리만 (본보조·조사 제외). discover/exclude용.
 * @param {string} eojeol
 */
export function matchesNoiseListMorphTail(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  // 했어(2)·하고자(3) 등 꼬리 단독·붙임키
  if (h.length < 2) return false;
  if (endsWithAllowedTail(h, UNIFY_NOISE_VERBAL_TAILS)) return true;
  if (endsWithAllowedTail(h, UNIFY_NOISE_COPULA_TAILS)) return true;
  if (endsWithAllowedTail(h, UNIFY_NOISE_HAGO_JC_TAILS)) return true;
  // 붙임키 끝의 예외 어절 (가족끼리·결혼직전)
  if (
    h.length >= 3 &&
    endsWithAllowedTail(
      h,
      freezeSortedTails([...UNIFY_NOISE_EXCEPTION_EOJEOLS]),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * 예외 또는 형태소 꼬리 — discover 1차 (순환 없는 경로).
 * @param {string} eojeolOrKey
 */
const noiseRejectCache = new Map();

export function shouldRejectNoiseListDataSurface(eojeolOrKey) {
  const h = hangulOnlyNoise(eojeolOrKey);
  if (!h) return false;
  const cached = noiseRejectCache.get(h);
  if (cached !== undefined) return cached;
  const reject =
    UNIFY_NOISE_EXCEPTION_EOJEOLS.has(h) || matchesNoiseListMorphTail(h);
  noiseRejectCache.set(h, reject);
  return reject;
}
