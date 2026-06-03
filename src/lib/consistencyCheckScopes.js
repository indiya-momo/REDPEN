/** @typedef {'literal-slot' | 'auxiliary'} ConsistencyCheckScope */

export const LITERAL_SLOT_PATTERN_KINDS = [
  'compound-find',
  'compound-tail',
  'compound-spacing',
  'phrase-slot-find',
];

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {ConsistencyCheckScope} scope
 */
export function filterCustomRulesByConsistencyScope(rules, scope) {
  const enabled = rules.filter((r) => r.enabled);
  if (scope === 'literal-slot') {
    return enabled.filter((r) =>
      LITERAL_SLOT_PATTERN_KINDS.includes(r.patternKind),
    );
  }
  if (scope === 'auxiliary') {
    return enabled.filter((r) => r.patternKind === 'auxiliary-verb');
  }
  return enabled;
}

/**
 * @param {import('./ruleEngine.js').RuleResultGroup} group
 * @returns {ConsistencyCheckScope | 'other'}
 */
export function consistencyGroupScope(group) {
  if (group.patternKind === 'auxiliary-verb') return 'auxiliary';
  if (LITERAL_SLOT_PATTERN_KINDS.includes(group.patternKind)) {
    return 'literal-slot';
  }
  return 'other';
}
