import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';

/** @param {number} count */
export function formatCategoryFindingCount(count) {
  return `(${count}건)`;
}

/** @param {number} totalFindings */
export function formatTotalFindingsToken(totalFindings) {
  return `[${totalFindings}]`;
}

/**
 * @param {{
 *   cautionWithFindings: number,
 *   builtinWithFindings: number,
 *   totalFindings: number,
 * }} input
 */
export function formatSpellingResultsSummaryLine({
  cautionWithFindings,
  builtinWithFindings,
  totalFindings,
}) {
  return (
    `편집자 검토 필요${formatCategoryFindingCount(cautionWithFindings)}, ` +
    `맞춤법 규칙${formatCategoryFindingCount(builtinWithFindings)} ` +
    `전체 발견 ${formatTotalFindingsToken(totalFindings)}`
  );
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   unifyWithFindings?: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   totalFindings: number,
 * }} input
 */
export function formatConsistencyResultsSummaryLine({
  literalWithFindings,
  unifyWithFindings = 0,
  commonStringWithFindings,
  auxiliaryWithFindings,
  totalFindings,
}) {
  const line1 =
    `일관성 찾기${formatCategoryFindingCount(literalWithFindings)}, ` +
    `통일형 찾기${formatCategoryFindingCount(unifyWithFindings)}, ` +
    `공통 문자열 찾기${formatCategoryFindingCount(commonStringWithFindings)}`;
  const line2 =
    `${AUXILIARY_VERB_FEATURE_LABEL}${formatCategoryFindingCount(auxiliaryWithFindings)} ` +
    `전체 발견 ${formatTotalFindingsToken(totalFindings)}`;
  return `${line1}\n${line2}`;
}
