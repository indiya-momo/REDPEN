/**
 * 본조 2차 — 1차와 같은 stem 규칙에서 필수 공백만 빼고 붙임 표면을 찾는다.
 * 1차 ruleEngine은 그대로. 짧은 stem 전수 부분일치는 쓰지 않는다.
 */

import { AUXILIARY_FLEX_SPACE } from './compoundPatternCommon.js';
import { compileRuleRegex } from './regexFromFind.js';
import { isGloballyExcluded, shouldSkipMatch } from './matchFilters.js';
import {
  pruneAuxiliaryFalseMorph,
  warmAuxiliaryMorphCache,
} from './auxiliaryMorphFilter.js';

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
 * 붙임 매치 → 띄움 제안. 캡처가 `머리+보조`이면 가운데 공백.
 * @param {RegExpMatchArray} match
 */
export function spacedSuggestionFromGluedAuxMatch(match) {
  const full = String(match?.[0] ?? '');
  const head = match?.[1];
  const tail = match?.[2];
  if (
    typeof head === 'string' &&
    typeof tail === 'string' &&
    head &&
    tail &&
    full === `${head}${tail}`
  ) {
    return `${head} ${tail}`;
  }
  return full;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {readonly { pageNum?: number, text?: string }[]} pageTexts
 * @param {{
 *   rules?: readonly import('./ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   analyze?: import('./kiwiMorph/analyze.js').analyzeLine,
 *   morphPrefetchMaxMs?: number,
 * }} [opts]
 * @returns {Promise<import('./ruleEngine.js').GroupedResult[]>}
 */
export async function enrichAuxiliaryGluedFromSpaced(
  groups,
  pageTexts,
  opts = {},
) {
  const list = [...(groups ?? [])];
  const pages = pageTexts ?? [];
  const rules = (opts.rules ?? []).filter(
    (rule) =>
      rule?.enabled !== false &&
      rule?.patternKind === 'auxiliary-verb' &&
      !rule.auxSplitLongCompound &&
      gluedFindFromSpacedAuxFind(rule.find),
  );
  if (!list.length && !rules.length) {
    await warmAuxiliaryMorphCache(list, opts);
    return pruneAuxiliaryFalseMorph(list, opts);
  }
  if (!pages.length || !rules.length) {
    const base = groups ?? [];
    await warmAuxiliaryMorphCache(base, opts);
    return pruneAuxiliaryFalseMorph(base, opts);
  }

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
            suggestedText: spacedSuggestionFromGluedAuxMatch(match),
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

  await warmAuxiliaryMorphCache(list, opts);
  return pruneAuxiliaryFalseMorph(list, opts);
}
