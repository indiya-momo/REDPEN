import {
  MANUAL_CATEGORY,
  MANUAL_PATTERN_KIND,
  MANUAL_SOURCE,
} from './types.js';

/**
 * @param {string} find
 * @param {string} replace
 */
export function manualGroupKey(find, replace) {
  return `manual-add:${find}\0${replace}`;
}

/**
 * @param {import('./types.js').ManualFinding} manual
 * @returns {import('../ruleEngine.js').MatchInstance}
 */
export function manualFindingToInstance(manual) {
  const find = String(manual.matchedText ?? '');
  const replace = String(manual.replace ?? '');
  return {
    find,
    replace,
    matchedText: find,
    suggestedText: replace,
    pageNum: manual.pageNum,
    index: manual.start,
    manual: true,
    tip: manual.tip,
  };
}

/**
 * 엔진 밖에서 수동 발견을 기존 GroupedResult 목록에 합친다.
 * @param {import('../ruleEngine.js').GroupedResult[]} groups
 * @param {import('./types.js').ManualFinding} manual
 * @returns {import('../ruleEngine.js').GroupedResult[]}
 */
export function addManualFindingToGroups(groups, manual) {
  const find = String(manual?.matchedText ?? '');
  if (!find) return groups ?? [];
  const replace = String(manual.replace ?? '');
  const inst = manualFindingToInstance({
    ...manual,
    matchedText: find,
    replace,
    source: MANUAL_SOURCE,
  });
  const key = manualGroupKey(find, replace);
  const prev = groups ?? [];
  const next = prev.map((group) => ({
    ...group,
    instances: [...(group.instances ?? [])],
  }));
  const at = next.findIndex(
    (group) =>
      group.category === MANUAL_CATEGORY &&
      group.cautionId === key,
  );
  if (at >= 0) {
    const already = next[at].instances.some(
      (row) => row.pageNum === inst.pageNum && row.index === inst.index,
    );
    if (already) return groups ?? [];
    next[at].instances.push(inst);
    return next;
  }
  next.push({
    find,
    replace,
    label: replace ? `${find} → ${replace}` : find,
    category: MANUAL_CATEGORY,
    patternKind: MANUAL_PATTERN_KIND,
    cautionId: key,
    tip: String(manual.tip ?? '').trim(),
    instances: [inst],
  });
  return next;
}

/**
 * 수동 인스턴스 하나 제거. 그룹이 비면 그룹도 뺀다.
 * @param {import('../ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, index?: number } | null | undefined} inst
 * @returns {import('../ruleEngine.js').GroupedResult[]}
 */
export function removeManualInstance(groups, inst) {
  const pageNum = Number(inst?.pageNum);
  const index = Number(inst?.index);
  if (!Number.isFinite(pageNum) || !Number.isFinite(index)) {
    return groups ?? [];
  }
  /** @type {import('../ruleEngine.js').GroupedResult[]} */
  const next = [];
  for (const group of groups ?? []) {
    if (group.category !== MANUAL_CATEGORY) {
      next.push(group);
      continue;
    }
    const instances = (group.instances ?? []).filter(
      (row) => !(row.pageNum === pageNum && row.index === index),
    );
    if (instances.length === 0) continue;
    next.push({ ...group, instances });
  }
  return next;
}
