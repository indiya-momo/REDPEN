import { normalizeRuleSet } from './ruleSetNormalize.js';

/**
 * 마이페이지 허브 — 검수 화면과 동일하게 정규화된 RuleSet.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 */
export function normalizeHubRuleSet(ruleSet) {
  return normalizeRuleSet(ruleSet);
}
