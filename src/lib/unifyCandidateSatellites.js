/**
 * 표기 통일 추천 — @ 그룹 위성(single-form) 항목.
 * 충돌 클러스터에 없지만 같은 affix 계열에 속하는 1회·단일어절만 그룹에 편입.
 */

import {
  shouldRejectUnifySatelliteGlued,
  shouldRejectUnifySatelliteSpacedByPos,
} from './kiwiMorph/unifyExclude.js';
import { isKiwiReady } from './kiwiMorph/runtime.js';
import {
  hangulSyllableCount,
  isValidSpacedUnifyVariant,
  UNIFY_TRAILING_JOSA,
} from './unifyCandidateDiscover.js';
import {
  extractPrefixes,
  extractSuffixes,
} from './unifyCandidateSeriesTrend.js';
import { isExcludedSeriesSlotFiller } from './unifyListStemTriage.js';

/**
 * @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 * @typedef {import('./unifyCandidateDiscover.js').ClusterAcc} ClusterAcc
 * @typedef {import('./unifyCandidateGrouping.js').ClusterGroup} ClusterGroup
 */

/**
 * @param {string} key
 * @param {string} existingVariant 문서에 실제 등장한 형태
 * @param {'prefix' | 'suffix'} affixType
 * @param {string} affix
 * @returns {string}
 */
export function deriveOppositeVariant(key, existingVariant, affixType, affix) {
  const isSpaced = /\s/.test(existingVariant);
  if (isSpaced) {
    return key;
  }
  if (affixType === 'suffix') {
    if (!key.endsWith(affix)) return key;
    const head = key.slice(0, key.length - affix.length);
    return head ? `${head} ${affix}` : affix;
  }
  if (!key.startsWith(affix)) return key;
  const tail = key.slice(affix.length);
  return tail ? `${affix} ${tail}` : affix;
}

/**
 * 위성 후보 — 문서에 한 형태만 있는 표기.
 * - 횟수 ≥1 (차트 이중 드로잉 등으로 raw>1이어도 편입 → enrich가 item 기준으로 맞춤)
 * - 붙임: affix를 앞/뒤에 가진 단일어
 * - 띄움: affix 바로 옆 한 어절만 (개인 사정 / 미국 정부)
 * @param {string} existingVariant
 * @param {number} count
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 */
export function isSeriesSatelliteCandidate(
  existingVariant,
  count,
  affix,
  affixType,
) {
  if (count < 1) return false;
  if (!/\s/.test(existingVariant)) {
    if (affixType === 'prefix') {
      return (
        existingVariant.startsWith(affix) &&
        existingVariant.length > affix.length
      );
    }
    return (
      existingVariant.endsWith(affix) && existingVariant.length > affix.length
    );
  }
  const parts = existingVariant.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;
  return affixType === 'prefix'
    ? parts[0] === affix
    : parts[1] === affix;
}

/**
 * 반대 띄움이 「경제 학이」처럼 조사만 남은 잔해면 true (Kiwi 없이도 거부).
 * @param {string} opposite
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 */
function oppositeLooksLikeTrailingJosaDebris(opposite, affix, affixType) {
  const parts = String(opposite ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length !== 2) return false;
  const other = affixType === 'prefix' ? parts[1] : parts[0];
  if (parts[0] !== affix && affixType === 'prefix') return false;
  if (parts[1] !== affix && affixType === 'suffix') return false;
  for (const josa of UNIFY_TRAILING_JOSA) {
    if (!other.endsWith(josa) || other.length <= josa.length) continue;
    const stem = other.slice(0, -josa.length);
    if (hangulSyllableCount(stem) < 2) return true;
  }
  return false;
}

/**
 * @param {string} key
 * @param {ClusterAcc} acc
 * @param {'prefix' | 'suffix'} affixType
 * @param {string} affix
 * @returns {UnifySpacingCluster | null}
 */
