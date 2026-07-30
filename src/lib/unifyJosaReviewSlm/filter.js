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
 * @param {UnifySpacingCluster[]} before
 * @param {UnifySpacingCluster[]} after
 * @param {{ cap?: number }} [opts]
 * @returns {{
 *   ran: true,
 *   droppedCap: number,
 *   rulePromoted: { id: string, label: string }[],
 *   slmConfirmed: { id: string, label: string }[],
 *   slmCleared: { id: string, label: string }[],
 *   capSkipped: { id: string, label: string }[],
 * }}
 */
export function summarizeJosaSlmRun(before, after, opts = {}) {
  const part = partitionJosaSlmQueue(before, opts);
  const afterByKey = new Map((after ?? []).map((c) => [c.key, c]));
  /** @param {UnifySpacingCluster} c */
  const item = (c) => ({
    id: c.key,
    label: c.josaReviewCandidate?.stemKey
      ? `${c.key} (…${c.josaReviewCandidate.suffix ?? ''})`
      : c.key,
  });

  const rulePromoted = [...part.high, ...part.low].map(item);
  /** @type {{ id: string, label: string }[]} */
  const slmConfirmed = [];
  /** @type {{ id: string, label: string }[]} */
  const slmCleared = [];
  for (const { cluster } of part.riskyForSlm) {
    const next = afterByKey.get(cluster.key);
    if (next?.josaReview?.status === 'review') slmConfirmed.push(item(cluster));
    else slmCleared.push(item(cluster));
  }
  const capSkipped = part.riskyDropped.map(item);

  return {
    ran: true,
    droppedCap: capSkipped.length,
    rulePromoted,
    slmConfirmed,
    slmCleared,
    capSkipped,
  };
}

/**
 * @param {{ clusters: import('../unifyCandidateDiscover.js').UnifySpacingCluster[] }[]} groups
 * @param {Parameters<typeof filterJosaReviewBySlm>[1]} [opts]
 * @returns {Promise<{
 *   groups: typeof groups,
 *   reviewedByKey: Map<string, import('../unifyCandidateDiscover.js').UnifySpacingCluster>,
 *   droppedCount: number,
 *   summary: ReturnType<typeof summarizeJosaSlmRun>,
 * }>}
 */
export async function runJosaSlmReviewOnClusterGroups(groups, opts = {}) {
  const flat = groups.flatMap((g) => g.clusters);
  const part = partitionJosaSlmQueue(flat, opts);
  const droppedCount = part.riskyDropped.length;
  const reviewed = await filterJosaReviewBySlm(flat, opts);
  const reviewedByKey = new Map(reviewed.map((c) => [c.key, c]));
  return {
    groups: mergeReviewedClustersIntoGroups(groups, reviewedByKey),
    reviewedByKey,
    droppedCount,
    summary: summarizeJosaSlmRun(flat, reviewed, opts),
  };
}
