/**
 * 용언 2차 검토 큐 — 휴리스틱 용언만, auxReview 제외, cap.
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md
 */

import { looksLikePredicateKey } from '../unifyPredicateBucket.js';

/** @typedef {import('../unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */
/** @typedef {import('../unifyCandidateGrouping.js').ClusterGroup} ClusterGroup */

export const PREDICATE_SLM_BATCH_CAP = 10;

/**
 * @typedef {{
 *   id: string,
 *   kind: 'series' | 'cluster',
 *   stem: string,
 *   sampleVariant?: string,
 *   contextBefore?: string,
 *   contextAfter?: string,
 *   seriesAffixType?: string,
 *   seriesAffix?: string,
 *   clusterKey?: string,
 * }} PredicateSlmReviewRequest
 */

/**
 * @param {ClusterGroup} group
 * @returns {string}
 */
export function predicateSeriesTargetId(group) {
  return `series:${group.affixType}:${group.affix}`;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {boolean}
 */
function hasAuxReview(cluster) {
  return cluster?.auxReview?.status === 'review';
}

/**
 * @param {ClusterGroup} group
 * @returns {PredicateSlmReviewRequest | null}
 */
function buildSeriesRequest(group) {
  if (group.type !== 'series') return null;
  if (!looksLikePredicateKey(group.affix)) return null;
  const clusters = group.clusters ?? [];
  if (clusters.length > 0 && clusters.every(hasAuxReview)) return null;
  const sample = clusters.find((c) => !hasAuxReview(c)) || clusters[0];
  const spaced =
    sample?.variants?.find((v) => /\s/.test(v)) || sample?.key || group.affix;
  return {
    id: predicateSeriesTargetId(group),
    kind: 'series',
    stem: group.affix,
    sampleVariant: spaced,
    seriesAffixType: group.affixType,
    seriesAffix: group.affix,
  };
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {PredicateSlmReviewRequest | null}
 */
function buildClusterRequest(cluster) {
  if (hasAuxReview(cluster)) return null;
  const spaced =
    cluster.variants?.find((v) => /\s/.test(v)) || cluster.key;
  return {
    id: cluster.key,
    kind: 'cluster',
    stem: cluster.key,
    sampleVariant: spaced,
    clusterKey: cluster.key,
  };
}

/**
 * @param {ClusterGroup[]} groups
 * @param {{ cap?: number }} [opts]
 * @returns {{
 *   forSlm: PredicateSlmReviewRequest[],
 *   cappedOut: PredicateSlmReviewRequest[],
 * }}
 */
export function enqueuePredicateSlmTargets(groups, opts = {}) {
  const cap = opts.cap ?? PREDICATE_SLM_BATCH_CAP;
  /** @type {PredicateSlmReviewRequest[]} */
  const all = [];

  for (const group of groups ?? []) {
    if (group.type === 'series') {
      const req = buildSeriesRequest(group);
      if (req) all.push(req);
      continue;
    }
    if (group.type === 'predicate') {
      for (const cluster of group.clusters ?? []) {
        const req = buildClusterRequest(cluster);
        if (req) all.push(req);
      }
    }
  }

  return {
    forSlm: all.slice(0, cap),
    cappedOut: all.slice(cap),
  };
}
