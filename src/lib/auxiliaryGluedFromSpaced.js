/**
 * 본조 2차 — 1차와 같은 stem 규칙에서 필수 공백만 빼고 붙임 표면을 찾는다.
 * 1차 ruleEngine은 그대로. 짧은 stem 전수 부분일치는 쓰지 않는다.
 */

import { AUXILIARY_FLEX_SPACE } from './compoundPatternCommon.js';
import { compileRuleRegex } from './regexFromFind.js';
import { isGloballyExcluded, shouldSkipMatch } from './matchFilters.js';

/**
 * @param {import('./ruleEngine.js').MatchInstance[]} instances
 * @param {number} pageNum
 * @param {number} index
 */
function hasNearbyInstance(instances, pageNum, index) {
  return instances.some(
    (i) => i.pageNum === pageNum && Math.abs((i.index ?? 0) - index) <= 4,
  );
}

/**
 * @param {string} find
 */
export function gluedFindFromSpacedAuxFind(find) {
  const src = String(find ?? '');
  if (!src.includes(AUXILIARY_FLEX_SPACE)) return '';
  return src.split(AUXILIARY_FLEX_SPACE).join('');
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {readonly { pageNum?: number, text?: string }[]} pageTexts
 * @param {{
 *   rules?: readonly import('./ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 * }} [opts]
 */
export function enrichAuxiliaryGluedFromSpaced(groups, pageTexts, opts = {}) {
  const list = [...(groups ?? [])];
  const pages = pageTexts ?? [];
  const rules = (opts.rules ?? []).filter(
    (rule) =>
      rule?.enabled !== false &&
      rule?.patternKind === 'auxiliary-verb' &&
      !rule.auxSplitLongCompound &&
      gluedFindFromSpacedAuxFind(rule.find),
  );
  if (!list.length && !rules.length) return list;
  if (!pages.length || !rules.length) return groups ?? [];

  /** @type {Map<string, import('./ruleEngine.js').GroupedResult>} */
  const byItem = new Map();
  for (const group of list) {
    const id = group?.bonBojoItemId?.trim();
    if (group?.patternKind === 'auxiliary-verb' && id && !byItem.has(id)) {
      byItem.set(id, group);
    }
  }

  const phrases = opts.globalExcludePhrases ?? [];

  for (const rule of rules) {
    const gluedFind = gluedFindFromSpacedAuxFind(rule.find);
    const regex = compileRuleRegex({ ...rule, find: gluedFind });
    if (!regex) continue;
    const itemId = rule.bonBojoItemId?.trim() || '';
    let group = itemId ? byItem.get(itemId) : null;
    /** @type {import('./ruleEngine.js').MatchInstance[]} */
    const added = [];

    for (const page of pages) {
      const text = String(page?.text ?? '');
      const pageNum = page?.pageNum ?? 0;
      if (!text || !pageNum) continue;
      let offset = 0;
      for (const line of text.split('\n')) {
        const lineStart = offset;
        offset += line.length + 1;
        if (!line) continue;
        const re = new RegExp(regex.source, regex.flags);
        let match;
        while ((match = re.exec(line)) !== null) {
          if (!match[0]) {
            re.lastIndex += 1;
            continue;
          }
          if (/\s/.test(match[0])) continue;
          if (
            isGloballyExcluded(match[0], phrases) ||
            shouldSkipMatch(rule, match, line)
          ) {
            continue;
          }
          const index = lineStart + match.index;
          const existing = group?.instances ?? [];
          if (hasNearbyInstance(existing, pageNum, index)) continue;
          if (hasNearbyInstance(added, pageNum, index)) continue;
          added.push({
            find: rule.find,
            replace: rule.replace,
            matchedText: match[0],
            suggestedText: match[0],
            pageNum,
            index,
          });
        }
      }
    }

    if (!added.length) continue;
    if (!group) {
      const label = String(rule.label ?? rule.tailWord ?? '').trim();
      group = {
        find: rule.find,
        replace: rule.replace ?? '',
        label,
        groupDisplayLabel: label,
        category: 'consistency',
        patternKind: 'auxiliary-verb',
        ...(itemId ? { bonBojoItemId: itemId } : {}),
        instances: [...added],
      };
      list.push(group);
      if (itemId) byItem.set(itemId, group);
      continue;
    }
    const nextGroup = {
      ...group,
      instances: [...(group.instances ?? []), ...added],
    };
    const at = list.indexOf(group);
    if (at >= 0) list[at] = nextGroup;
    if (itemId) byItem.set(itemId, nextGroup);
  }

  return list;
}
