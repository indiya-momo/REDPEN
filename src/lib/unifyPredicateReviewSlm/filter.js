/**
 * 용언 2차 필터 — enqueue → runner → 그룹에서 제외·검토 표시.
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md
 */

import {
  enqueuePredicateSlmTargets,
  predicateSeriesTargetId,
} from './enqueue.js';
import {
  shouldDropAsNonPredicate,
  shouldMarkPredicateNeedsReview,
} from './parse.js';
import { noopPredicateRunner } from './runner/noopRunner.js';

/** @typedef {import('../unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */
/** @typedef {import('../unifyCandidateGrouping.js').ClusterGroup} ClusterGroup */
/** @typedef {import('./parse.js').PredicateSlmReviewResult} PredicateSlmReviewResult */
/** @typedef {import('./runner/noopRunner.js').PredicateSlmRunner} PredicateSlmRunner */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 * }} PredicateSlmSummaryItem
 */

/**
 * @typedef {{
 *   reviewed: number,
 *   dropped: PredicateSlmSummaryItem[],
 *   kept: PredicateSlmSummaryItem[],
 *   needsReview: PredicateSlmSummaryItem[],
 * }} PredicateSlmRunSummary
 */

/**
 * @typedef {{
 *   seriesIds: string[],
 *   clusterKeys: string[],
 * }} PredicateSlmDropSet
 */

/**
 * @param {ClusterGroup[]} groups
 * @param {PredicateSlmDropSet} drop
 * @param {Map<string, { status: 'needs_review' }>} needsReviewByClusterKey
 * @returns {ClusterGroup[]}
 */
export function applyPredicateSlmDropsToGroups(
  groups,
  drop,
  needsReviewByClusterKey,
) {
  const seriesDrop = new Set(drop.seriesIds ?? []);
  const keyDrop = new Set(drop.clusterKeys ?? []);

  /** @type {ClusterGroup[]} */
  const out = [];
  for (const group of groups ?? []) {
    if (group.type === 'series') {
      const id = predicateSeriesTargetId(group);
      if (seriesDrop.has(id)) continue;
      if (needsReviewByClusterKey?.size) {
        out.push({
          ...group,
          clusters: group.clusters.map((c) => {
            const hint = needsReviewByClusterKey.get(c.key);
            if (!hint) return c;
            return { ...c, predicateReview: hint };
          }),
        });
      } else {
        out.push(group);
      }
      continue;
    }
    if (group.type === 'predicate') {
      const clusters = group.clusters
        .filter((c) => !keyDrop.has(c.key))
        .map((c) => {
          const hint = needsReviewByClusterKey.get(c.key);
          if (!hint) return c;
          return { ...c, predicateReview: hint };
        });
      if (clusters.length === 0) continue;
      out.push({ ...group, clusters });
      continue;
    }
    out.push(group);
  }
  return out;
}

/**
 * @param {ClusterGroup[]} groups
 * @param {Set<string>} seriesIds
 * @param {Set<string>} clusterKeys
 * @returns {ClusterGroup[]}
 */
export function filterGroupsByPredicateDrops(groups, seriesIds, clusterKeys) {
  return applyPredicateSlmDropsToGroups(
    groups,
    {
      seriesIds: [...seriesIds],
      clusterKeys: [...clusterKeys],
    },
    new Map(),
  );
}

/**
 * @param {ClusterGroup[]} groups
 * @param {{
 *   cap?: number,
 *   runner?: PredicateSlmRunner,
 *   runnerOpts?: { mode?: 'predicate' | 'non_predicate' | 'fail' },
 * }} [opts]
 * @returns {Promise<{
 *   groups: ClusterGroup[],
 *   drop: PredicateSlmDropSet,
 *   needsReviewByClusterKey: Map<string, { status: 'needs_review' }>,
 *   summary: PredicateSlmRunSummary,
 * }>}
 */
export async function runPredicateSlmReviewOnClusterGroups(groups, opts = {}) {
  const runner = opts.runner ?? noopPredicateRunner;
  const { forSlm, cappedOut } = enqueuePredicateSlmTargets(groups, {
    cap: opts.cap,
  });

  /** @type {PredicateSlmSummaryItem[]} */
  const dropped = [];
  /** @type {PredicateSlmSummaryItem[]} */
  const kept = [];
  /** @type {PredicateSlmSummaryItem[]} */
  const needsReview = [];
  /** @type {string[]} */
  const seriesIds = [];
  /** @type {string[]} */
  const clusterKeys = [];
  /** @type {Map<string, { status: 'needs_review' }>} */
  const needsReviewByClusterKey = new Map();

  /**
   * @param {import('./enqueue.js').PredicateSlmReviewRequest} req
   * @param {PredicateSlmReviewResult | null | undefined} result
   */
  function applyOne(req, result) {
    const label = req.stem;
    if (shouldDropAsNonPredicate(result)) {
      dropped.push({ id: req.id, label });
      if (req.kind === 'series') seriesIds.push(req.id);
      else if (req.clusterKey) clusterKeys.push(req.clusterKey);
      return;
    }
    if (shouldMarkPredicateNeedsReview(result)) {
      needsReview.push({ id: req.id, label });
      markNeedsReview(req);
      return;
    }
    kept.push({ id: req.id, label });
  }

  /**
   * @param {import('./enqueue.js').PredicateSlmReviewRequest} req
   */
  function markNeedsReview(req) {
    if (req.kind === 'series') {
      const group = groups.find(
        (g) =>
          g.type === 'series' &&
          predicateSeriesTargetId(g) === req.id,
      );
      for (const c of group?.clusters ?? []) {
        needsReviewByClusterKey.set(c.key, { status: 'needs_review' });
      }
      return;
    }
    if (req.clusterKey) {
      needsReviewByClusterKey.set(req.clusterKey, { status: 'needs_review' });
    }
  }

  for (const req of cappedOut) {
    needsReview.push({ id: req.id, label: req.stem });
    markNeedsReview(req);
  }

  if (forSlm.length) {
    const results = await runner.reviewBatch(forSlm, opts.runnerOpts);
    /** @type {Map<string, PredicateSlmReviewResult>} */
    const byId = new Map();
    for (const r of results) {
      if (r?.id) byId.set(r.id, r);
    }
    for (const req of forSlm) {
      applyOne(req, byId.get(req.id));
    }
  }

  const drop = { seriesIds, clusterKeys };
  const nextGroups = applyPredicateSlmDropsToGroups(
    groups,
    drop,
    needsReviewByClusterKey,
  );

  return {
    groups: nextGroups,
    drop,
    needsReviewByClusterKey,
    summary: {
      reviewed: forSlm.length,
      dropped,
      kept,
      needsReview,
    },
  };
}
