import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from './activeRuleCount.js';
import { planProjectCustomRulesUpdate } from './projectCustomRulesUpdate.js';

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 * @param {{
 *   customRules?: import('./ruleTypes.js').Rule[],
 *   builtInEnabled?: Record<string, boolean>,
 *   cautionEnabled?: Record<string, boolean>,
 * }} patch
 */
export function planProjectCriteriaUpdate(ruleSet, patch) {
  let customRules = ruleSet.customRules ?? [];

  if (patch.customRules !== undefined) {
    const plan = planProjectCustomRulesUpdate(ruleSet, patch.customRules);
    if (!plan.ok) {
      return plan;
    }
    customRules = plan.nextCustomRules;
  }

  const builtInEnabled =
    patch.builtInEnabled !== undefined
      ? patch.builtInEnabled
      : ruleSet.builtInEnabled;
  const cautionEnabled =
    patch.cautionEnabled !== undefined
      ? patch.cautionEnabled
      : ruleSet.cautionEnabled;

  const count = countActiveRules({
    builtInEnabled,
    cautionEnabled,
    customRules,
  });
  if (isOverMaxRules(count)) {
    return {
      ok: false,
      reason: 'max_rules',
      message: maxRulesExceededMessage(count),
    };
  }

  /** @type {{
   *   customRules?: import('./ruleTypes.js').Rule[],
   *   builtInEnabled?: Record<string, boolean>,
   *   cautionEnabled?: Record<string, boolean>,
   * }} */
  const nextPatch = {};
  if (patch.customRules !== undefined) {
    nextPatch.customRules = customRules;
  }
  if (patch.builtInEnabled !== undefined) {
    nextPatch.builtInEnabled = patch.builtInEnabled;
  }
  if (patch.cautionEnabled !== undefined) {
    nextPatch.cautionEnabled = patch.cautionEnabled;
  }

  return { ok: true, patch: nextPatch };
}
