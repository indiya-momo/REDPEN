/**
 * @param {string} raw
 */
export function normalizeDividerLabel(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed === '-') return '';
  return trimmed;
}

/**
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function spellingBundleDisplayLabel(rule) {
  const fromLabel = normalizeDividerLabel(rule.dividerLabel);
  if (fromLabel) return fromLabel;
  const fromGroup = String(rule.dividerGroup ?? '').trim();
  if (fromGroup) return fromGroup;
  return rule.find;
}

/**
 * dividerGroup이 있으면 같은 키끼리 묶고, 없으면 단독 묶음으로 처리
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {{ key: string, rules: import('./ruleTypes.js').Rule[] }[]}
 */
export function groupRulesByDivider(rules) {
  /** @type {{ key: string, rules: import('./ruleTypes.js').Rule[] }[]} */
  const groups = [];
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const key = String(rule.dividerGroup ?? '').trim();
    if (!key) {
      groups.push({ key: `__single_${rule.find}_${i}`, rules: [rule] });
      continue;
    }
    const prev = groups[groups.length - 1];
    if (prev && prev.key === key) {
      prev.rules.push(rule);
    } else {
      groups.push({ key, rules: [rule] });
    }
  }
  return groups;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {{ id: string, label: string, rules: import('./ruleTypes.js').Rule[], ruleCount: number }[]}
 */
export function buildSpellingRuleBundles(rules) {
  return groupRulesByDivider(rules).map((group) => ({
    id: group.key,
    label: spellingBundleDisplayLabel(group.rules[0]),
    rules: group.rules,
    ruleCount: group.rules.length,
  }));
}
