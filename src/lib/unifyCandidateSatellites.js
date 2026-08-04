/**
 * 표기 통일 추천 — @ 그룹 위성(single-form) 항목.
 * 충돌 클러스터에 없지만 같은 affix 계열에 속하는 1회·단일어절만 그룹에 편입.
 */

import {
  hangulSyllableCount,
  isValidSpacedUnifyVariant,
  UNIFY_TRAILING_JOSA,
} from './unifyCandidateDiscover.js';
import {
  shouldRejectByNoiseList,
  shouldRejectByNoiseListEojeol,
} from './unifyNoiseList.js';
import {
  extractPrefixes,
  extractSuffixes,
} from './unifyCandidateSeriesTrend.js';
import { isExcludedSeriesSlotFiller } from './unifyListStemTriage.js';

/**
 * 1차 리스트 — {@link shouldRejectByNoiseList} 별칭.
 * @param {string} spacedVariant
 * @param {string} [clusterKey]
 * @returns {boolean} true면 제외
 */
export function shouldRejectUnifySatelliteSpacedByList(
  spacedVariant,
  clusterKey = '',
) {
  return shouldRejectByNoiseList(spacedVariant, clusterKey);
}

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

  // 1차 리스트만 — 동기 Kiwi POS/글루 분석은 찾기 경로에서 쓰지 않음
  const spacedForList = /\s/.test(existing) ? existing : opposite;
  if (
    /\s/.test(spacedForList) &&
    shouldRejectByNoiseList(spacedForList)
  ) {
    return null;
  }

  const glued = String(existing).replace(/\s+/g, '');
  if (shouldRejectByNoiseListEojeol(glued)) {
    return null;
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

  /** @type {ClusterGroup[]} */
  const seriesGroups = [];
  /** @type {Map<ClusterGroup, UnifySpacingCluster[]>} */
  const pendingByGroup = new Map();
  for (const group of groups) {
    if (group.type !== 'series') continue;
    seriesGroups.push(group);
    pendingByGroup.set(group, []);
  }

  if (seriesGroups.length && rawByKey?.size) {
    for (const [key, acc] of rawByKey) {
      if (usedKeys.has(key)) continue;
      if (acc.counts.size !== 1) continue;
      let existing = '';
      let count = 0;
      for (const [variant, n] of acc.counts) {
        existing = variant;
        count = n;
        break;
      }
      if (!existing) continue;

      for (const group of seriesGroups) {
        // 싼 사전 필터 — 계열마다 buildSingleForm 전량 호출 방지
        if (
          !isSeriesSatelliteCandidate(
            existing,
            count,
            group.affix,
            group.affixType,
          )
        ) {
          continue;
        }
        const satellite = buildSingleFormCluster(
          key,
          acc,
          group.affixType,
          group.affix,
        );
        if (!satellite) continue;
        if (!matchesSeriesAffix(satellite, group.affix, group.affixType)) {
          continue;
        }
        if (isExcludedSeriesSlotFiller(satellite, group.affix, group.affixType)) {
          continue;
        }
        pendingByGroup.get(group)?.push(satellite);
        usedKeys.add(key);
        break;
      }
    }
  }

  for (const group of seriesGroups) {
    const satellites = pendingByGroup.get(group) ?? [];
    if (satellites.length === 0) continue;
    satellites.sort((a, b) => a.key.localeCompare(b.key, 'ko'));
    group.clusters = [...group.clusters, ...satellites];
  }

  return groups;
}

/**
 * 이형태 없는 위성·단일형 — 1차 리스트만으로 잡음 제외.
 * (본보조·Kiwi 수확 꼬리·예외 어절·조사 휴리스틱. 동기 Kiwi 분석 없음.)
 * 진짜 충돌(붙임·띄움 둘 다 count>0)은 유지.
 * @param {ClusterGroup[]} groups
 * @returns {ClusterGroup[]}
 */
export function filterSeriesSatellitesByMorphPos(groups) {
  return (groups ?? [])
    .map((group) => {
      const next = (group.clusters ?? []).filter((cluster) => {
        if (isRealConflictCounts(cluster)) return true;
        const spaced =
          cluster.variants?.find((v) => /\s/.test(String(v))) ??
          Object.keys(cluster.counts ?? {}).find((v) => /\s/.test(v)) ??
          '';
        if (!spaced || !/\s/.test(spaced)) return true;
        try {
          return !shouldRejectByNoiseList(spaced, cluster.key);
        } catch {
          return true;
        }
      });
      if (next.length === 0) return null;
      if (next.length === (group.clusters ?? []).length) return group;
      return { ...group, clusters: next };
    })
    .filter(Boolean);
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
