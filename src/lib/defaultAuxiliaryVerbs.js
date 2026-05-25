import { buildRulesForAuxiliaryEntry } from './auxiliaryVerbRegister.js';
import {
  allBonBojoTailWords,
  BON_BOJO_GROUPS,
  bonBojoDisplayLabelForItem,
  bonBojoItemIdForTail,
  tailWordsFromBonBojoItem,
} from './bonBojoRules.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/** bon-bojo 도입 전 앱에 넣던 기본 tail (시트·JSON에는 없음) */
const LEGACY_BUILTIN_AUXILIARY_TAILS = new Set([
  '보',
  '주',
  '두',
  '놓',
  '가',
  '오',
  '내',
  '지',
  '하',
  '있',
  '해보',
  '해 보',
]);

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function pruneObsoleteAuxiliaryRules(rules) {
  const bonTails = allBonBojoTailWords();
  return rules.filter((r) => {
    if (r.patternKind !== 'auxiliary-verb') return true;
    const tw = r.tailWord?.trim();
    if (!tw) return false;
    if (r.bonBojoItemId) return true;
    if (bonTails.has(tw)) return false;
    if (LEGACY_BUILTIN_AUXILIARY_TAILS.has(tw)) return false;
    return true;
  });
}

/**
 * 시트 bon-bojo 탭(sync-bon-bojo) 시드 → 규칙 세트에 없는 tail만 추가(기본 체크 off).
 * stems 변이는 검색용으로만 추가하고, 목록에는 item당 1칸.
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function ensureDefaultAuxiliaryVerbs(customRules) {
  let rules = pruneObsoleteAuxiliaryRules([...(customRules ?? [])]);

  for (const group of BON_BOJO_GROUPS) {
    for (const item of group.items) {
      const itemId = item.id;
      const listLabel =
        item.displayLabel?.trim() ||
        bonBojoDisplayLabelForItem(itemId) ||
        encodeSpacesVisible(item.label);
      for (const tail of tailWordsFromBonBojoItem(item)) {
        const batch = buildRulesForAuxiliaryEntry(rules, tail);
        if (!batch.length) continue;
        rules = [
          ...rules,
          ...batch.map((r) => ({
            ...r,
            enabled: item.enabled === true,
            label: listLabel,
            bonBojoItemId: itemId,
          })),
        ];
      }
    }
  }

  return applyBonBojoItemIds(applyBonBojoDisplayLabels(rules));
}

/**
 * 예전 시드( tail마다 목록 1칸) → bonBojoItemId 묶음
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function applyBonBojoItemIds(rules) {
  return rules.map((r) => {
    if (r.patternKind !== 'auxiliary-verb' || r.bonBojoItemId || !r.tailWord) {
      return r;
    }
    const itemId = bonBojoItemIdForTail(r.tailWord);
    if (!itemId) return r;
    const display = bonBojoDisplayLabelForItem(itemId);
    return {
      ...r,
      bonBojoItemId: itemId,
      ...(display ? { label: display } : {}),
    };
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
