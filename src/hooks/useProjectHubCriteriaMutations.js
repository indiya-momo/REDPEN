import { useCallback, useMemo } from 'react';
import { planProjectCriteriaUpdate } from '../lib/projectCriteriaUpdate.js';
import { normalizeHubRuleSet } from '../lib/projectHubRuleSet.js';

/**
 * @param {{
 *   ruleSet: import('../lib/ruleSetsStorage.js').RuleSet,
 *   onCriteriaChange: (patch: {
 *     customRules?: import('../lib/ruleTypes.js').Rule[],
 *     builtInEnabled?: Record<string, boolean>,
 *     cautionEnabled?: Record<string, boolean>,
 *   }) => void | Promise<void>,
 * }} options
 */
export function useProjectHubCriteriaMutations({
  ruleSet,
  onCriteriaChange,
}) {
  const hubRuleSet = useMemo(() => normalizeHubRuleSet(ruleSet), [ruleSet]);
  const customRules = hubRuleSet.customRules ?? [];

  const applyCriteriaPatch = useCallback(
    (patch) => {
      const plan = planProjectCriteriaUpdate(hubRuleSet, patch);
      if (!plan.ok) {
        alert(plan.message);
        return;
      }
      void onCriteriaChange(plan.patch);
    },
    [hubRuleSet, onCriteriaChange],
  );

  return { hubRuleSet, customRules, applyCriteriaPatch };
}
