/** 시트 divider_group F = 「교육부 개정 용어」 */
const EDUCATION_MINISTRY_DIVIDER_GROUP = 'F';

/** dividerGroup → 아코디언 제목 옆 보조 문구(UI 전용, 시트·엑셀 묶음 열과 분리) */
const SPELLING_BUNDLE_UI_NOTES = {
  [EDUCATION_MINISTRY_DIVIDER_GROUP]:
    '※기존 용어도 표준어로 사용 가능',
};

/**
 * @param {string} dividerGroup
 */
function spellingBundleUiNote(dividerGroup) {
  const key = String(dividerGroup ?? '').trim();
  if (!key || key.startsWith('__single_')) return '';
  return SPELLING_BUNDLE_UI_NOTES[key] ?? '';
}

/**
 * @param {string} raw
 */
export function normalizeDividerLabel(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed === '-') return '';
  return trimmed;
}

/**
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function spellingBundleDisplayLabel(rule) {
  const fromLabel = normalizeDividerLabel(rule.dividerLabel);
  if (fromLabel) return fromLabel;
  const fromGroup = String(rule.dividerGroup ?? '').trim();
  if (fromGroup) return fromGroup;
  return rule.find;
}

/**
 * dividerGroup이 있으면 같은 키끼리 묶고, 없으면 단독 묶음으로 처리
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {{ key: string, rules: import('./ruleTypes.js').Rule[] }[]}
 */
export function groupRulesByDivider(rules) {
  /** @type {{ key: string, rules: import('./ruleTypes.js').Rule[] }[]} */
  const groups = [];
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const key = String(rule.dividerGroup ?? '').trim();
    if (!key) {
      groups.push({ key: `__single_${rule.find}_${i}`, rules: [rule] });
      continue;
    }
    const prev = groups[groups.length - 1];
    if (prev && prev.key === key) {
      prev.rules.push(rule);
    } else {
      groups.push({ key, rules: [rule] });
    }
  }
  return groups;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {{ id: string, label: string, uiNote: string, rules: import('./ruleTypes.js').Rule[], ruleCount: number }[]}
 */
export function buildSpellingRuleBundles(rules) {
  return groupRulesByDivider(rules).map((group) => ({
    id: group.key,
    label: spellingBundleDisplayLabel(group.rules[0]),
    uiNote: spellingBundleUiNote(group.key),
    rules: group.rules,
    ruleCount: group.rules.length,
  }));
}
