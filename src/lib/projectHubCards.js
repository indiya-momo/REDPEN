import { buildProjectCardViewModelFromRuleSet } from '../presentation/ruleSetProjectCard.js';

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} projects
 * @param {string | null} activeSetId
 */
export function buildSortedProjectCards(projects, activeSetId) {
  return [...(projects ?? [])]
    .sort(
      (a, b) => Date.parse(b.savedAt ?? '') - Date.parse(a.savedAt ?? ''),
    )
    .map((set) =>
      buildProjectCardViewModelFromRuleSet(set, {
        isActive: set.id === activeSetId,
      }),
    );
}
