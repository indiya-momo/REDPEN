import { buildRulesForAuxiliaryEntry } from './auxiliaryVerbRegister.js';
import { BON_BOJO_SEED_ENTRIES, bonBojoDisplayLabelForTail } from './bonBojoRules.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/**
 * 시트 bon-bojo 탭(sync-bon-bojo) 시드 → 규칙 세트에 없는 tail만 추가(기본 체크 off).
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function ensureDefaultAuxiliaryVerbs(customRules) {
  let rules = [...(customRules ?? [])];

  for (const entry of BON_BOJO_SEED_ENTRIES) {
    const batch = buildRulesForAuxiliaryEntry(rules, entry.tailWord);
    if (!batch.length) continue;
    const listLabel =
      entry.displayLabel ||
      bonBojoDisplayLabelForTail(entry.tailWord) ||
      encodeSpacesVisible(entry.tailWord);
    rules = [
      ...rules,
      ...batch.map((r) => ({
        ...r,
        enabled: entry.enabled === true,
        label: listLabel,
      })),
    ];
  }

  return applyBonBojoDisplayLabels(rules);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function applyBonBojoDisplayLabels(rules) {
  return rules.map((r) => {
    if (r.patternKind !== 'auxiliary-verb' || !r.tailWord) return r;
    const display = bonBojoDisplayLabelForTail(r.tailWord);
    if (!display) return r;
    return { ...r, label: display };
  });
}
