/**
 * 본조 결과 — 그룹 안에서 잡힌 matchedText 기준 띄움/붙임 표면 건수.
 * (1차 regex는 대부분 띄움만 잡음. 붙임 건은 붙은 표면 매치·3음절 칸 등.)
 */

/** @param {readonly import('./ruleEngine.js').MatchInstance[] | null | undefined} instances */
export function countAuxiliaryMatchedSpacingSurfaces(instances) {
  let spaced = 0;
  let glued = 0;
  for (const inst of instances ?? []) {
    const m = String(inst.matchedText ?? '').trim();
    if (!m) continue;
    if (/\s/.test(m)) spaced += 1;
    else glued += 1;
  }
  return { spaced, glued };
}

/** @param {{ spaced: number, glued: number }} counts */
export function formatAuxiliarySpacingBreakdown(counts) {
  const { spaced, glued } = counts;
  if (spaced <= 0 && glued <= 0) return '';
  const parts = [];
  if (spaced > 0) parts.push(`띄움 ${spaced}건`);
  if (glued > 0) parts.push(`붙임 ${glued}건`);
  return parts.join(' · ');
}

/** @param {{ spaced: number, glued: number }} counts */
export function shouldShowAuxiliarySpacingBreakdown(counts) {
  return counts.spaced > 0 || counts.glued > 0;
}

export const AUXILIARY_SPACING_BREAKDOWN_TIP =
  '이 그룹에서 검사에 잡힌 표면만 집계합니다. 원고에 반대 형태만 있으면 표기 통일 추천에서 붙임·띄움 짝을 확인하세요.';