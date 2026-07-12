/**
 * 명시적 「프로젝트 저장」시점의 기준 스냅샷.
 * autosave로 규칙이 바뀌면 checkpoint와 달라져 dirty=true.
 */

/**
 * @param {Pick<
 *   import('./ruleSetsStorage.js').RuleSet,
 *   | 'builtInEnabled'
 *   | 'cautionEnabled'
 *   | 'customRules'
 *   | 'globalExcludePhrases'
 *   | 'consistencyDecisions'
 * > | null | undefined} set
 */
export function buildCriteriaCheckpoint(set) {
  return JSON.stringify({
    builtInEnabled: set?.builtInEnabled ?? {},
    cautionEnabled: set?.cautionEnabled ?? {},
    customRules: set?.customRules ?? [],
    globalExcludePhrases: set?.globalExcludePhrases ?? [],
    consistencyDecisions: set?.consistencyDecisions ?? [],
  });
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet | null | undefined} set
 */
export function isRuleSetCriteriaDirty(set) {
  if (!set?.savedAt) return false;
  const checkpoint = set.criteriaCheckpoint;
  if (typeof checkpoint !== 'string' || !checkpoint) return false;
  return buildCriteriaCheckpoint(set) !== checkpoint;
}