export function buildSingleFormCluster(key, acc, affixType, affix) {
  if (acc.counts.size !== 1) return null;
  const existing = [...acc.counts.keys()][0];
  const count = acc.counts.get(existing) ?? 0;
  if (!isSeriesSatelliteCandidate(existing, count, affix, affixType)) {
    return null;
  }

  const opposite = deriveOppositeVariant(key, existing, affixType, affix);
  if (opposite === existing) return null;
  // 경제학상→경제 학상 등 1음절·무효 띄움은 위성 거부
  if (/\s/.test(opposite) && !isValidSpacedUnifyVariant(opposite)) {
    return null;
  }
  if (/\s/.test(existing) && !isValidSpacedUnifyVariant(existing)) {
    return null;
  }
  // 경제학이 → 경제 학이 (조사 잔해) — Kiwi 없이도 거부
  if (oppositeLooksLikeTrailingJosaDebris(opposite, affix, affixType)) {
    return null;
  }

  // 보통 시장·말해 시장 — 띄움이 명사+명사/동사+동사가 아니면 위성 거부
  const spacedForMorph = /\s/.test(existing) ? existing : opposite;
  if (/\s/.test(spacedForMorph) && isKiwiReady()) {
    try {
      if (shouldRejectUnifySatelliteSpacedByPos(spacedForMorph, undefined)) {
        return null;
      }
    } catch {
      /* keep */
    }
  }

  const glued = String(existing).replace(/\s+/g, '');
  // 분석된 닫힌 명사·이다·명사+하다만 위성 거부. unknown은 위성 유지.
  try {
    if (shouldRejectUnifySatelliteGlued(glued)) return null;
  } catch {
    /* keep */
  }

  const isSpaced = /\s/.test(existing);
  const variants = isSpaced ? [existing, opposite] : [opposite, existing];

  /** @type {Record<string, import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]>} */
  const occurrencesByVariant = {};
  for (const [variant, list] of acc.occurrences) {
    occurrencesByVariant[variant] = list;
  }
  occurrencesByVariant[opposite] = [];

  return {
    key,
    variants,
    counts: {
      [existing]: count,
      [opposite]: 0,
    },
    occurrencesByVariant,
    recommendedUnify: existing,
    totalCount: count,
    kind: /** @type {const} */ ('single-form'),
  };
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 * @returns {boolean}
 */
export function matchesSeriesAffix(cluster, affix, affixType) {
  const existing =
    cluster.variants.find((v) => (cluster.counts[v] ?? 0) > 0) ??
    cluster.variants[0];
  const prefixes = extractPrefixes(cluster.key, [existing]);
  const suffixes = extractSuffixes(cluster.key, [existing]);
  return affixType === 'prefix'
    ? prefixes.includes(affix)
    : suffixes.includes(affix);
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {string}
 */
function spacedFirstWord(cluster) {
  const spaced = cluster.variants.find((v) => /\s/.test(v));
  if (!spaced) return '';
  return spaced.trim().split(/\s+/)[0] || '';
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {string}
 */
function spacedLastWord(cluster) {
  const spaced = cluster.variants.find((v) => /\s/.test(v));
  if (!spaced) return '';
  const parts = spaced.trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

/**
 * prefix 시리즈: 띄움 첫 어절이 affix와 같을 때만 (개인 소득 ✓, 개인적인 슬픔 ✗)
 * @param {UnifySpacingCluster} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 */
export function clusterBelongsToSeriesAffix(cluster, affix, affixType) {
  if (cluster.kind === 'single-form') {
    return matchesSeriesAffix(cluster, affix, affixType);
  }
  if (affixType === 'prefix') {
    return spacedFirstWord(cluster) === affix;
  }
  return spacedLastWord(cluster) === affix;
}

/**
 * @param {Map<string, ClusterAcc>} rawByKey
 * @param {Set<string>} usedKeys
 * @param {'prefix' | 'suffix'} affixType
 * @param {string} affix
 * @returns {UnifySpacingCluster[]}
 */
function collectSatellitesForAffix(rawByKey, usedKeys, affixType, affix) {
  /** @type {UnifySpacingCluster[]} */
  const satellites = [];
  for (const [key, acc] of rawByKey) {
    if (usedKeys.has(key)) continue;
    if (acc.counts.size !== 1) continue;
    const satellite = buildSingleFormCluster(key, acc, affixType, affix);
    if (!satellite) continue;
    if (!matchesSeriesAffix(satellite, affix, affixType)) continue;
    // 금융업·기술 58처럼 @ 채움 단음절·숫자 위성은 넣지 않음
    if (isExcludedSeriesSlotFiller(satellite, affix, affixType)) continue;
    satellites.push(satellite);
    usedKeys.add(key);
  }
  satellites.sort((a, b) => a.key.localeCompare(b.key, 'ko'));
  return satellites;
}

/**
 * @param {ClusterGroup[]} groups
 * @param {UnifySpacingCluster[]} conflictClusters
 * @param {Map<string, ClusterAcc>} rawByKey
 * @returns {ClusterGroup[]}
 */
export function fillSeriesSatellites(groups, conflictClusters, rawByKey) {
  const usedKeys = new Set(conflictClusters.map((c) => c.key));
  for (const group of groups) {
    for (const c of group.clusters) usedKeys.add(c.key);
  }

  for (const group of groups) {
    if (group.type !== 'series') continue;

    const satellites = collectSatellitesForAffix(
      rawByKey,
      usedKeys,
      group.affixType,
      group.affix,
    );
    if (satellites.length === 0) continue;

    group.clusters = [...group.clusters, ...satellites];
    // 최종 가나다 정렬은 groupSortAndFillSatellites / sortClusterGroups 에서 수행
  }

  return groups;
}

/**
 * 이형태 없는 위성의 띄움형 — 명사+명사 / 동사+동사만 유지.
 * 진짜 충돌(붙임·띄움 둘 다 count>0)은 유지. kind 누락도 count로 판별.
 * @param {ClusterGroup[]} groups
 * @returns {ClusterGroup[]}
 */
export function filterSeriesSatellitesByMorphPos(groups) {
  if (!isKiwiReady()) return groups ?? [];
  return (groups ?? []).map((group) => {
    if (group.type !== 'series') return group;
    const dictPos = group.dictPos;
    const next = (group.clusters ?? []).filter((cluster) => {
      if (isRealConflictCounts(cluster)) return true;
      const spaced =
        cluster.variants?.find((v) => /\s/.test(String(v))) ??
        Object.keys(cluster.counts ?? {}).find((v) => /\s/.test(v)) ??
        '';
      if (!spaced || !/\s/.test(spaced)) return true;
      try {
        return !shouldRejectUnifySatelliteSpacedByPos(spaced, dictPos);
      } catch {
        return true;
      }
    });
    if (next.length === (group.clusters ?? []).length) return group;
    return { ...group, clusters: next };
  });
}

/** @param {{ counts?: Record<string, number>, kind?: string }} cluster */
function isRealConflictCounts(cluster) {
  if (cluster.kind === 'conflict') return true;
  if (cluster.kind === 'single-form') return false;
  let glued = 0;
  let spaced = 0;
  for (const [variant, count] of Object.entries(cluster.counts ?? {})) {
    if (count <= 0) continue;
    if (/\s/.test(variant)) spaced += count;
    else glued += count;
  }
  return glued > 0 && spaced > 0;
}

export { spacedFirstWord, spacedLastWord };
