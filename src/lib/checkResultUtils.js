import { SPELLING_RULES_FP } from './builtInRules.js';
import { CAUTION_RULES_FP } from './cautionRules.js';
import { ruleDisplayLabel } from './regexFromFind.js';

/** 일관성 결과 목록 — 발견 0건이어도 표시 */
const CONSISTENCY_LIST_PATTERN_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
  'phrase-slot-find',
  'auxiliary-verb',
]);

/** @param {import('./ruleTypes.js').Rule} rule */
function isConsistencyListRule(rule) {
  return CONSISTENCY_LIST_PATTERN_KINDS.has(rule.patternKind ?? '');
}

/** @param {import('./ruleTypes.js').Rule} rule */
function shouldShowZeroFindGroup(rule) {
  return (
    isConsistencyListRule(rule) && rule.patternKind !== 'auxiliary-verb'
  );
}

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
  const rawConsistency = saved.consistencyGroupedResults ?? [];
  const tocFromLegacy = rawConsistency.filter(
    (g) => g?.patternKind === 'toc-body',
  );
  const consistency = rawConsistency.filter((g) => g?.patternKind !== 'toc-body');
  const tocBody =
    (saved.tocBodyGroupedResults?.length ?? 0) > 0
      ? saved.tocBodyGroupedResults
      : tocFromLegacy;
  const staleRules = !rulesMatch && (saved.groupedResults?.length ?? 0) > 0;
  return { spelling, consistency, tocBody, staleRules };
}

/** @param {import('./ruleEngine.js').GroupedResult} group */
export function groupKey(group) {
  if (group.cautionId) return `caution:${group.cautionId}`;
  return `${group.find}\0${group.replace}`;
}

/** @typedef {'spelling' | 'consistency' | 'toc-body'} ResultSource */

/** @param {ResultSource} source */
/** @param {import('./ruleEngine.js').GroupedResult} group */
export function resultVisibilityKey(source, group) {
  return `${source}:${groupKey(group)}`;
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {ResultSource} source
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
export function isResultGroupVisible(visibility, source, group) {
  return visibility[resultVisibilityKey(source, group)] !== false;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {ResultSource} source
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
export function findResultSource(
  spellingResults,
  consistencyResults,
  inst,
  tocBodyResults = [],
) {
  if (spellingResults.some((g) => groupContainsInstance(g, inst))) {
    return 'spelling';
  }
  if (tocBodyResults.some((g) => groupContainsInstance(g, inst))) {
    return 'toc-body';
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
/** @param {import('./ruleTypes.js').Rule} rule */
function zeroFindGroupFromRule(rule) {
  return {
    find: rule.find,
    replace: rule.replace,
    label: ruleDisplayLabel(rule),
    category: 'consistency',
    ...(rule.patternKind ? { patternKind: rule.patternKind } : {}),
    ...(rule.patternKind === 'auxiliary-verb' && rule.tailWord
      ? {
          tailWord: rule.tailWord,
          ...(rule.label?.trim()
            ? { groupDisplayLabel: rule.label.trim() }
            : {}),
        }
      : {}),
    instances: [],
  };
}

/**
 * 일관성 결과 정렬 — 1) 일관성 찾기(등록 순) 2) 본용언+보조용언(등록 순)
 * @param {import('./ruleTypes.js').Rule[]} activeRules
 * @returns {Map<string, { tier: 0 | 1, index: number }>}
 */
function buildConsistencyResultOrder(activeRules) {
  /** @type {Map<string, { tier: 0 | 1, index: number }>} */
  const order = new Map();
  let userIdx = 0;
  let auxIdx = 0;
  for (const rule of activeRules) {
    if (!rule.enabled || !isConsistencyListRule(rule)) continue;
    const key = consistencyResultKey(rule);
    if (order.has(key)) continue;
    const isAux = rule.patternKind === 'auxiliary-verb';
    order.set(key, {
      tier: isAux ? 1 : 0,
      index: isAux ? auxIdx++ : userIdx++,
    });
  }
  return order;
}

/** @param {import('./ruleEngine.js').GroupedResult} group */
/** @param {Map<string, { tier: 0 | 1, index: number }>} order */
function consistencyGroupSortRank(group, order) {
  const mapped = order.get(consistencyResultKey(group));
  if (mapped) return mapped;
  if (group.patternKind === 'auxiliary-verb') {
    return { tier: 1, index: Number.POSITIVE_INFINITY };
  }
  return { tier: 0, index: Number.POSITIVE_INFINITY };
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} results
 * @param {import('./ruleTypes.js').Rule[]} activeRules
 */
export function sortConsistencyGroupedResults(results, activeRules) {
  const order = buildConsistencyResultOrder(activeRules);
  return [...results].sort((a, b) => {
    const ra = consistencyGroupSortRank(a, order);
    const rb = consistencyGroupSortRank(b, order);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    if (ra.index !== rb.index) return ra.index - rb.index;
    return (a.label ?? '').localeCompare(b.label ?? '', 'ko');
  });
}

export function mergeConsistencyZeroFindGroups(results, activeRules) {
  const merged = [...results];
  const seen = new Set(merged.map((g) => consistencyResultKey(g)));

  for (const rule of activeRules) {
    if (!rule.enabled) continue;
    if (!shouldShowZeroFindGroup(rule)) continue;

    const key = consistencyResultKey(rule);
    if (seen.has(key)) continue;
    seen.add(key);

    merged.push(zeroFindGroupFromRule(rule));
  }

  return sortConsistencyGroupedResults(merged, activeRules);
}
