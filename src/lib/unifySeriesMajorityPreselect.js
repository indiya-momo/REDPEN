/**
 * 1차 찾기 직후 — 계열만 soft 미리 찍기.
 * 붙임/띄움 한쪽 ≥80% 이고, 목록 전체 발견 횟수에서 합 < cut(동률 cut 제외).
 */

/** @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */

/** @typedef {{
 *   type: 'series' | 'single',
 *   clusters?: UnifySpacingCluster[],
 *   affix?: string,
 *   affixType?: string,
 * }} ClusterGroupLike */

export const SERIES_MAJORITY_PRESELECT_RATIO = 0.8;

/**
 * 클러스터들의 붙임·띄움 출현 합 (선택 전 원시 counts).
 * @param {UnifySpacingCluster[] | null | undefined} clusters
 * @returns {{ glued: number, spaced: number, total: number }}
 */
export function sumGroupSpacingFindings(clusters) {
  let glued = 0;
  let spaced = 0;
  for (const c of clusters ?? []) {
    for (const [variant, n] of Object.entries(c?.counts ?? {})) {
      const v = Number(n) || 0;
      if (v <= 0) continue;
      if (/\s/.test(variant)) spaced += v;
      else glued += v;
    }
  }
  return { glued, spaced, total: glued + spaced };
}

/**
 * 목록 전체 발견 합의 cut — 이 값 **미만**만 하위 절반.
 * 동률(합 === cut)은 제외.
 * @param {number[]} totals
 * @returns {number}
 */
export function exclusiveBottomHalfCut(totals) {
  const nums = (totals ?? [])
    .map((n) => Number(n) || 0)
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * @param {number} glued
 * @param {number} spaced
 * @param {number} [ratio]
 * @returns {'glued' | 'spaced' | null}
 */
export function pickDominantSpacing(
  glued,
  spaced,
  ratio = SERIES_MAJORITY_PRESELECT_RATIO,
) {
  const total = (Number(glued) || 0) + (Number(spaced) || 0);
  if (total <= 0) return null;
  if (glued / total >= ratio) return 'glued';
  if (spaced / total >= ratio) return 'spaced';
  return null;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {'glued' | 'spaced'} spacing
 * @returns {string | undefined}
 */
export function variantForSpacing(cluster, spacing) {
  return (cluster?.variants ?? []).find((v) =>
    spacing === 'glued' ? !/\s/.test(v) : /\s/.test(v),
  );
}

/**
 * 조건에 맞는 계열의 key → 표기(soft 등록용).
 * @param {ClusterGroupLike[] | null | undefined} groups
 * @returns {Map<string, string>}
 */
export function buildSeriesMajoritySoftPreselect(groups) {
  /** @type {Map<string, string>} */
  const out = new Map();
  const list = groups ?? [];
  if (!list.length) return out;

  const totals = list.map((g) => sumGroupSpacingFindings(g.clusters).total);
  const cut = exclusiveBottomHalfCut(totals);

  for (const group of list) {
    if (group?.type !== 'series') continue;
    const { glued, spaced, total } = sumGroupSpacingFindings(group.clusters);
    if (!(total < cut)) continue;
    const spacing = pickDominantSpacing(glued, spaced);
    if (!spacing) continue;
    for (const c of group.clusters ?? []) {
      const key = c?.key;
      if (!key) continue;
      const v = variantForSpacing(c, spacing);
      if (v) out.set(key, v);
    }
  }
  return out;
}
