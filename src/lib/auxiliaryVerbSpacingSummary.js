/**
 * 본조 결과 — 그룹 안에서 잡힌 matchedText 기준 띄움/붙임 표면 건수.
 * (1차 regex는 대부분 띄움만 잡음. 붙임 건은 붙은 표면 매치·3음절 칸 등.)
 */

/**
 * @param {readonly import('./ruleEngine.js').MatchInstance[] | null | undefined} instances
 * @param {(inst: import('./ruleEngine.js').MatchInstance) => boolean} [isSolid]
 */
export function countAuxiliaryMatchedSpacingSurfaces(instances, isSolid) {
  let spaced = 0;
  let glued = 0;
  let spacedSolid = 0;
  let gluedSolid = 0;
  for (const inst of instances ?? []) {
    const m = String(inst.matchedText ?? '').trim();
    if (!m) continue;
    const solid = typeof isSolid === 'function' && isSolid(inst);
    if (/\s/.test(m)) {
      spaced += 1;
      if (solid) spacedSolid += 1;
    } else {
      glued += 1;
      if (solid) gluedSolid += 1;
    }
  }
  return { spaced, glued, spacedSolid, gluedSolid };
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
  '띄어 쓴·붙여 쓴은 검사로 남은 표면입니다. 합성어는 사전에 등재되어 붙여 쓰기로 표시된 개수이며, 있을 때만 붙습니다.';

/**
 * @param {{ spaced: number, glued: number }} counts
 */
export function formatAuxiliaryDocSpacingBreakdown(counts) {
  return formatAuxiliarySpacingBreakdown(counts);
}

/**
 * @param {string} text
 * @param {number} [solidCount]
 * @returns {{ text: string, solid: string }}
 */
function spacingLinePart(text, solidCount = 0) {
  return {
    text,
    solid: solidCount > 0 ? `합성어 ${solidCount}` : '',
  };
}

/**
 * 검사로 남은 표면. 합성어 문구는 해당 쪽에 1건 이상일 때만 둔다.
 * @param {{ spaced: number, glued: number, spacedSolid?: number, gluedSolid?: number } | null | undefined} match
 * @returns {{ text: string, solid: string }[]}
 */
export function listAuxiliarySpacingLineParts(match) {
  if (!match || !shouldShowAuxiliarySpacingBreakdown(match)) return [];
  /** @type {{ text: string, solid: string }[]} */
  const parts = [];
  if (match.spaced > 0) {
    parts.push(spacingLinePart(`띄어 쓴 ${match.spaced}`, match.spacedSolid));
  }
  if (match.glued > 0) {
    parts.push(spacingLinePart(`붙여 쓴 ${match.glued}`, match.gluedSolid));
  }
  return parts;
}

/**
 * @param {{ doc?: { spaced: number, glued: number } | null, match?: { spaced: number, glued: number, spacedSolid?: number, gluedSolid?: number } | null }} param
 */
export function formatAuxiliarySpacingDualLine({ match }) {
  return listAuxiliarySpacingLineParts(match)
    .map((part) => (part.solid ? `${part.text} - ${part.solid}` : part.text))
    .join(' I ');
}