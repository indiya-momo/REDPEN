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
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   totalFindings: number,
 * }} input
 */
export function formatConsistencyResultsSummaryLine({
  literalWithFindings,
  commonStringWithFindings,
  auxiliaryWithFindings,
  totalFindings,
}) {
  return (
    `일관성 찾기${formatCategoryFindingCount(literalWithFindings)}, ` +
    `공통 문자열 찾기${formatCategoryFindingCount(commonStringWithFindings)}, ` +
    `본용언 + 보조용언 표기${formatCategoryFindingCount(auxiliaryWithFindings)} ` +
    `전체 발견 ${formatTotalFindingsToken(totalFindings)}`
  );
}
