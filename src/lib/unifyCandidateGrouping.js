/**
 * 표기 통일 추천 — 클러스터를 가나다순 정렬 + 계열(prefix/suffix) 그룹핑.
 *
 * 목록 순서 (합의):
 * 1) 단일 항목(명사 위주) 가나다순
 * 2) 접두 계열(가나다@) 명사 — 그룹 안도 가나다
 * 3) 접미 계열(@가나다) 명사 — 그룹 안도 가나다
 * 4) 용언 — 단일 추정 + 접두·접미 용언 계열(만들어@ 등) 모두 명사 뒤
 */

import {
  extractPrefixes,
  extractSuffixes,
  SERIES_MIN_CLUSTER_COUNT,
} from './unifyCandidateSeriesTrend.js';
import { normalizeSpacingClusters } from './unifyCandidateCollapse.js';
import {
  clusterBelongsToSeriesAffix,
  fillSeriesSatellites,
} from './unifyCandidateSatellites.js';
import { attachJosaReviewHints, isUnifyListDroppedMonoJosaCluster } from './unifyJosaReview.js';
import { attachAuxiliaryReviewHints } from './unifyAuxReview.js';
import {
  isUnifyPredicateCluster,
  looksLikePredicateKey,
} from './unifyPredicateBucket.js';
import { markSeriesBySlotMajority } from './unifyListStemTriage.js';

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
 *   dictPos?: 'predicate' | 'noun',
 * } | {
 *   type: 'single',
 *   clusters: UnifySpacingCluster[],
 * } | {
 *   type: 'predicate',
 *   clusters: UnifySpacingCluster[],
 * }} ClusterGroup
 */

/**
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
function sortClustersByKey(clusters) {
  return [...clusters].sort((a, b) => a.key.localeCompare(b.key, 'ko'));
}

/**
 * 단일 명사 → 명사 접두@ → 명사 @접미 → 용언(단일·계열).
 * 같은 구간 안에서는 affix(또는 키) 가나다.
 * @param {ClusterGroup[]} groups
 * @returns {ClusterGroup[]}
 */
export function sortClusterGroups(groups) {
  const section = (g) => {
    if (g.type === 'single') return 0;
    if (g.type === 'predicate') return 3;
    if (
      g.type === 'series' &&
      (looksLikePredicateKey(g.affix) || g.dictPos === 'predicate')
    ) {
      return 3;
    }
    return g.affixType === 'prefix' ? 1 : 2;
  };

  return [...groups]
    .map((g) => ({ ...g, clusters: sortClustersByKey(g.clusters) }))
    .filter((g) => g.clusters.length > 0)
    .sort((a, b) => {
      const o = section(a) - section(b);
      if (o !== 0) return o;
      // 용언 구간: 「용언」단일 묶음 → 용언 계열(접두·접미 가나다)
      if (section(a) === 3) {
        const aSeries = a.type === 'series' ? 1 : 0;
        const bSeries = b.type === 'series' ? 1 : 0;
        if (aSeries !== bSeries) return aSeries - bSeries;
      }
      if (a.type !== 'series' || b.type !== 'series') return 0;
      return a.affix.localeCompare(b.affix, 'ko');
    });
}

/**
 * 단일 그룹에서 용언 추정 항목을 빼 `predicate` 그룹으로 옮긴다.
 * auxReview는 attach 이후에 붙으므로 힌트 부착 후 호출.
 * @param {ClusterGroup[]} groups
 * @returns {ClusterGroup[]}
 */
export function splitPredicateSingles(groups) {
  if (!groups?.length) return groups;

  /** @type {ClusterGroup[]} */
  const next = [];
  /** @type {UnifySpacingCluster[]} */
  const predicates = [];

  for (const group of groups) {
    if (group.type !== 'single') {
      next.push(group);
      continue;
    }
    /** @type {UnifySpacingCluster[]} */
    const nouns = [];
    for (const cluster of group.clusters) {
      if (isUnifyPredicateCluster(cluster)) predicates.push(cluster);
      else nouns.push(cluster);
    }
    if (nouns.length > 0) {
      next.push({
        type: /** @type {const} */ ('single'),
        clusters: sortClustersByKey(nouns),
      });
    }
  }

  if (predicates.length > 0) {
    next.push({
      type: /** @type {const} */ ('predicate'),
      clusters: sortClustersByKey(predicates),
    });
  }

  return sortClusterGroups(next);
}

/**
 * 클러스터를 가나다순 정렬 후 계열 그룹핑.
 * - prefix: 띄움 첫 어절 === affix 인 충돌만 (개인 소득 ✓ / 개인적인 슬픔 ✗)
 * - suffix: 띄움 끝 어절 === affix
 * @param {UnifySpacingCluster[]} clusters
 * @param {{ minSeriesMembers?: number }} [opts]
 * @returns {ClusterGroup[]}
 */
