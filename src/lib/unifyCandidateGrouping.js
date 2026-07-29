/**
 * 표기 통일 추천 — 클러스터를 가나다순 정렬 + 계열(prefix/suffix) 그룹핑.
 */

import {
  extractPrefixes,
  extractSuffixes,
  SERIES_MIN_CLUSTER_COUNT,
} from './unifyCandidateSeriesTrend.js';
import { normalizeSpacingClusters, trimClusterToAffixBoundary } from './unifyCandidateCollapse.js';
import {
  clusterBelongsToSeriesAffix,
  fillSeriesSatellites,
} from './unifyCandidateSatellites.js';

/**
 * @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

/**
 * @typedef {{
 *   type: 'series',
 *   affix: string,
 *   affixType: 'prefix' | 'suffix',
 *   label: string,
 *   clusters: UnifySpacingCluster[],
 * } | {
 *   type: 'single',
 *   clusters: UnifySpacingCluster[],
 * }} ClusterGroup
 */

/**
 * 클러스터를 가나다순 정렬 후 계열 그룹핑.
 * - prefix: 띄움 첫 어절 === affix 인 충돌만 (개인 소득 ✓ / 개인적인 슬픔 ✗)
 * - suffix: 띄움 끝 어절 === affix
 * @param {UnifySpacingCluster[]} clusters
 * @returns {ClusterGroup[]}
 */
export function groupAndSortClusters(clusters) {
  if (clusters.length === 0) return [];

  const sorted = [...clusters].sort((a, b) =>
    a.key.localeCompare(b.key, 'ko'),
  );

  /** @type {Map<string, Set<number>>} */
  const prefixMembers = new Map();
  for (let i = 0; i < sorted.length; i++) {
    for (const p of extractPrefixes(sorted[i].key, sorted[i].variants)) {
      if (!clusterBelongsToSeriesAffix(sorted[i], p, 'prefix')) continue;
      if (!prefixMembers.has(p)) prefixMembers.set(p, new Set());
      prefixMembers.get(p).add(i);
    }
  }

  const assigned = new Set();
  /** @type {ClusterGroup[]} */
  const groups = [];

  const prefixKeys = [...prefixMembers.keys()].sort(
    (a, b) => a.length - b.length || a.localeCompare(b, 'ko'),
  );

  for (const prefix of prefixKeys) {
    const members = [...prefixMembers.get(prefix)].filter(
      (i) => !assigned.has(i),
    );
    if (members.length < SERIES_MIN_CLUSTER_COUNT) continue;
    for (const i of members) assigned.add(i);
    const groupClusters = members
      .map((i) => trimClusterToAffixBoundary(sorted[i], prefix, 'prefix'))
      .filter(Boolean)
      .sort((a, b) => {
      const aSpaced = a.variants.find((v) => /\s/.test(v)) || '';
      const bSpaced = b.variants.find((v) => /\s/.test(v)) || '';
      const aFirst = aSpaced.split(/\s+/)[0] || a.key;
      const bFirst = bSpaced.split(/\s+/)[0] || b.key;
      return aFirst.length - bFirst.length || a.key.localeCompare(b.key, 'ko');
    });
    if (groupClusters.length < SERIES_MIN_CLUSTER_COUNT) {
      for (const i of members) assigned.delete(i);
      continue;
    }
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: prefix,
      affixType: /** @type {const} */ ('prefix'),
      label: `${prefix}@`,
      clusters: groupClusters,
    });
  }

  /** @type {Map<string, Set<number>>} */
  const suffixMembers = new Map();
  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue;
    for (const s of extractSuffixes(sorted[i].key, sorted[i].variants)) {
      if (!clusterBelongsToSeriesAffix(sorted[i], s, 'suffix')) continue;
      if (!suffixMembers.has(s)) suffixMembers.set(s, new Set());
      suffixMembers.get(s).add(i);
    }
  }

  const suffixKeys = [...suffixMembers.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );

  for (const suffix of suffixKeys) {
    const members = [...suffixMembers.get(suffix)].filter(
      (i) => !assigned.has(i),
    );
    if (members.length < SERIES_MIN_CLUSTER_COUNT) continue;
    for (const i of members) assigned.add(i);
    const groupClusters = members
      .map((i) => trimClusterToAffixBoundary(sorted[i], suffix, 'suffix'))
      .filter(Boolean);
    if (groupClusters.length < SERIES_MIN_CLUSTER_COUNT) {
      for (const i of members) assigned.delete(i);
      continue;
    }
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: suffix,
      affixType: /** @type {const} */ ('suffix'),
      label: `@${suffix}`,
      clusters: groupClusters,
    });
  }

  const singles = [];
  for (let i = 0; i < sorted.length; i++) {
    if (!assigned.has(i)) singles.push(sorted[i]);
  }
  if (singles.length > 0) {
    groups.push({
      type: /** @type {const} */ ('single'),
      clusters: singles,
    });
  }

  const order = (g) =>
    g.type === 'single' ? 0 : g.affixType === 'prefix' ? 1 : 2;
  groups.sort((a, b) => {
    const o = order(a) - order(b);
    if (o !== 0) return o;
    return a.clusters[0].key.localeCompare(b.clusters[0].key, 'ko');
  });

  return groups;
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @param {Map<string, import('./unifyCandidateDiscover.js').ClusterAcc>} rawByKey
 * @returns {ClusterGroup[]}
 */
export function groupSortAndFillSatellites(clusters, rawByKey) {
  // 1) 붙임·띄움 쌍이 있는 충돌만으로 @ 그룹 형성
  const normalized = normalizeSpacingClusters(clusters).filter(
    isRealSpacingConflict,
  );
  let groups = groupAndSortClusters(normalized);

  // 2) 이미 생긴 @ 그룹에만 1회 등장 위성(개인 사정 등) 편입
  groups = fillSeriesSatellites(groups, normalized, rawByKey ?? new Map());

  for (const group of groups) {
    if (group.type === 'series') {
      // 충돌은 유지, 위성(single-form)은 그대로 둠
      const conflicts = group.clusters.filter(isRealSpacingConflict);
      const satellites = group.clusters.filter((c) => c.kind === 'single-form');
      if (conflicts.length < SERIES_MIN_CLUSTER_COUNT) {
        group.clusters = [];
        continue;
      }
      group.clusters = [...conflicts, ...satellites];
      continue;
    }
    group.clusters = normalizeSpacingClusters(group.clusters).filter(
      isRealSpacingConflict,
    );
  }

  const order = (g) =>
    g.type === 'single' ? 0 : g.affixType === 'prefix' ? 1 : 2;
  groups.sort((a, b) => {
    const o = order(a) - order(b);
    if (o !== 0) return o;
    if (a.clusters.length === 0 || b.clusters.length === 0) return 0;
    return a.clusters[0].key.localeCompare(b.clusters[0].key, 'ko');
  });

  return groups.filter((g) => {
    if (g.type === 'series') {
      return (
        g.clusters.filter(isRealSpacingConflict).length >=
        SERIES_MIN_CLUSTER_COUNT
      );
    }
    return g.clusters.length > 0;
  });
}

/**
 * 붙임·띄움이 문서에 각각 1회 이상 있는 실제 충돌인지.
 * @param {UnifySpacingCluster} cluster
 */
export function isRealSpacingConflict(cluster) {
  let glued = 0;
  let spaced = 0;
  for (const [variant, count] of Object.entries(cluster.counts ?? {})) {
    if (count <= 0) continue;
    if (/\s/.test(variant)) spaced += count;
    else glued += count;
  }
  return glued > 0 && spaced > 0;
}
