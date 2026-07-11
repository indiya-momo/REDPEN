/**
 * 프로젝트 카드 기둥 색 ↔ 결과 뱃지·PDF 하이라이트 톤
 *
 * PDF 하이라이트는 기둥 단위(spelling / consistency / auxiliary) 칠.
 * 맞춤법·통일형만 테두리(outline)로 한 단계 더 구분한다.
 *
 * @typedef {'spelling' | 'consistency' | 'auxiliary'} ResultPillarTone
 * @typedef {
 *   | 'spelling-builtin'
 *   | 'spelling-caution'
 *   | 'consistency-literal'
 *   | 'consistency-unify'
 *   | 'consistency-common'
 *   | 'auxiliary'
 * } ResultBadgeTone
 */

/**
 * @param {'spelling' | 'consistency'} source
 * @param {{ patternKind?: string } | null | undefined} [group]
 * @returns {ResultPillarTone}
 */
export function resultPillarTone(source, group) {
  if (source === 'spelling') return 'spelling';
  if (group?.patternKind === 'auxiliary-verb') return 'auxiliary';
  return 'consistency';
}

/**
 * @param {'spelling' | 'consistency'} source
 * @param {{
 *   patternKind?: string,
 *   category?: string,
 *   isUnify?: boolean,
 * } | null | undefined} [group]
 * @returns {ResultBadgeTone}
 */
export function resultBadgeTone(source, group) {
  if (source === 'spelling') {
    return group?.category === 'caution'
      ? 'spelling-caution'
      : 'spelling-builtin';
  }
  if (group?.patternKind === 'auxiliary-verb') return 'auxiliary';
  if (group?.patternKind === 'phrase-slot-find') return 'consistency-common';
  if (group?.isUnify) return 'consistency-unify';
  return 'consistency-literal';
}

/**
 * 맞춤법·통일형 원고 하이라이트에만 테두리
 * @param {ResultBadgeTone} badgeTone
 */
export function pdfHighlightHasOutline(badgeTone) {
  return (
    badgeTone === 'spelling-builtin' || badgeTone === 'consistency-unify'
  );
}

/**
 * @param {ResultBadgeTone | ResultPillarTone} tone
 * @returns {string}
 */
export function resultPillarToneClass(tone) {
  return `result-pillar--${tone}`;
}

/**
 * @param {ResultPillarTone} tone
 * @returns {string}
 */
export function pdfHighlightPillarClass(tone) {
  return `pdf-highlight--pillar-${tone}`;
}
