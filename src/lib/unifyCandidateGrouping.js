/**
 * 표기 통일 추천 — 클러스터를 가나다순 정렬 + 계열(prefix/suffix) 그룹핑.
 */

import {
  extractPrefixes,
  extractSuffixes,
  SERIES_MIN_CLUSTER_COUNT,
} from './unifyCandidateSeriesTrend.js';

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
 * - prefix/suffix 공유 클러스터 2개 이상 → series 그룹
 * - 나머지 → single 그룹 (그룹 헤더 없음)
 * - 그룹 간 정렬: 그룹 내 첫 클러스터 key 가나다순
 * @param {UnifySpacingCluster[]} clusters
 * @returns {ClusterGroup[]}
 */
export function groupAndSortClusters(clusters) {
  if (clusters.length === 0) return [];

  // 가나다순 정렬
  const sorted = [...clusters].sort((a, b) =>
    a.key.localeCompare(b.key, 'ko'),
  );

  // prefix series 찾기
  /** @type {Map<string, Set<number>>} */
  const prefixMembers = new Map();
  for (let i = 0; i < sorted.length; i++) {
    for (const p of extractPrefixes(sorted[i].key)) {
      if (!prefixMembers.has(p)) prefixMembers.set(p, new Set());
      prefixMembers.get(p).add(i);
    }
  }

  const assigned = new Set();
  /** @type {ClusterGroup[]} */
  const groups = [];

  // prefix: 짧은 것 우선 (넓은 그룹 형성)
  const prefixKeys = [...prefixMembers.keys()].sort(
    (a, b) => a.length - b.length || a.localeCompare(b, 'ko'),
  );

  for (const prefix of prefixKeys) {
    const members = [...prefixMembers.get(prefix)].filter(
      (i) => !assigned.has(i),
    );
    if (members.length < SERIES_MIN_CLUSTER_COUNT) continue;
    for (const i of members) assigned.add(i);
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: prefix,
      affixType: /** @type {const} */ ('prefix'),
      label: `${prefix}@`,
      clusters: members.map((i) => sorted[i]),
    });
  }

  // suffix series (prefix 미할당만)
  /** @type {Map<string, Set<number>>} */
  const suffixMembers = new Map();
  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue;
    for (const s of extractSuffixes(sorted[i].key)) {
      if (!suffixMembers.has(s)) suffixMembers.set(s, new Set());
      suffixMembers.get(s).add(i);
    }
  }

  const suffixKeys = [...suffixMembers.keys()].sort(
    (a, b) => a.length - b.length || a.localeCompare(b, 'ko'),
  );

  for (const suffix of suffixKeys) {
    const members = [...suffixMembers.get(suffix)].filter(
      (i) => !assigned.has(i),
    );
    if (members.length < SERIES_MIN_CLUSTER_COUNT) continue;
    for (const i of members) assigned.add(i);
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: suffix,
      affixType: /** @type {const} */ ('suffix'),
      label: `@${suffix}`,
      clusters: members.map((i) => sorted[i]),
    });
  }

  // 미할당 → single 그룹 (개별)
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

  // 그룹 간 정렬: 첫 클러스터 key 가나다순
  groups.sort((a, b) =>
    a.clusters[0].key.localeCompare(b.clusters[0].key, 'ko'),
  );

  return groups;
}
