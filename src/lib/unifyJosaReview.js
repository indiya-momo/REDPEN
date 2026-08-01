/**
 * 표기 통일 — 조사·어간 접미 「검토」 후보.
 * 자동 merge 없음. 확정 병합(흡수·LCP)과 직교.
 *
 * - 저위험 조사(에서·으로…) + 고위험 단음절 조사(은/는/이/가…) + 어간 접미「적」
 * - 띄움에서 조사가 단독 어절인 경우(역학 은)도 어간으로 묶음
 */

import {
  hangulSyllableCount,
  UNIFY_SPACED_PART_MIN_HANGUL,
} from './unifyCandidateDiscover.js';
import { isUnifyKiwiJosaEnabled } from './featureFlags.js';
import { stripTrailingJosaKiwi } from './kiwiMorph/stripTrailingJosa.js';
import { isKiwiReady } from './kiwiMorph/runtime.js';

/**
 * 다다음절·저위험 조사(결합형 통째 명시).
 * @type {readonly string[]}
 */
export const UNIFY_LOW_RISK_JOSA = Object.freeze(
  [
    '에서부터',
    '으로부터',
    '에게서',
    '으로서',
    '으로써',
    '에서는',
    '에서도',
    '으로는',
    '으로도',
    '로부터',
    '로서',
    '로써',
    '보다는',
    '에서',
    '으로',
    '부터',
    '까지',
    '에게',
    '보다',
    '처럼',
    '만큼',
    '밖에',
    '가량',
    '커녕',
    '투성이',
    '가지',
    '정도',
    '같이',
    '이나',
    '이다',
    '라고도',
    '인지',
    '사이',
    '같은',
    '역시',
    '또한',
    '대비',
    '에도',
    '이외',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/**
 * 애매한 단음절 조사 접미 — 자동 merge 금지, tier `risky`·SLM 후보.
 * (`tier: 'high'`·`UNIFY_JOSA_HIGH_CONFIDENCE_SUFFIXES`와 혼동 금지.)
 * @type {readonly string[]}
 */
export const UNIFY_AMBIGUOUS_JOSA_SUFFIXES = Object.freeze([
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '도',
  '만',
  '쯤',
  '뿐',
  '에',
  '안',
  '밖',
  '와',
  '과',
  '들',
  '인',
  '나',
  '다',
  '로',
  '별',
  '으',
  '질',
  '한',
  '면',
  '야',
  '준',
  '외',
]);

/**
 * 조사가 아닌 어간·접미(역학적 → 역학, 되다·하다·주다 활용형 등). 검토 추정에만 사용.
 * @type {readonly string[]}
 */
export const UNIFY_REVIEW_STEM_AFFIXES = Object.freeze([
  '적으로',
  '되므로',
  '되어',
  '되며',
  '되지',
  '되었',
  '된다',
  '됨',
  '됐',
  '된',
  '하기가',
  '하도록',
  '하며',
  '하는',
  '하고',
  '해서',
  '하다',
  '하지',
  '해도',
  '할',
  '하',
  '해',
  '적이고',
  '이며',
  '주려는',
  '주는',
  '주던',
  '는지',
  '또는',
  '라고',
  '게',
  '서',
  '적',
  '성',
]);

/**
 * 검토 어간 추정용 접미 전체 — 항상 길이 내림차순.
 * @type {readonly string[]}
 */
export const UNIFY_REVIEW_STEM_SUFFIXES = Object.freeze(
  [
    ...UNIFY_LOW_RISK_JOSA,
    ...UNIFY_AMBIGUOUS_JOSA_SUFFIXES,
    ...UNIFY_REVIEW_STEM_AFFIXES,
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/**
 * 표기 통일 **목록에서 제외** — 조사·어간 접미로 추정되는 띄움/붙임 충돌 전부.
 * 짧은 조사·어미뿐 아니라 `에서는`·`으로`·`하도록`·`적이고` 등 긴 결합형도 포함.
 * @type {readonly string[]}
 */
export const UNIFY_LIST_DROP_MONO_JOSA = UNIFY_REVIEW_STEM_SUFFIXES;

const UNIFY_LIST_DROP_MONO_JOSA_SET = new Set(UNIFY_LIST_DROP_MONO_JOSA);

/**
 * SLM 우회·규칙만으로 배지 (unify-josa-review-slm-sketch.md §10.2).
 * @type {ReadonlySet<string>}
 */
export const UNIFY_JOSA_HIGH_CONFIDENCE_SUFFIXES = new Set([
  '이며',
  '하도록',
  '적이고',
]);

/** @type {ReadonlySet<string>} */
const UNIFY_LOW_RISK_JOSA_SET = new Set(UNIFY_LOW_RISK_JOSA);

/**
 * @param {string | undefined} suffix
 * @param {{ stemMismatch?: boolean }} [opts]
 * @returns {'high' | 'low' | 'risky'}
 */
export function classifyJosaReviewTier(suffix, { stemMismatch = false } = {}) {
  if (stemMismatch) return 'risky';
  const s = String(suffix ?? '').trim();
  if (!s) return 'risky';
  if (UNIFY_JOSA_HIGH_CONFIDENCE_SUFFIXES.has(s)) return 'high';
  if (UNIFY_LOW_RISK_JOSA_SET.has(s)) return 'low';
  return 'risky';
}

/**
 * @param {string} lastEojeol
 * @returns {{ stemLast: string, suffix: string, bare: boolean } | null}
 */
export function matchLongestReviewStemSuffix(lastEojeol) {
  const last = String(lastEojeol ?? '');
  if (!last) return null;

  for (const suffix of UNIFY_REVIEW_STEM_SUFFIXES) {
    if (last === suffix) {
      return { stemLast: '', suffix, bare: true };
    }
  }

  for (const suffix of UNIFY_REVIEW_STEM_SUFFIXES) {
    if (!last.endsWith(suffix) || last.length <= suffix.length) continue;
    const stemLast = last.slice(0, -suffix.length);
    if (hangulSyllableCount(stemLast) < UNIFY_SPACED_PART_MIN_HANGUL) continue;
    // 가·이: 4음절 어절에서는 어간 끝과 구분 불가(가치평가→가치평)
    if (
      (suffix === '가' || suffix === '이') &&
      hangulSyllableCount(last) === 4
    ) {
      continue;
    }
    return { stemLast, suffix, bare: false };
  }
  return null;
}

/** @deprecated 저위험만 — matchLongestReviewStemSuffix 사용 */
export function matchLongestLowRiskJosa(lastEojeol) {
  const last = String(lastEojeol ?? '');
  if (!last) return null;
  for (const josa of UNIFY_LOW_RISK_JOSA) {
    if (!last.endsWith(josa) || last.length <= josa.length) continue;
    const stemLast = last.slice(0, -josa.length);
    if (hangulSyllableCount(stemLast) < UNIFY_SPACED_PART_MIN_HANGUL) continue;
    return { stemLast, josa };
  }
  return null;
}

/**
 * 조사·어간 접미를 떼어 검토용 어간·접미. 떼지 못하면 null.
 * @param {string} variant
 * @returns {{ stem: string, suffix: string } | null}
 */
export function parseReviewStemSuffix(variant) {
  const v = String(variant ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!v) return null;
  const parts = v.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const hit = matchLongestReviewStemSuffix(last);
  if (!hit) return null;

  let stem;
  if (hit.bare) {
    if (parts.length < 2) return null;
    stem = parts.slice(0, -1).join(' ');
  } else {
    parts[parts.length - 1] = hit.stemLast;
    stem = parts.join(' ');
  }
  if (hangulSyllableCount(stem.replace(/\s+/g, '')) < UNIFY_SPACED_PART_MIN_HANGUL) {
    return null;
  }
  return { stem, suffix: hit.suffix };
}

/**
 * 조사·어간 접미를 떼어 검토용 어간. 떼지 못하면 null.
 * @param {string} variant
 * @returns {string | null}
 */
export function stripReviewStemSuffix(variant) {
  return parseReviewStemSuffix(variant)?.stem ?? null;
}

/** @deprecated stripReviewStemSuffix */
export function stripLowRiskJosaForReview(variant) {
  return stripReviewStemSuffix(variant);
}

/**
 * @param {string} stemVariant
 * @returns {string}
 */
export function josaReviewStemKey(stemVariant) {
  return String(stemVariant ?? '').replace(/\s+/g, '');
}

/**
 * Kiwi 어간 키 (플래그·로드 시에만). SLM 대체 아님.
 * @param {string} variant
 * @returns {string | null}
 */
export function kiwiJosaStemKey(variant) {
  if (!isUnifyKiwiJosaEnabled() || !isKiwiReady()) return null;
  try {
    const stem = stripTrailingJosaKiwi(variant, UNIFY_SPACED_PART_MIN_HANGUL);
    if (stem == null) return null;
    return josaReviewStemKey(stem);
  } catch {
    return null;
  }
}

/**
 * @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

/**
 * @typedef {{
 *   stemKey: string,
 *   stemSpaced: string,
 *   stemGlued: string,
 *   suffix: string,
 *   stemMismatch: boolean,
 *   tier: 'high' | 'low' | 'risky',
 * }} JosaReviewStemDetail
 */

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {JosaReviewStemDetail | null}
 */
export function reviewStemDetailFromCluster(cluster) {
  const spaced =
    cluster.variants?.find((v) => /\s/.test(v) && (cluster.counts?.[v] ?? 0) > 0) ||
    cluster.variants?.find((v) => /\s/.test(v)) ||
    '';
  const glued =
    cluster.variants?.find((v) => !/\s/.test(v) && (cluster.counts?.[v] ?? 0) > 0) ||
    cluster.variants?.find((v) => !/\s/.test(v)) ||
    cluster.key ||
    '';

  const spacedParsed = spaced ? parseReviewStemSuffix(spaced) : null;
  const gluedParsed = glued ? parseReviewStemSuffix(glued) : null;

  if (spacedParsed && gluedParsed) {
    const spacedKey = josaReviewStemKey(spacedParsed.stem);
    const gluedKey = josaReviewStemKey(gluedParsed.stem);
    if (spacedKey !== gluedKey) {
      const stemKey = spacedKey || gluedKey;
      const suffix = spacedParsed.suffix || gluedParsed.suffix;
      if (hangulSyllableCount(stemKey) < UNIFY_SPACED_PART_MIN_HANGUL) return null;
      return {
        stemKey,
        stemSpaced: spacedParsed.stem,
        stemGlued: gluedKey,
        suffix,
        stemMismatch: true,
        tier: classifyJosaReviewTier(suffix, { stemMismatch: true }),
      };
    }
  }

  const parsed = spacedParsed || gluedParsed;
  if (!parsed) return null;
  const stemKey = josaReviewStemKey(parsed.stem);
  if (hangulSyllableCount(stemKey) < UNIFY_SPACED_PART_MIN_HANGUL) return null;

  return {
    stemKey,
    stemSpaced: spacedParsed?.stem || stemKey,
    stemGlued: stemKey,
    suffix: parsed.suffix,
    stemMismatch: false,
    tier: classifyJosaReviewTier(parsed.suffix),
  };
}

/**
 * 어간 직후 뿐/을/를/은/는/이/가만 다른 충돌 → 표기 통일 목록에서 제외.
 * @param {UnifySpacingCluster} cluster
 * @returns {boolean}
 */
export function isUnifyListDroppedMonoJosaCluster(cluster) {
  const detail = reviewStemDetailFromCluster(cluster);
  if (detail?.suffix && UNIFY_LIST_DROP_MONO_JOSA_SET.has(detail.suffix)) {
    return true;
  }
  // detail 없을 때 glued key 끝만으로도 판별 (위성·단순 키)
  const glued =
    cluster?.variants?.find((v) => !/\s/.test(v)) || cluster?.key || '';
  const hit = matchLongestReviewStemSuffix(String(glued).replace(/\s+/g, ''));
  return Boolean(hit && !hit.bare && UNIFY_LIST_DROP_MONO_JOSA_SET.has(hit.suffix));
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {{ stemKey: string, stemSpaced: string, stemGlued: string } | null}
 */
export function stemFromClusterForJosaReview(cluster) {
  const detail = reviewStemDetailFromCluster(cluster);
  if (!detail || detail.stemMismatch) return null;
  return {
    stemKey: detail.stemKey,
    stemSpaced: detail.stemSpaced,
    stemGlued: detail.stemGlued,
  };
}

/**
 * 같은 추정 어간끼리 검토 링크로 연결(횟수 합치지 않음).
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]}
 */
export function attachJosaReviewHints(clusters) {
  if (!clusters?.length) return clusters;

  /** @type {Map<string, { cluster: import('./unifyCandidateDiscover.js').UnifySpacingCluster, stemKey: string }[]>} */
  const byStem = new Map();

  for (const cluster of clusters) {
    const stem = stemFromClusterForJosaReview(cluster);
    if (!stem) continue;
    if (cluster.key === stem.stemKey) continue;
    if (!byStem.has(stem.stemKey)) byStem.set(stem.stemKey, []);
    byStem.get(stem.stemKey).push({ cluster, stemKey: stem.stemKey });
  }

  /** @type {Map<string, string[]>} */
  const peersByKey = new Map();
  for (const [, members] of byStem) {
    if (members.length < 2) continue;
    const keys = [...new Set(members.map((m) => m.cluster.key))];
    if (keys.length < 2) continue;
    for (const key of keys) {
      peersByKey.set(
        key,
        keys.filter((k) => k !== key).sort((a, b) => a.localeCompare(b, 'ko')),
      );
    }
  }

  return clusters.map((cluster) => {
    const detail = reviewStemDetailFromCluster(cluster);
    if (!detail || cluster.key === detail.stemKey) {
      if (cluster.josaReview || cluster.josaReviewCandidate) {
        const { josaReview: _j, josaReviewCandidate: _c, ...rest } = cluster;
        return rest;
      }
      return cluster;
    }
    const peerKeys = peersByKey.get(cluster.key) ?? [];
    const kiwiStemKey = kiwiJosaStemKey(
      cluster.variants?.find((v) => (cluster.counts?.[v] ?? 0) > 0) ||
        cluster.key,
    );
    const candidate = {
      stemKey: detail.stemKey,
      stemSpaced: detail.stemSpaced,
      suffix: detail.suffix,
      tier: detail.tier,
      stemMismatch: detail.stemMismatch,
      peerKeys,
      ...(kiwiStemKey
        ? {
            kiwiStemKey,
            kiwiAgrees: kiwiStemKey === detail.stemKey,
          }
        : {}),
    };
    if (detail.stemMismatch) {
      return { ...cluster, josaReviewCandidate: candidate };
    }
    return {
      ...cluster,
      josaReviewCandidate: candidate,
      josaReview: {
        stemKey: detail.stemKey,
        peerKeys,
        status: /** @type {const} */ ('review'),
      },
    };
  });
}
