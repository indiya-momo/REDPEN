/**
 * SLM 2차 필터 — partition → runner → josaReview 승격/제거.
 * @see project-docs/unify-josa-review-slm-sketch.md §6
 */

import { partitionJosaSlmQueue } from './enqueue.js';
import { buildJosaSlmContextForCluster } from './context.js';
import { shouldPromoteJosaReview } from './parse.js';
import { noopRunner } from './runner/noopRunner.js';

/** @typedef {import('../unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */
/** @typedef {import('./parse.js').JosaSlmReviewResult} JosaSlmReviewResult */
/** @typedef {import('./runner/noopRunner.js').JosaSlmRunner} JosaSlmRunner */

/**
 * @typedef {{
 *   id: string,
 *   variant: string,
 *   gluedVariant: string,
 *   ruleStem: string,
 *   ruleSuffix: string,
 *   contextBefore?: string,
 *   contextAfter?: string,
 * }} JosaSlmReviewRequest
 */

/**
 * @param {UnifySpacingCluster} cluster
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} [pageTexts]
 * @returns {JosaSlmReviewRequest | null}
 */
export function buildJosaSlmReviewRequest(cluster, pageTexts) {
  const candidate = cluster.josaReviewCandidate;
  if (!candidate?.stemKey) return null;
  const spaced =
    cluster.variants?.find((v) => /\s/.test(v) && (cluster.counts?.[v] ?? 0) > 0) ||
    cluster.variants?.find((v) => /\s/.test(v)) ||
    '';
  const glued =
    cluster.variants?.find((v) => !/\s/.test(v) && (cluster.counts?.[v] ?? 0) > 0) ||
    cluster.variants?.find((v) => !/\s/.test(v)) ||
    cluster.key ||
    '';
  const context = pageTexts?.length
    ? buildJosaSlmContextForCluster(cluster, pageTexts)
    : { contextBefore: '', contextAfter: '' };
  return {
    id: cluster.key,
    variant: spaced || glued,
    gluedVariant: glued,
    ruleStem: candidate.stemKey,
    ruleSuffix: candidate.suffix,
    contextBefore: context.contextBefore,
    contextAfter: context.contextAfter,
  };
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {{ model?: string }} [slmMeta]
 * @returns {UnifySpacingCluster}
 */
function promoteJosaReviewFromCandidate(cluster, slmMeta = {}) {
  const candidate = cluster.josaReviewCandidate;
  if (!candidate) return cluster;
  return {
    ...cluster,
    josaReview: {
      stemKey: candidate.stemKey,
      peerKeys: candidate.peerKeys ?? [],
      status: 'review',
      // josaReview 승격 시점 = high 확정. medium/low는 여기 오기 전에 걸러짐.
      ...(slmMeta.model ? { slm: { model: slmMeta.model, confidence: 'high' } } : {}),
    },
  };
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {UnifySpacingCluster}
 */
function stripJosaReview(cluster) {
  if (!cluster.josaReview) return cluster;
  const { josaReview: _drop, ...rest } = cluster;
  return rest;
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @param {{
 *   cap?: number,
 *   pageTexts?: { pageNum?: number, text?: string, textLayout?: string }[],
 *   runner?: JosaSlmRunner,
 *   slmModel?: string,
 *   runnerOpts?: { mode?: 'approve' | 'reject' },
 * }} [opts]
 * @returns {Promise<UnifySpacingCluster[]>}
 */
export async function filterJosaReviewBySlm(clusters, opts = {}) {
  if (!clusters?.length) return clusters;

  const runner = opts.runner ?? noopRunner;
  const part = partitionJosaSlmQueue(clusters, opts);
  const order = clusters.map((c) => c.key);
  /** @type {Map<string, UnifySpacingCluster>} */
  const byKey = new Map(clusters.map((c) => [c.key, { ...c }]));

  for (const cluster of part.high) {
    byKey.set(cluster.key, promoteJosaReviewFromCandidate(byKey.get(cluster.key)));
  }
  for (const cluster of part.low) {
    byKey.set(cluster.key, promoteJosaReviewFromCandidate(byKey.get(cluster.key)));
  }
  for (const cluster of part.riskyDropped) {
    byKey.set(cluster.key, stripJosaReview(byKey.get(cluster.key)));
  }

  /** @type {JosaSlmReviewRequest[]} */
  const requests = [];
  for (const { cluster } of part.riskyForSlm) {
    byKey.set(cluster.key, stripJosaReview(byKey.get(cluster.key)));
    const req = buildJosaSlmReviewRequest(byKey.get(cluster.key), opts.pageTexts);
    if (req) requests.push(req);
  }

  if (requests.length) {
    const results = await runner.reviewBatch(requests, opts.runnerOpts);
    /** @type {Map<string, JosaSlmReviewResult>} */
    const byId = new Map();
    for (const raw of results) {
      if (raw?.id) byId.set(raw.id, raw);
    }
    for (const req of requests) {
      const result = byId.get(req.id);
      if (!shouldPromoteJosaReview(result)) continue;
      const cluster = byKey.get(req.id);
      if (!cluster) continue;
      byKey.set(
        req.id,
        promoteJosaReviewFromCandidate(cluster, { model: opts.slmModel }),
      );
    }
  }

  return order.map((key) => byKey.get(key)).filter(Boolean);
}

/**
 * @param {{ clusters: import('../unifyCandidateDiscover.js').UnifySpacingCluster[] }[]} groups
 * @param {Map<string, import('../unifyCandidateDiscover.js').UnifySpacingCluster>} reviewedByKey
 */
export function mergeReviewedClustersIntoGroups(groups, reviewedByKey) {
  if (!reviewedByKey?.size) return groups;
  return groups.map((group) => ({
    ...group,
    clusters: group.clusters.map((c) => reviewedByKey.get(c.key) ?? c),
  }));
}

/**
 * @param {{ clusters: import('../unifyCandidateDiscover.js').UnifySpacingCluster[] }[]} groups
 * @param {Parameters<typeof filterJosaReviewBySlm>[1]} [opts]
 * @returns {Promise<{
 *   groups: typeof groups,
 *   reviewedByKey: Map<string, import('../unifyCandidateDiscover.js').UnifySpacingCluster>,
 *   droppedCount: number,
 * }>}
 */
export async function runJosaSlmReviewOnClusterGroups(groups, opts = {}) {
  const flat = groups.flatMap((g) => g.clusters);
  const droppedCount = partitionJosaSlmQueue(flat, opts).riskyDropped.length;
  const reviewed = await filterJosaReviewBySlm(flat, opts);
  const reviewedByKey = new Map(reviewed.map((c) => [c.key, c]));
  return {
    groups: mergeReviewedClustersIntoGroups(groups, reviewedByKey),
    reviewedByKey,
    droppedCount,
  };
}
