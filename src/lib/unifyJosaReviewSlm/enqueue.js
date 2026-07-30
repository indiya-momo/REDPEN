/**
 * 조사·어간 SLM 큐 — 단계 0: 파티션·정렬만 (맥락·프롬프트 없음).
 * @see project-docs/unify-josa-review-slm-sketch.md §5
 */

/** @typedef {import('../unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */

export const JOSA_SLM_BATCH_CAP = 50;

/**
 * @typedef {{
 *   cluster: UnifySpacingCluster,
 *   tier: 'risky',
 * }} JosaSlmQueuedCluster
 */

/**
 * @typedef {{
 *   excludedAux: UnifySpacingCluster[],
 *   high: UnifySpacingCluster[],
 *   low: UnifySpacingCluster[],
 *   riskyForSlm: JosaSlmQueuedCluster[],
 *   riskyDropped: UnifySpacingCluster[],
 * }} JosaSlmPartition
 */

/**
 * SLM risky 큐 정렬 — totalCount ↓, key 가나다 (재현성).
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function sortClustersForJosaSlmBatch(clusters) {
  return [...clusters].toSorted((a, b) => {
    const countDiff = (b.totalCount ?? 0) - (a.totalCount ?? 0);
    if (countDiff !== 0) return countDiff;
    return String(a.key ?? '').localeCompare(String(b.key ?? ''), 'ko');
  });
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {boolean}
 */
function hasJosaReviewCandidate(cluster) {
  return Boolean(cluster.josaReviewCandidate?.stemKey);
}

/**
 * aux·tier 기준으로 josa SLM 파티션.
 * @param {UnifySpacingCluster[]} clusters
 * @param {{ cap?: number }} [opts]
 * @returns {JosaSlmPartition}
 */
export function partitionJosaSlmQueue(clusters, opts = {}) {
  const cap = opts.cap ?? JOSA_SLM_BATCH_CAP;
  /** @type {JosaSlmPartition} */
  const out = {
    excludedAux: [],
    high: [],
    low: [],
    riskyForSlm: [],
    riskyDropped: [],
  };

  /** @type {UnifySpacingCluster[]} */
  const riskyPool = [];

  for (const cluster of clusters) {
    if (cluster.auxReview?.status === 'review') {
      out.excludedAux.push(cluster);
      continue;
    }
    if (!hasJosaReviewCandidate(cluster)) continue;

    const tier = cluster.josaReviewCandidate?.tier ?? 'risky';
    if (tier === 'high') {
      out.high.push(cluster);
    } else if (tier === 'low') {
      out.low.push(cluster);
    } else {
      riskyPool.push(cluster);
    }
  }

  const sortedRisky = sortClustersForJosaSlmBatch(riskyPool);
  for (let i = 0; i < sortedRisky.length; i += 1) {
    const cluster = sortedRisky[i];
    if (i < cap) {
      out.riskyForSlm.push({ cluster, tier: 'risky' });
    } else {
      out.riskyDropped.push(cluster);
    }
  }

  return out;
}
