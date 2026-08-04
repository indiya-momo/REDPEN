/**
 * 표기 통일 추천 — 클러스터 정렬 + 계열(prefix/suffix) 그룹핑.
 *
 * 목록 순서 (합의):
 * 1) 단일 항목 — **이형태가 양쪽 모두 1회+** 우선, 그다음 발견 횟수 ↓, 동률이면 가나다
 * 2) 접두 계열(○○@) — 계열 합계 발견 ↓, 동률이면 affix 가나다 / 안도 동일
 * 3) 접미 계열(@○○) — 동일
 * 4) 용언 — 단일 추정 + 접두·접미 용언 계열, 안은 발견 ↓·가나다
 */

import {
  extractPrefixes,
  extractSuffixes,
  SERIES_MIN_CLUSTER_COUNT,
  isExcludedSeriesAffix,
} from './unifyCandidateSeriesTrend.js';
import { normalizeSpacingClusters } from './unifyCandidateCollapse.js';
import {
  clusterBelongsToSeriesAffix,
  fillSeriesSatellites,
  filterSeriesSatellitesByMorphPos,
} from './unifyCandidateSatellites.js';
import { attachJosaReviewHints, isUnifyListDroppedMonoJosaCluster } from './unifyJosaReview.js';
import { attachAuxiliaryReviewHints } from './unifyAuxReview.js';
import {
  isUnifyPredicateCluster,
  looksLikePredicateKey,
  dropJosaPlusPredicateFromGroups,
  isUnifyJosaGluedNoiseKey,
} from './unifyPredicateBucket.js';
import {
  markSeriesBySlotMajority,
  isExcludedSeriesSlotFiller,
  isUnifyListDroppedMonoSlotCluster,
} from './unifyListStemTriage.js';

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
 * 목록 아코디언 행 수 — 단일·용언은 클러스터마다 1, 계열은 그룹당 1.
 * @param {ClusterGroup[]} groups
 * @returns {number}
 */
export function countUnifyListAccordionItems(groups) {
  let n = 0;
  for (const g of groups ?? []) {
    if (g.type === 'single' || g.type === 'predicate') {
      n += (g.clusters ?? []).length;
    } else if ((g.clusters ?? []).length > 0) {
      n += 1;
    }
  }
  return n;
}

/**
 * @param {UnifySpacingCluster} cluster
 */
function clusterFindings(cluster) {
  return cluster?.totalCount ?? 0;
}

/**
 * 붙여쓰기·띄어쓰기 이형태가 각각 1회 이상 있는지 (0회 위성만 있는 항목보다 앞).
 * @param {UnifySpacingCluster} cluster
 * @returns {boolean}
 */
export function clusterHasDualFormFindings(cluster) {
  const counts = cluster?.counts ?? {};
  let hasGlued = false;
  let hasSpaced = false;
  for (const [variant, n] of Object.entries(counts)) {
    if ((n ?? 0) <= 0) continue;
    if (/\s/.test(variant)) hasSpaced = true;
    else hasGlued = true;
    if (hasGlued && hasSpaced) return true;
  }
  return false;
}

/**
 * @param {ClusterGroup} group
 */
function groupFindings(group) {
  return (group?.clusters ?? []).reduce(
    (sum, c) => sum + clusterFindings(c),
    0,
  );
}

/**
 * 이형태 양쪽 출현 우선 → 발견 횟수 ↓ → 키 가나다.
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function sortClustersByFindingsThenKey(clusters) {
  return [...clusters].sort((a, b) => {
    const dual =
      Number(clusterHasDualFormFindings(b)) -
      Number(clusterHasDualFormFindings(a));
    if (dual !== 0) return dual;
    const d = clusterFindings(b) - clusterFindings(a);
    if (d !== 0) return d;
    return String(a.key ?? '').localeCompare(String(b.key ?? ''), 'ko');
  });
}

/** @deprecated 가나다만 — {@link sortClustersByFindingsThenKey} 사용 */
function sortClustersByKey(clusters) {
  return sortClustersByFindingsThenKey(clusters);
}

