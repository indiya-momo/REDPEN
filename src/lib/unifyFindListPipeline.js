/**
 * 표기 통일 추천 — 목록 그룹 조립 파이프라인 (찾기 완료 후 재조합과 공유).
 * ruleEngine / spelling 매칭과 무관.
 */

import {
  enrichClusterGroupsWithItemHits,
  enrichClusterGroupsWithItemHitsAsync,
} from './unifyCandidateDiscover.js';
import {
  groupSortAndFillSatellites,
  sortClusterGroups,
} from './unifyCandidateGrouping.js';
import { filterSeriesSatellitesByMorphPos } from './unifyCandidateSatellites.js';
import { stripDependentNounGenitiveFromGroups } from './unifyDependentNounGenitive.js';
import { mergeReviewedClustersIntoGroups } from './unifyJosaReviewSlm/index.js';
import { dropJosaPlusPredicateFromGroups } from './unifyPredicateBucket.js';
import { applyPredicateSlmDropsToGroups } from './unifyPredicateReviewSlm/index.js';
import { applyStdictPosMarksToGroups } from './unifyStdictPos.js';

/**
 * @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 * @typedef {import('./unifyCandidateGrouping.js').ClusterGroup} ClusterGroup
 *
 * @typedef {{
 *   slmReviewedByKey?: Map<string, UnifySpacingCluster>,
 *   stdictPredicateSeriesIds?: string[],
 *   stdictPredicateClusterKeys?: string[],
 *   predicateDropSeriesIds?: string[],
 *   predicateDropClusterKeys?: string[],
 *   predicateNeedsReviewByKey?: Map<string, { status: 'needs_review' }>,
 * }} UnifyListReviewMarks
 */

/**
 * 리뷰 마크를 그룹에 적용 (strip 이후 ~ enrich 직전).
 * @param {ClusterGroup[]} groups
 * @param {UnifyListReviewMarks} [marks]
 * @returns {ClusterGroup[]}
 */
export function applyUnifyListReviewMarks(groups, marks = {}) {
  const {
    slmReviewedByKey = new Map(),
    stdictPredicateSeriesIds = [],
    stdictPredicateClusterKeys = [],
    predicateDropSeriesIds = [],
    predicateDropClusterKeys = [],
    predicateNeedsReviewByKey = new Map(),
  } = marks;

  const withJosa = mergeReviewedClustersIntoGroups(groups, slmReviewedByKey);
  const withStdict = applyStdictPosMarksToGroups(withJosa, {
    seriesIds: stdictPredicateSeriesIds,
    clusterKeys: stdictPredicateClusterKeys,
  });
  const withMorphSat = filterSeriesSatellitesByMorphPos(withStdict);
  const withoutJosaPred = dropJosaPlusPredicateFromGroups(withMorphSat, {
    stdictPredicateKeys: stdictPredicateClusterKeys,
  });
  return applyPredicateSlmDropsToGroups(
    withoutJosaPred,
    {
      seriesIds: predicateDropSeriesIds,
      clusterKeys: predicateDropClusterKeys,
    },
    predicateNeedsReviewByKey,
  );
}

/**
 * item 재집계 → 위성 morph → 발견 순 정렬.
 * @param {ClusterGroup[]} groups
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {ClusterGroup[]}
 */
export function finalizeUnifyListGroups(groups, pageTexts) {
  return sortClusterGroups(
    filterSeriesSatellitesByMorphPos(
      enrichClusterGroupsWithItemHits(groups, pageTexts),
    ),
  );
}

/**
 * @param {ClusterGroup[]} groups
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {Promise<ClusterGroup[]>}
 */
export async function finalizeUnifyListGroupsAsync(groups, pageTexts) {
  const enriched = await enrichClusterGroupsWithItemHitsAsync(
    groups,
    pageTexts,
  );
  return sortClusterGroups(filterSeriesSatellitesByMorphPos(enriched));
}

/**
 * clusters+raw+리뷰 마크 → 목록에 올릴 그룹 (동기, useMemo 경로).
 * @param {UnifySpacingCluster[]} clusters
 * @param {Map<string, import('./unifyCandidateDiscover.js').ClusterAcc> | null} rawByKey
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {UnifyListReviewMarks} [marks]
 * @returns {ClusterGroup[]}
 */
export function buildUnifyListGroups(
  clusters,
  rawByKey,
  pageTexts,
  marks = {},
) {
  if (!rawByKey) return [];
  const base = groupSortAndFillSatellites(clusters, rawByKey);
  const stripped = stripDependentNounGenitiveFromGroups(base).groups;
  const marked = applyUnifyListReviewMarks(stripped, marks);
  return finalizeUnifyListGroups(marked, pageTexts);
}
