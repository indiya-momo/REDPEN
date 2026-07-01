import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from './activeRuleCount.js';

/**
 * 마이페이지에서 customRules 변경 시 활성 규칙 상한을 검사한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 * @param {import('./ruleTypes.js').Rule[]} nextCustomRules
 */
export function planProjectCustomRulesUpdate(ruleSet, nextCustomRules) {
  const count = countActiveRules({
    builtInEnabled: ruleSet.builtInEnabled,
    cautionEnabled: ruleSet.cautionEnabled,
    customRules: nextCustomRules,
  });
  if (isOverMaxRules(count)) {
    return {
      ok: false,
      reason: 'max_rules',
      message: maxRulesExceededMessage(count),
    };
  }
  return { ok: true, nextCustomRules };
}
