/**
 * 표기 통일 추천 2단계 — 계열 경향(층 C).
 *
 * 같은 앞말(prefix) 또는 뒷말(suffix)을 공유하는 클러스터들의
 * 붙임/띄움 비율을 집계하여, 개별 클러스터 다수형과 계열 경향이
 * 어긋나면 대안 추천을 덧붙인다.
 *
 * 정책: project-docs/unify-candidate-spacing-redesign-2026-07-29.md §11.3
 */

import { hangulSyllableCount } from './unifyCandidateDiscover.js';

/** 앞말 최소 한글 음절 */
export const SERIES_PREFIX_MIN_HANGUL = 2;
/** 같은 접두어 클러스터 최소 개수 */
export const SERIES_MIN_CLUSTER_COUNT = 2;
/** 붙임 경향 임계값 (이상이면 붙임 추천) */
export const SERIES_GLUED_THRESHOLD = 0.7;
/** 띄움 경향 임계값 (이하이면 띄움 추천) */
export const SERIES_SPACED_THRESHOLD = 0.3;

/**
 * @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

/**
 * @typedef {{
 *   prefix: string,
 *   trend: 'glued' | 'spaced',
 *   ratio: number,
 *   suggestion: string,
 *   reason: string,
 * }} SeriesHint
 */

/**
 * 클러스터에서 의미 단위 접두어를 추출.
 * 띄어쓰기 variant에서 첫 번째 단어를 prefix로 사용.
 * 예: "경제 상황" → "경제", "개인 소득" → "개인"
 * fallback: key에서 한글 앞쪽 2~4음절.
 * @param {string} key
 * @param {string[]} [variants] 클러스터의 variants
 * @returns {string[]} 가능한 접두어 목록 (긴 것부터)
 */
export function extractPrefixes(key, variants = []) {
  // 띄어쓰기 variant에서 첫 단어 추출
  const spacedVariant = variants.find((v) => /\s/.test(v));
  if (spacedVariant) {
    const words = spacedVariant.trim().split(/\s+/);
    if (words.length >= 2) {
      const firstWord = words[0];
      if (firstWord.length >= SERIES_PREFIX_MIN_HANGUL) {
        // 첫 단어 자체 + 첫 단어의 앞부분도 후보로 추가
        // 예: "국가채무" → ["국가채무", "국가채", "국가"]
        const result = [firstWord];
        for (let len = firstWord.length - 1; len >= SERIES_PREFIX_MIN_HANGUL; len--) {
          result.push(firstWord.slice(0, len));
        }
        return result;
      }
    }
  }

  // fallback: key에서 기계적 추출
  const hangul = key.match(/[\uAC00-\uD7A3]+/g);
  if (!hangul) return [];
  const first = hangul[0];
  if (first.length < SERIES_PREFIX_MIN_HANGUL) return [];
  const prefixes = [];
  const maxLen = Math.min(4, first.length - 1);
  for (let len = maxLen; len >= SERIES_PREFIX_MIN_HANGUL; len--) {
    prefixes.push(first.slice(0, len));
  }
  return prefixes;
}

/**
 * 클러스터에서 의미 단위 접미사를 추출.
 * 띄어쓰기 variant에서 마지막 단어를 suffix로 사용.
 * 예: "공공 서비스" → "서비스", "미국 정부" → "정부"
 * fallback: key에서 한글 뒤쪽 2~4음절.
 * @param {string} key
 * @param {string[]} [variants] 클러스터의 variants
 * @returns {string[]} 가능한 접미사 목록 (긴 것부터)
 */
export function extractSuffixes(key, variants = []) {
  // 띄어쓰기 variant에서 마지막 단어 추출
  const spacedVariant = variants.find((v) => /\s/.test(v));
  if (spacedVariant) {
    const words = spacedVariant.trim().split(/\s+/);
    if (words.length >= 2) {
      const lastWord = words[words.length - 1];
      if (lastWord.length >= SERIES_PREFIX_MIN_HANGUL) {
        // 마지막 단어 자체 + 마지막 단어의 뒷부분도 후보로 추가
        // 예: "참가율" → ["참가율", "가율", (2글자만)]
        const result = [lastWord];
        for (let len = lastWord.length - 1; len >= SERIES_PREFIX_MIN_HANGUL; len--) {
          result.push(lastWord.slice(lastWord.length - len));
        }
        return result;
      }
    }
  }

  // fallback: key에서 기계적 추출
  const hangul = key.match(/[\uAC00-\uD7A3]+/g);
  if (!hangul) return [];
  const last = hangul[hangul.length - 1];
  if (last.length < SERIES_PREFIX_MIN_HANGUL) return [];
  const suffixes = [];
  const maxLen = Math.min(4, last.length - 1);
  for (let len = maxLen; len >= SERIES_PREFIX_MIN_HANGUL; len--) {
    suffixes.push(last.slice(last.length - len));
  }
  return suffixes;
}

/**
 * 클러스터들을 앞말 기준으로 그룹핑.
 * 가장 긴 공유 접두어를 우선 사용. 클러스터 하나는 하나의 series에만 속함.
 * @param {UnifySpacingCluster[]} clusters
 * @returns {Map<string, UnifySpacingCluster[]>}
 */