/**
 * 단일 → ○○@ → @○○ → 용언.
 * 같은 구간: 발견 합계(또는 항목 횟수) ↓, 동률이면 affix/키 가나다.
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
    .map((g) => ({ ...g, clusters: sortClustersByFindingsThenKey(g.clusters) }))
    .filter((g) => g.clusters.length > 0)
    .sort((a, b) => {
      const o = section(a) - section(b);
      if (o !== 0) return o;
      // 용언 구간: 「용언」단일 묶음 → 용언 계열
      if (section(a) === 3) {
        const aSeries = a.type === 'series' ? 1 : 0;
        const bSeries = b.type === 'series' ? 1 : 0;
        if (aSeries !== bSeries) return aSeries - bSeries;
      }
      const findDiff = groupFindings(b) - groupFindings(a);
      if (findDiff !== 0) return findDiff;
      if (a.type === 'series' && b.type === 'series') {
        return a.affix.localeCompare(b.affix, 'ko');
      }
      return 0;
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
 * 접두(`affix@`)·접미(`@affix`) 후보를 각각 만든 뒤, 멤버가 많은 계열부터 배정.
 * 동률이면 접두(`어쩌고@`) 우선. 클러스터는 한 계열에만 속한다.
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
  /** @type {Map<string, Set<number>>} */
  const suffixMembers = new Map();

  for (let i = 0; i < sorted.length; i++) {
    for (const p of extractPrefixes(sorted[i].key, sorted[i].variants)) {
      if (!clusterBelongsToSeriesAffix(sorted[i], p, 'prefix')) continue;
      // 금융@ — @ 채움이 단음절(금융업·금융학)이면 처음부터 넣지 않음
      if (isExcludedSeriesSlotFiller(sorted[i], p, 'prefix')) continue;
      if (!prefixMembers.has(p)) prefixMembers.set(p, new Set());
      prefixMembers.get(p).add(i);
    }
    for (const s of extractSuffixes(sorted[i].key, sorted[i].variants)) {
      if (!clusterBelongsToSeriesAffix(sorted[i], s, 'suffix')) continue;
      if (isExcludedSeriesSlotFiller(sorted[i], s, 'suffix')) continue;
      if (!suffixMembers.has(s)) suffixMembers.set(s, new Set());
      suffixMembers.get(s).add(i);
    }
  }

  /**
   * @typedef {{
   *   affix: string,
   *   affixType: 'prefix' | 'suffix',
   *   label: string,
   *   members: number[],
   * }} SeriesCandidate
   */

  /** @type {SeriesCandidate[]} */
  const candidates = [];
  for (const [affix, set] of prefixMembers) {
    // 숫자·조사+용언 affix / 계열 최소 음절 미달 affix는 후보에서 제외
    if (
      isExcludedSeriesAffix(affix) ||
      isUnifyJosaGluedNoiseKey(affix, { asSeriesAffix: true })
    ) {
      continue;
    }
    const members = [...set];
    if (members.length < minSeriesMembers) continue;
    candidates.push({
      affix,
      affixType: 'prefix',
      label: `${affix}@`,
      members,
    });
  }
  for (const [affix, set] of suffixMembers) {
    if (
      isExcludedSeriesAffix(affix) ||
      isUnifyJosaGluedNoiseKey(affix, { asSeriesAffix: true })
    ) {
      continue;
    }
    const members = [...set];
    if (members.length < minSeriesMembers) continue;
    candidates.push({
      affix,
      affixType: 'suffix',
      label: `@${affix}`,
      members,
    });
  }

  // 멤버 많은 순 → 동률이면 접두 우선 → affix 가나다
  candidates.sort((a, b) => {
    if (b.members.length !== a.members.length) {
      return b.members.length - a.members.length;
    }
    if (a.affixType !== b.affixType) {
      return a.affixType === 'prefix' ? -1 : 1;
    }
    return a.affix.localeCompare(b.affix, 'ko');
  });

  const assigned = new Set();
  /** @type {ClusterGroup[]} */
  const groups = [];

  for (const cand of candidates) {
    const free = cand.members.filter((i) => !assigned.has(i));
    if (free.length < minSeriesMembers) continue;
    for (const i of free) assigned.add(i);
    groups.push({
      type: /** @type {const} */ ('series'),
      affix: cand.affix,
      affixType: cand.affixType,
      label: cand.label,
      clusters: sortClustersByKey(free.map((i) => sorted[i])),
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
  //    · 어간+뿐/을/를/은/는/이/가 단음절만 다른 충돌은 목록에서 제외
  //    · @+조사+용언(을하다·역할을하다)도 목록에 넣지 않음
  //    · 금융 업·금융 학처럼 @ 채움이 단음절인 표는 처음부터 제외
  const normalized = normalizeSpacingClusters(clusters)
    .filter(isRealSpacingConflict)
    .filter((c) => !isUnifyListDroppedMonoJosaCluster(c))
    .filter((c) => !isUnifyJosaGluedNoiseKey(c.key))
    .filter((c) => !isUnifyListDroppedMonoSlotCluster(c));
  let groups = groupAndSortClusters(normalized, { minSeriesMembers: 1 });

  // 2) @ 후보에 1회 위성 편입 (세계경제만 있어도 세계 시장 위성 가능)
  groups = fillSeriesSatellites(groups, normalized, rawByKey ?? new Map());

  /** @type {UnifySpacingCluster[]} */
  const demoted = [];

  for (const group of groups) {
    if (group.type === 'series') {
      // 위성 편입 후 — 짧은 공통 단위로 합침 (둔화다·둔화라→둔화, 부양금·부양책→부양)
      // @ 채움 단음절(금융업·금융학)은 계열·목록에 남기지 않음
      const absorbed = normalizeSpacingClusters(group.clusters)
        .filter(
          (c) =>
            !isExcludedSeriesSlotFiller(c, group.affix, group.affixType),
        )
        .map((cluster) =>
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
      // 발견 횟수 ↓ → 동률 가나다 (충돌·위성 구분 없이)
      group.clusters = sortClustersByFindingsThenKey(absorbed);
      continue;
    }
    group.clusters = sortClustersByFindingsThenKey(
      normalizeSpacingClusters(group.clusters).filter(isRealSpacingConflict),
    );
  }

  if (demoted.length > 0) {
    let singles = groups.find((g) => g.type === 'single');
    if (!singles) {
      singles = { type: /** @type {const} */ ('single'), clusters: [] };
      groups.push(singles);
    }
    singles.clusters = sortClustersByFindingsThenKey(
      normalizeSpacingClusters([
        ...singles.clusters,
        ...demoted,
      ])
        .filter(isRealSpacingConflict)
        .filter((c) => !isUnifyListDroppedMonoJosaCluster(c))
        .filter((c) => !isUnifyJosaGluedNoiseKey(c.key))
        .filter((c) => !isUnifyListDroppedMonoSlotCluster(c)),
    );
  }

  const kept = sortClusterGroups(
    groups.filter((g) => {
      if (g.type === 'series') {
        // 숫자·조사+용언 affix 계열은 유지하지 않음
        if (
          isExcludedSeriesAffix(g.affix) ||
          isUnifyJosaGluedNoiseKey(g.affix, { asSeriesAffix: true })
        ) {
          return false;
        }
        g.clusters = g.clusters.filter(
          (c) =>
            !isUnifyListDroppedMonoJosaCluster(c) &&
            !isUnifyJosaGluedNoiseKey(c.key) &&
            !isExcludedSeriesSlotFiller(c, g.affix, g.affixType),
        );
        return shouldKeepSeriesGroup(g.clusters);
      }
      g.clusters = g.clusters.filter(
        (c) =>
          !isUnifyListDroppedMonoJosaCluster(c) &&
          !isUnifyJosaGluedNoiseKey(c.key) &&
          !isUnifyListDroppedMonoSlotCluster(c),
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
  // dictPos 붙은 계열만 위성 띄움 동종 복합(명사+명사 / 동사+동사) 검증
  // 용언 구간: @+조사+용언(을하다·역할을하다) 제외
  return dropJosaPlusPredicateFromGroups(
    splitPredicateSingles(
      filterSeriesSatellitesByMorphPos(markSeriesBySlotMajority(kept)),
    ),
  );
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
