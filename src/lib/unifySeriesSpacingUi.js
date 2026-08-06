/**
 * 표기 통일 추천 UI — 계열 방향·발견 수·soft/확정 병합.
 */

/** @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */

export { variantForSpacing } from './unifySeriesMajorityPreselect.js';

/**
 * soft(preSelected) 위에 확정(registered)을 덮어쓴 최종 선택.
 * @param {Map<string, string> | null | undefined} registeredVariants
 * @param {Map<string, string> | null | undefined} preSelected
 * @returns {Map<string, string>}
 */
export function mergeUnifyChosenMaps(registeredVariants, preSelected) {
  /** @type {Map<string, string>} */
  const out = new Map();
  if (preSelected) {
    for (const [k, v] of preSelected) {
      if (k && v != null && v !== '') out.set(k, v);
    }
  }
  if (registeredVariants) {
    for (const [k, v] of registeredVariants) {
      if (k && v != null && v !== '') out.set(k, v);
    }
  }
  return out;
}

/**
 * 계열 정책 방향. 예외가 섞이면 다수결(동률이면 null).
 * @param {{ clusters?: { key?: string }[] } | null | undefined} group
 * @param {Map<string, string>} registeredVariants
 * @param {Map<string, string>} preSelected
 * @returns {'glued' | 'spaced' | null}
 */
export function resolveSeriesChosenSpacing(
  group,
  registeredVariants,
  preSelected,
) {
  let glued = 0;
  let spaced = 0;
  let softGlued = 0;
  let softSpaced = 0;
  for (const c of group?.clusters ?? []) {
    const key = c?.key;
    if (!key) continue;
    const soft = preSelected?.get(key) ?? '';
    if (soft !== '') {
      if (/\s/.test(soft)) softSpaced += 1;
      else softGlued += 1;
    }
    const chosen =
      registeredVariants?.get(key) ?? soft;
    if (chosen === '') continue;
    if (/\s/.test(chosen)) spaced += 1;
    else glued += 1;
  }
  if (glued === 0 && spaced === 0) return null;
  if (glued > 0 && spaced > 0) {
    // 예외로 동률이면 soft 다수 유지(헤더가 예외 1건에 뒤집히지 않음)
    if (glued === spaced) {
      if (softGlued === softSpaced) return null;
      if (softGlued === 0 && softSpaced === 0) return null;
      return softGlued > softSpaced ? 'glued' : 'spaced';
    }
    return glued > spaced ? 'glued' : 'spaced';
  }
  return glued > 0 ? 'glued' : 'spaced';
}

/**
 * 목록 전체 일괄 선택 상태. 전 항목이 같은 방향일 때만.
 * @param {{ key?: string }[] | null | undefined} clusters
 * @param {Map<string, string>} registeredVariants
 * @param {Map<string, string>} preSelected
 * @returns {'glued' | 'spaced' | null}
 */
export function resolveGlobalChosenSpacing(
  clusters,
  registeredVariants,
  preSelected,
) {
  let seen = null;
  for (const c of clusters ?? []) {
    const key = c?.key;
    if (!key) continue;
    const chosen =
      registeredVariants?.get(key) ?? preSelected?.get(key) ?? '';
    if (chosen === '') continue;
    const dir = /\s/.test(chosen) ? 'spaced' : 'glued';
    if (seen == null) seen = dir;
    else if (seen !== dir) return null;
  }
  return seen;
}

/**
 * 붙임/띄움 발견 수.
 * - 미선택: 원고 그대로 (붙임/띄움 분리)
 * - 확정(registered): 그 클러스터 **전체 횟수**를 선택 방향으로 합산
 *   (일괄 붙여쓰기 → 붙임 N, 띄움 0)
 * - soft(preSelected)·seriesSpacing은 집계에 영향 없음
 *
 * @param {UnifySpacingCluster[] | null | undefined} clusters
 * @param {{
 *   registeredVariants?: Map<string, string> | null,
 *   hiddenPdfKeys?: Set<string> | null,
 *   seriesSpacing?: 'glued' | 'spaced' | null,
 * }} [opts]
 * @returns {{ glued: number, spaced: number }}
 */
export function sumClusterSpacingFindings(clusters, opts = {}) {
  const { registeredVariants = null, hiddenPdfKeys = null } = opts;
  const list = clusters ?? [];

  let glued = 0;
  let spaced = 0;
  for (const c of list) {
    const key = c?.key;
    if (key && hiddenPdfKeys?.has(key)) continue;

    const chosen =
      key && registeredVariants?.has(key)
        ? registeredVariants.get(key) ?? ''
        : '';

    let clusterTotal = 0;
    for (const n of Object.values(c?.counts ?? {})) {
      const v = Number(n) || 0;
      if (v > 0) clusterTotal += v;
    }

    if (chosen) {
      if (/\s/.test(chosen)) spaced += clusterTotal;
      else glued += clusterTotal;
      continue;
    }

    for (const [variant, n] of Object.entries(c?.counts ?? {})) {
      const v = Number(n) || 0;
      if (v <= 0) continue;
      if (/\s/.test(variant)) spaced += v;
      else glued += v;
    }
  }
  return { glued, spaced };
}