export function groupClustersBySeries(clusters) {
  /** @type {Map<string, Set<number>>} prefix → cluster indices */
  const prefixMembers = new Map();

  for (let i = 0; i < clusters.length; i++) {
    const prefixes = extractPrefixes(clusters[i].key, clusters[i].variants);
    for (const p of prefixes) {
      if (!prefixMembers.has(p)) prefixMembers.set(p, new Set());
      prefixMembers.get(p).add(i);
    }
  }

  // 긴 접두어부터 할당, 이미 할당된 클러스터는 제외
  const assigned = new Set();
  /** @type {Map<string, UnifySpacingCluster[]>} */
  const result = new Map();

  const sortedPrefixes = [...prefixMembers.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );

  for (const prefix of sortedPrefixes) {
    const members = [...prefixMembers.get(prefix)].filter(
      (i) => !assigned.has(i),
    );
    if (members.length < SERIES_MIN_CLUSTER_COUNT) continue;
    result.set(prefix, members.map((i) => clusters[i]));
    for (const i of members) assigned.add(i);
  }

  return result;
}

/**
 * 클러스터들을 뒷말 기준으로 그룹핑.
 * @param {UnifySpacingCluster[]} clusters
 * @param {Set<number>} [excludeIndices] 이미 prefix series에 할당된 인덱스
 * @returns {Map<string, UnifySpacingCluster[]>}
 */
export function groupClustersBySuffix(clusters, excludeIndices = new Set()) {
  /** @type {Map<string, Set<number>>} */
  const suffixMembers = new Map();

  for (let i = 0; i < clusters.length; i++) {
    if (excludeIndices.has(i)) continue;
    const suffixes = extractSuffixes(clusters[i].key, clusters[i].variants);
    for (const s of suffixes) {
      if (!suffixMembers.has(s)) suffixMembers.set(s, new Set());
      suffixMembers.get(s).add(i);
    }
  }

  const assigned = new Set();
  /** @type {Map<string, UnifySpacingCluster[]>} */
  const result = new Map();

  // 긴 suffix 우선 — 의미 단위("서비스")가 "비스"보다 우선
  const sorted = [...suffixMembers.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );

  for (const suffix of sorted) {
    const members = [...suffixMembers.get(suffix)].filter(
      (i) => !assigned.has(i) && !excludeIndices.has(i),
    );
    if (members.length < SERIES_MIN_CLUSTER_COUNT) continue;
    result.set(suffix, members.map((i) => clusters[i]));
    for (const i of members) assigned.add(i);
  }

  return result;
}

/**
 * series group의 붙임 비율을 계산.
 * @param {UnifySpacingCluster[]} seriesClusters
 * @returns {number} 0.0~1.0 (1.0 = 모두 붙임)
 */
export function calcSeriesTrend(seriesClusters) {
  let gluedTotal = 0;
  let allTotal = 0;

  for (const cluster of seriesClusters) {
    for (const [variant, count] of Object.entries(cluster.counts)) {
      allTotal += count;
      if (!/\s/.test(variant)) {
        gluedTotal += count;
      }
    }
  }

  if (allTotal === 0) return 0.5;
  return gluedTotal / allTotal;
}

/**
 * 클러스터에 계열 경향 hint를 붙인다.
 * 다수형과 계열 경향이 다를 때만 hint 생성.
 * @param {UnifySpacingCluster[]} clusters
 * @returns {Map<string, SeriesHint>} key(cluster.key) → hint
 */
export function buildSeriesHints(clusters) {
  /** @type {Map<string, SeriesHint>} */
  const hints = new Map();

  // --- Prefix series ---
  const prefixSeries = groupClustersBySeries(clusters);
  /** @type {Set<number>} prefix series에 할당된 인덱스 */
  const prefixAssigned = new Set();

  for (const [prefix, seriesClusters] of prefixSeries) {
    for (const sc of seriesClusters) {
      const idx = clusters.indexOf(sc);
      if (idx !== -1) prefixAssigned.add(idx);
    }
    _applySeriesHints(hints, prefix, seriesClusters, 'prefix');
  }

  // --- Suffix series (prefix에 미할당된 클러스터만) ---
  const suffixSeries = groupClustersBySuffix(clusters, prefixAssigned);

  for (const [suffix, seriesClusters] of suffixSeries) {
    _applySeriesHints(hints, suffix, seriesClusters, 'suffix');
  }

  return hints;
}

/**
 * @param {Map<string, SeriesHint>} hints
 * @param {string} affix
 * @param {UnifySpacingCluster[]} seriesClusters
 * @param {'prefix' | 'suffix'} type
 */
function _applySeriesHints(hints, affix, seriesClusters, type) {
  const ratio = calcSeriesTrend(seriesClusters);

  let trend = /** @type {'glued' | 'spaced' | null} */ (null);
  if (ratio >= SERIES_GLUED_THRESHOLD) trend = 'glued';
  else if (ratio <= SERIES_SPACED_THRESHOLD) trend = 'spaced';
  if (!trend) return;

  for (const cluster of seriesClusters) {
    const recommended = cluster.recommendedUnify;
    const recommendedIsGlued = !/\s/.test(recommended);

    if (trend === 'glued' && recommendedIsGlued) continue;
    if (trend === 'spaced' && !recommendedIsGlued) continue;

    let suggestion = '';
    if (trend === 'glued') {
      suggestion = cluster.variants.find((v) => !/\s/.test(v)) || '';
    } else {
      suggestion = cluster.variants.find((v) => /\s/.test(v)) || '';
    }
    if (!suggestion || suggestion === recommended) continue;

    const trendLabel = trend === 'glued' ? '붙임' : '띄움';
    const label = type === 'prefix'
      ? `「${affix}○○」계열`
      : `「○○${affix}」계열`;
    const reason = `${label} 다수가 ${trendLabel} → ${trendLabel} 통일 제안`;

    hints.set(cluster.key, {
      prefix: affix,
      trend,
      ratio: Math.round(ratio * 100) / 100,
      suggestion,
      reason,
    });
  }
}
