import { buildRulesForAuxiliaryEntry } from './auxiliaryVerbRegister.js';
import { isAdjectiveCheHadaTail } from './adjectiveCheHadaPattern.js';
import { AUXILIARY_FLEX_SPACE } from './compoundPatternCommon.js';
import {
  BON_BOJO_GROUPS,
  bonBojoDisplayLabelForItem,
  bonBojoItemIdForSearchTail,
  auxiliarySearchTailsFromBonBojoItem,
  isBonBojoLogicOnlyItem,
} from './bonBojoRules.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/** @param {string} itemId */
function allowedSearchTailsForItem(itemId) {
  for (const group of BON_BOJO_GROUPS) {
    const item = group.items.find((i) => i.id === itemId);
    if (item) return new Set(auxiliarySearchTailsFromBonBojoItem(item));
  }
  return new Set();
}

/**
 * bon-bojo 시트에 없는 보조용언 규칙 제거 — itemId·stem 모두 시트와 일치해야 함
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function pruneObsoleteAuxiliaryRules(rules) {
  return rules.filter((r) => {
    if (r.patternKind !== 'auxiliary-verb') return true;
    const tw = r.tailWord?.trim();
    const itemId = r.bonBojoItemId?.trim();
    if (!tw || !itemId) return false;
    return allowedSearchTailsForItem(itemId).has(tw);
  });
}

/** 예전 붙임 regex 제거 — 시트 stems는 띄움형만 */
function pruneGluedAuxiliaryFindRules(rules) {
  return rules.filter((r) => {
    if (r.patternKind !== 'auxiliary-verb') return true;
    const tw = r.tailWord?.trim();
    if (!tw || isAdjectiveCheHadaTail(tw)) return true;
    if (!/\s/.test(tw)) return r.find.includes(AUXILIARY_FLEX_SPACE);
    const parts = tw.split(/\s+/).filter(Boolean);
    if (parts.length === 2) return r.find.includes(AUXILIARY_FLEX_SPACE);
    return true;
  });
}

/**
 * 시트 bon-bojo 탭(sync-bon-bojo) 시드 → 규칙 세트에 없는 tail만 추가(기본 체크 off).
 * stems 변이는 검색용만 추가하고, 목록에는 item당 1칸.
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function ensureDefaultAuxiliaryVerbs(customRules) {
  let rules = pruneGluedAuxiliaryFindRules(
    pruneObsoleteAuxiliaryRules([...(customRules ?? [])]),
  );

  for (const group of BON_BOJO_GROUPS) {
    for (const item of group.items) {
      const itemId = item.id;
      const listLabel =
        item.displayLabel?.trim() ||
        bonBojoDisplayLabelForItem(itemId) ||
        encodeSpacesVisible(item.label);
      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        const batch = buildRulesForAuxiliaryEntry(rules, tail);
        if (!batch.length) continue;
        rules = [
          ...rules,
          ...batch.map((r) => ({
            ...r,
            enabled: isBonBojoLogicOnlyItem(itemId)
              ? true
              : item.enabled === true,
            label: listLabel,
            bonBojoItemId: itemId,
          })),
        ];
      }
    }
  }

  return applyBonBojoDisplayLabels(forceLogicOnlyAuxiliaryEnabled(rules));
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function forceLogicOnlyAuxiliaryEnabled(rules) {
  return rules.map((r) => {
    if (r.patternKind !== 'auxiliary-verb') return r;
    const itemId = r.bonBojoItemId?.trim();
    if (itemId && isBonBojoLogicOnlyItem(itemId)) return { ...r, enabled: true };
    return r;
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function applyBonBojoDisplayLabels(rules) {
  return rules.map((r) => {
    if (r.patternKind !== 'auxiliary-verb' || !r.bonBojoItemId) return r;
    const display = bonBojoDisplayLabelForItem(r.bonBojoItemId);
    if (!display) return r;
    return { ...r, label: display };
  });
}