export function groupAndSortClusters(clusters, opts = {}) {
  if (clusters.length === 0) return [];
  const minSeriesMembers = opts.minSeriesMembers ?? SERIES_MIN_CLUSTER_COUNT;

  const sorted = sortClustersByKey(clusters);

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

  // 배정용: 짧은 affix 우선. 화면 순서는 sortClusterGroups가 affix 가나다로 재정렬.
  const prefixKeys = [...prefixMembers.keys()].sort(
    (a, b) => a.length - b.length || a.localeCompare(b, 'ko'),
  );

  for (const prefix of prefixKeys) {
    const members = [...prefixMembers.get(prefix)].filter(
      (i) => !assigned.has(i),
    );
    if (members.length < minSeriesMembers) continue;
    for (const i of members) assigned.add(i);
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: prefix,
      affixType: /** @type {const} */ ('prefix'),
      label: `${prefix}@`,
      clusters: sortClustersByKey(members.map((i) => sorted[i])),
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
    if (members.length < minSeriesMembers) continue;
    for (const i of members) assigned.add(i);
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: suffix,
      affixType: /** @type {const} */ ('suffix'),
      label: `@${suffix}`,
      clusters: sortClustersByKey(members.map((i) => sorted[i])),
    });
  }

  const singles = [];
  for (let i = 0; i < sorted.length; i++) {
    if (!assigned.has(i)) singles.push(sorted[i]);
  }
  if (singles.length > 0) {
    groups.push({
      type: /** @type {const} */ ('single'),
      clusters: sortClustersByKey(singles),
    });
  }

  return sortClusterGroups(groups);
}

/**
 * series를 유지할지 — 충돌 2개+, 또는 충돌 1개+위성 1개+.
 * @param {UnifySpacingCluster[]} clusters
 */
function shouldKeepSeriesGroup(clusters) {
  const conflicts = clusters.filter(isRealSpacingConflict);
  const satellites = clusters.filter((c) => c.kind === 'single-form');
  if (conflicts.length >= SERIES_MIN_CLUSTER_COUNT) return true;
  return conflicts.length >= 1 && satellites.length >= 1;
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @param {Map<string, import('./unifyCandidateDiscover.js').ClusterAcc>} rawByKey
 * @returns {ClusterGroup[]}
 */
export function groupSortAndFillSatellites(clusters, rawByKey) {
  // 1) 충돌만으로 @ 후보 형성 (1개도 잠정 허용 → 위성 붙인 뒤 유지 여부 결정)
  //    어간+뿐/을/를/은/는/이/가 단음절만 다른 충돌은 목록에서 제외
  const normalized = normalizeSpacingClusters(clusters)
    .filter(isRealSpacingConflict)
    .filter((c) => !isUnifyListDroppedMonoJosaCluster(c));
  let groups = groupAndSortClusters(normalized, { minSeriesMembers: 1 });

  // 2) @ 후보에 1회 위성 편입 (세계경제만 있어도 세계 시장 위성 가능)
  groups = fillSeriesSatellites(groups, normalized, rawByKey ?? new Map());

  /** @type {UnifySpacingCluster[]} */
  const demoted = [];

  for (const group of groups) {
    if (group.type === 'series') {
      // 위성 편입 후 — 짧은 공통 단위로 합침 (둔화다·둔화라→둔화, 부양금·부양책→부양)
      const absorbed = normalizeSpacingClusters(group.clusters).map(
        (cluster) =>
          isRealSpacingConflict(cluster)
            ? { ...cluster, kind: /** @type {const} */ ('conflict') }
            : cluster,
      );
      const conflicts = absorbed.filter(isRealSpacingConflict);
      const satellites = absorbed.filter((c) => !isRealSpacingConflict(c));
      if (!shouldKeepSeriesGroup([...conflicts, ...satellites])) {
        demoted.push(...conflicts);
        group.clusters = [];
        continue;
      }
      // 충돌 가나다 → 위성 가나다 (구간 안 가나다, 충돌을 위에)
      group.clusters = [
        ...sortClustersByKey(conflicts),
        ...sortClustersByKey(satellites),
      ];
      continue;
    }
    group.clusters = sortClustersByKey(
      normalizeSpacingClusters(group.clusters).filter(isRealSpacingConflict),
    );
  }

  if (demoted.length > 0) {
    let singles = groups.find((g) => g.type === 'single');
    if (!singles) {
      singles = { type: /** @type {const} */ ('single'), clusters: [] };
      groups.push(singles);
    }
    singles.clusters = sortClustersByKey(
      normalizeSpacingClusters([
        ...singles.clusters,
        ...demoted,
      ])
        .filter(isRealSpacingConflict)
        .filter((c) => !isUnifyListDroppedMonoJosaCluster(c)),
    );
  }

  const kept = sortClusterGroups(
    groups.filter((g) => {
      if (g.type === 'series') {
        g.clusters = g.clusters.filter(
          (c) => !isUnifyListDroppedMonoJosaCluster(c),
        );
        return shouldKeepSeriesGroup(g.clusters);
      }
      g.clusters = g.clusters.filter(
        (c) => !isUnifyListDroppedMonoJosaCluster(c),
      );
      return g.clusters.length > 0;
    }),
  );

  // 조사·어간 접미 검토 링크(자동 merge 없음, 전체 목록 기준)
  // bon-bojo stems 보조용언 추정 검토(자동 merge 없음)
  const hinted = attachAuxiliaryReviewHints(
    attachJosaReviewHints(kept.flatMap((g) => g.clusters)),
  );
  const byKey = new Map(hinted.map((c) => [c.key, c]));
  for (const group of kept) {
    group.clusters = group.clusters.map((c) => byKey.get(c.key) || c);
  }
  // `@` 채움말 다수결(보조·용언 vs 명사)로 계열 dictPos — 그다음 용언을 맨 아래로
  return splitPredicateSingles(markSeriesBySlotMajority(kept));
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
