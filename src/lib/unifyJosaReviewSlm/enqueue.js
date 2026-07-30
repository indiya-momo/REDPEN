/**
 * 조사·어간 SLM 큐 — 파티션·정렬·로컬 우선 필터.
 * @see project-docs/unify-josa-review-slm-sketch.md §5 · §6.0.1
 */

/** @typedef {import('../unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */

/**
 * 로컬·실사용 공통 상한 — 버튼/찾기 1회당 SLM에 넣는 최대 건수.
 * (CPU ~16초/건 기준 10건 ≈ 수분; GPU면 20초 SLA에 맞춤.)
 */
export const JOSA_SLM_BATCH_CAP = 10;

/** 조사 vs 합성어 오탐이 큰 접미 — stemMismatch와 함께 SLM 1순위 */
export const JOSA_SLM_PRIORITY_SUFFIXES = Object.freeze(['가', '이']);

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
 * SLM에 넣을 우선 후보인가 — stemMismatch 또는 접미 가/이.
 * @param {UnifySpacingCluster} cluster
 * @returns {boolean}
 */
export function isJosaSlmPriorityCandidate(cluster) {
  const cand = cluster?.josaReviewCandidate;
  if (!cand?.stemKey) return false;
  if (cand.stemMismatch) return true;
  const suffix = String(cand.suffix ?? '');
  return JOSA_SLM_PRIORITY_SUFFIXES.includes(suffix);
}

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
 * aux·tier·우선 필터 기준 josa SLM 파티션.
 * - high/low: SLM 생략, 규칙 배지
 * - priority risky (stemMismatch|가|이): SLM 큐, cap 초과 → riskyDropped(배지 없음)
 * - 그 외 risky: 파티션에 안 넣음 → 규칙이 준 josaReview 유지
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
  const priorityPool = [];

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
    } else if (isJosaSlmPriorityCandidate(cluster)) {
      priorityPool.push(cluster);
    }
    // 비우선 risky: 목록에 안 넣음 → filter가 기존 배지 유지
  }

  const sortedRisky = sortClustersForJosaSlmBatch(priorityPool);
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
