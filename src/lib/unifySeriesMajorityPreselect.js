/**
 * 1차 찾기 직후 — 계열만 soft 미리 찍기.
 * 붙임/띄움 한쪽 ≥80%이면 해당 계열 전체 soft.
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
  for (const group of groups ?? []) {
    if (group?.type !== 'series') continue;
    const { glued, spaced } = sumGroupSpacingFindings(group.clusters);
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

/**
 * 2차 계열 — 패턴 규칙 방향(1차 통일형)을 1차 soft와 같은 chosen 맵으로.
 * 엑셀 tip·PDF가 「문서 내」가 아니라 「…으로 통일」이 되게 함.
 * @param {Array<{
 *   type?: string,
 *   direction?: 'glued' | 'spaced' | null,
 *   clusters?: UnifySpacingCluster[],
 * }> | null | undefined} groups
 * @returns {Map<string, string>}
 */
export function buildPatternDirectionSoftPreselect(groups) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const group of groups ?? []) {
    if (group?.type !== 'series') continue;
    const spacing = group.direction;
    if (spacing !== 'glued' && spacing !== 'spaced') continue;
    for (const c of group.clusters ?? []) {
      const key = c?.key;
      if (!key) continue;
      const v = variantForSpacing(c, spacing);
      if (v) out.set(key, v);
    }
  }
  return out;
}
