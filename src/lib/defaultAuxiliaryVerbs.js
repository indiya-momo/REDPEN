import { buildAuxiliaryVerbFindRules, buildLongCompoundSplitRules } from './auxiliaryVerbPattern.js';
import {
  getBonBojoGroups,
  bonBojoDisplayLabelForItem,
  auxiliarySearchTailsFromBonBojoItem,
  isBonBojoLogicOnlyItem,
  isBonBojoGateOnlyItem,
  isBonBojoRequiredItem,
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  BON_BOJO_LONG_COMPOUND_SPLIT_LABEL,
  BON_BOJO_NON_AEO_SPACE_ID,
  BON_BOJO_NON_AEO_SPACE_LABEL,
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

/** 다른 본조 항목의 띄움 stem(`져 주`)만 — 3음절 복합어 칸 1차 찾기용 */
function spacedStemsFromGroups() {
  /** @type {string[]} */
  const stems = [];
  for (const group of getBonBojoGroups()) {
    for (const item of group.items) {
      if (item.id === BON_BOJO_LONG_COMPOUND_SPLIT_ID) continue;
      if (isBonBojoGateOnlyItem(item.id)) continue;
      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        const parts = String(tail ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length === 2) stems.push(`${parts[0]} ${parts[1]}`);
      }
    }
  }
  return [...new Set(stems)];
}

/**
 * 본조 규칙을 시트 stems에서 매번 재생성 — 저장된 옛 find·tailWord(해왔 등)로 오다만 0건인 문제 방지
 * @param {import('./ruleTypes.js').Rule[]} nonAux
 * @param {Map<string, boolean>} enabledByItem
 */
function rebuildAuxiliaryVerbRulesFromSheet(nonAux, enabledByItem) {
  /** @type {import('./ruleTypes.js').Rule[]} */
  const aux = [];
  const spacedStems = spacedStemsFromGroups();

  for (const group of getBonBojoGroups()) {
    for (const item of group.items) {
      const itemId = item.id;
      const listLabel =
        item.displayLabel?.trim() ||
        bonBojoDisplayLabelForItem(itemId) ||
        encodeSpacesVisible(item.label);

      const logicOnly = isBonBojoLogicOnlyItem(itemId);
      const gateOnly = isBonBojoGateOnlyItem(itemId);
      // 게이트·일반: 저장값 없으면 필수 item만 기본 on (게이트는 기본 off)
      const enabled = logicOnly
        ? true
        : enabledByItem.has(itemId)
          ? enabledByItem.get(itemId)
          : gateOnly
            ? false
            : isBonBojoRequiredItem(itemId);

      if (gateOnly) {
        aux.push({
          enabled: Boolean(enabled),
          pattern: 'regex',
          patternKind: 'auxiliary-verb',
          bonBojoItemId: BON_BOJO_NON_AEO_SPACE_ID,
          auxNonAeoGate: true,
          // 1차 엔진에 안 넣음(useRuleCheck 필터). enabled 토글용 자리만.
          find: '(?![\\s\\S])',
          replace: '$0',
          tailWord: BON_BOJO_NON_AEO_SPACE_ID,
          label: listLabel || BON_BOJO_NON_AEO_SPACE_LABEL,
          tip: '본용언 연결이 -아/-어가 아니면 보조용언을 띄어 씁니다.',
        });
        continue;
      }

      if (itemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID) {
        for (const row of buildLongCompoundSplitRules(spacedStems)) {
          aux.push({
            ...row,
            enabled: Boolean(enabled),
            label: listLabel || BON_BOJO_LONG_COMPOUND_SPLIT_LABEL,
            bonBojoItemId: itemId,
          });
        }
        continue;
      }

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
    forceLogicOnlyAuxiliaryEnabled(next),
  );
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
