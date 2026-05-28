import { SPELLING_RULES_FP } from './builtInRules.js';
import { CAUTION_RULES_FP } from './cautionRules.js';

/**
 * @param {{
 *   spellingRulesFingerprint?: string,
 *   cautionRulesFingerprint?: string,
 *   groupedResults?: unknown[],
 *   consistencyGroupedResults?: unknown[],
 * }} saved
 */
export function restoreCheckResults(saved) {
  const rulesMatch =
    saved.spellingRulesFingerprint === SPELLING_RULES_FP &&
    saved.cautionRulesFingerprint === CAUTION_RULES_FP;
  const spelling = rulesMatch ? (saved.groupedResults ?? []) : [];
  const consistency = saved.consistencyGroupedResults ?? [];
  const staleRules = !rulesMatch && (saved.groupedResults?.length ?? 0) > 0;
  return { spelling, consistency, staleRules };
}

/** @param {import('./ruleEngine.js').GroupedResult} group */
export function groupKey(group) {
  if (group.cautionId) return `caution:${group.cautionId}`;
  return `${group.find}\0${group.replace}`;
}

/** @param {'spelling' | 'consistency'} source */
/** @param {import('./ruleEngine.js').GroupedResult} group */
export function resultVisibilityKey(source, group) {
  return `${source}:${groupKey(group)}`;
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {'spelling' | 'consistency'} source
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
export function isResultGroupVisible(visibility, source, group) {
  return visibility[resultVisibilityKey(source, group)] !== false;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {'spelling' | 'consistency'} source
 */
export function defaultVisibilityForGroups(groups, source) {
  /** @type {Record<string, boolean>} */
  const next = {};
  for (const group of groups) {
    next[resultVisibilityKey(source, group)] = true;
  }
  return next;
}

/** @param {import('./ruleEngine.js').MatchInstance} a */
/** @param {import('./ruleEngine.js').MatchInstance} b */
export function instancesMatch(a, b) {
  return (
    a.pageNum === b.pageNum &&
    a.index === b.index &&
    a.matchedText === b.matchedText
  );
}

/** @param {import('./ruleEngine.js').GroupedResult[]} results */
/** @param {import('./ruleEngine.js').GroupedResult} group */
export function groupContainsInstance(group, inst) {
  return group.instances.some((i) => instancesMatch(i, inst));
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} results
 * @param {import('./ruleEngine.js').MatchInstance | null} inst
 */
export function findActiveGroup(results, inst) {
  if (!inst) return null;
  const direct = results.find(
    (g) => g.find === inst.find && g.replace === inst.replace,
  );
  if (direct) return direct;
  return results.find((g) => groupContainsInstance(g, inst)) ?? null;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} spellingResults
 * @param {import('./ruleEngine.js').GroupedResult[]} consistencyResults
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @returns {'spelling' | 'consistency'}
 */
export function findResultSource(spellingResults, consistencyResults, inst) {
  if (spellingResults.some((g) => groupContainsInstance(g, inst))) {
    return 'spelling';
  }
  if (consistencyResults.some((g) => groupContainsInstance(g, inst))) {
    return 'consistency';
  }
  return 'spelling';
}
