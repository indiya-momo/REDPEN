import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import {
  getBonBojoGroups,
  bonBojoDisplayLabelForItem,
  auxiliarySearchTailsFromBonBojoItem,
  isBonBojoLogicOnlyItem,
  isBonBojoRequiredItem,
} from './bonBojoRules.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {Map<string, boolean>}
 */
function enabledByItemIdFromRules(rules) {
  /** @type {Map<string, boolean>} */
  const map = new Map();
  for (const r of rules) {
    if (r.patternKind !== 'auxiliary-verb') continue;
    const id = r.bonBojoItemId?.trim();
    if (!id) continue;
    if (r.enabled === true) map.set(id, true);
    else if (!map.has(id)) map.set(id, false);
  }
  return map;
}

/**
 * 본조 규칙을 시트 stems에서 매번 재생성 — 저장된 옛 find·tailWord(해왔 등)로 오다만 0건인 문제 방지
 * @param {import('./ruleTypes.js').Rule[]} nonAux
 * @param {Map<string, boolean>} enabledByItem
 */
function rebuildAuxiliaryVerbRulesFromSheet(nonAux, enabledByItem) {
  /** @type {import('./ruleTypes.js').Rule[]} */
  const aux = [];

  for (const group of getBonBojoGroups()) {
    for (const item of group.items) {
      const itemId = item.id;
      const listLabel =
        item.displayLabel?.trim() ||
        bonBojoDisplayLabelForItem(itemId) ||
        encodeSpacesVisible(item.label);

      const logicOnly = isBonBojoLogicOnlyItem(itemId);
      const enabled = logicOnly
        ? true
        : enabledByItem.has(itemId)
          ? enabledByItem.get(itemId)
          : isBonBojoRequiredItem(itemId);

      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        for (const row of buildAuxiliaryVerbFindRules(tail)) {
          aux.push({
            ...row,
            enabled: Boolean(enabled),
            label: listLabel,
            bonBojoItemId: itemId,
          });
        }
      }
    }
  }

  return [...nonAux, ...aux];
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function ensureDefaultAuxiliaryVerbs(customRules) {
  const rules = [...(customRules ?? [])];
  const nonAux = rules.filter((r) => r.patternKind !== 'auxiliary-verb');
  const enabledByItem = enabledByItemIdFromRules(rules);
  let next = rebuildAuxiliaryVerbRulesFromSheet(nonAux, enabledByItem);

  return applyBonBojoDisplayLabels(
    syncBonBojoSheetEnabledFlags(forceLogicOnlyAuxiliaryEnabled(next)),
  );
}

/**
 * 시트 item.enabled=true인데 저장 규칙이 전부 꺼져 있으면 — 첫 실행 시 본조가 안 도는 경우 방지
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
function syncBonBojoSheetEnabledFlags(rules) {
  let next = rules;
  for (const group of getBonBojoGroups()) {
    for (const item of group.items) {
      const id = item.id;
      if (!isBonBojoRequiredItem(id)) continue;
      const groupRules = next.filter(
        (r) =>
          r.patternKind === 'auxiliary-verb' && r.bonBojoItemId?.trim() === id,
      );
      if (!groupRules.length || groupRules.some((r) => r.enabled)) continue;
      next = next.map((r) =>
        groupRules.includes(r) ? { ...r, enabled: true } : r,
      );
    }
  }
  return next;
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
