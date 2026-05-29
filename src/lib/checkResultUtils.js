import { SPELLING_RULES_FP } from './builtInRules.js';
import { CAUTION_RULES_FP } from './cautionRules.js';
import { ruleDisplayLabel } from './regexFromFind.js';

/** 문자열 찾기·공통 문자열 찾기 — 발견 0건이어도 결과 목록에 표시 */
const CONSISTENCY_ZERO_RESULT_KINDS = new Set([
  'compound-find',
  'phrase-slot-find',
]);

/** @param {{ find: string, replace: string }} row */
function consistencyResultKey(row) {
  return `${row.find}\0${row.replace}`;
}

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

/**
 * 일관성 검사 — 활성 문자열/공통문자열 규칙 중 매칭이 없으면 instances=[] 그룹 추가
 * @param {import('./ruleEngine.js').GroupedResult[]} results
 * @param {import('./ruleTypes.js').Rule[]} activeRules
 */
export function mergeConsistencyZeroFindGroups(results, activeRules) {
  const merged = [...results];
  const seen = new Set(merged.map((g) => consistencyResultKey(g)));

  for (const rule of activeRules) {
    if (!rule.enabled) continue;
    if (!CONSISTENCY_ZERO_RESULT_KINDS.has(rule.patternKind ?? '')) continue;

    const key = consistencyResultKey(rule);
    if (seen.has(key)) continue;
    seen.add(key);

    merged.push({
      find: rule.find,
      replace: rule.replace,
      label: rule.label?.trim() || ruleDisplayLabel(rule),
      category: 'consistency',
      instances: [],
    });
  }

  return merged.sort((a, b) => {
    const pa = a.instances[0]?.pageNum ?? Number.POSITIVE_INFINITY;
    const pb = b.instances[0]?.pageNum ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, 'ko');
  });
}
