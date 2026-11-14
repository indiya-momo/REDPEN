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
 * 폴더 안을 「같은 tip 묶음 → find 가나다순」으로 자동 정렬할 divider_group 코드.
 * 여기 없는 묶음은 시트 순서를 그대로 쓴다.
 */
export const TIP_SORTED_GROUPS = new Set(['B0', 'B1', 'B2']);

/**
 * tip 비교 키 — 앞뒤 공백을 지우고 연속 공백은 한 칸으로.
 * @param {unknown} tip
 */
export function normalizeTipKey(tip) {
  return String(tip ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {{ find?: string }} a
 * @param {{ find?: string }} b
 */
function compareFindKo(a, b) {
  return String(a.find ?? '').localeCompare(String(b.find ?? ''), 'ko');
}

/**
 * 같은 tip끼리 모으고(묶음 안은 find 가나다순), 묶음끼리는 첫 find 가나다순.
 * tip이 빈 행은 각자 단독 묶음. 입력 배열은 바꾸지 않는다(시트 정렬 스크립트에서도 재사용).
 * @template {{ find?: string, tip?: string }} T
 * @param {T[]} rules
 * @returns {T[]}
 */
export function sortRulesByTipThenFind(rules) {
  /** @type {Map<string, T[]>} */
  const clusters = new Map();
  rules.forEach((rule, i) => {
    const tip = normalizeTipKey(rule.tip);
    const key = tip || `\0empty_${i}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(rule);
  });
  const sorted = [...clusters.values()].map((list) => [...list].sort(compareFindKo));
  sorted.sort((a, b) => compareFindKo(a[0], b[0]));
  return sorted.flat();
}

/**
 * 연속된 dividerGroup끼리 묶는다. TIP_SORTED_GROUPS 묶음은 안을 tip → 가나다순으로 정렬.
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {{ id: string, label: string, uiNote: string, rules: import('./ruleTypes.js').Rule[], ruleCount: number }[]}
 */
export function buildSpellingRuleBundles(rules) {
  return groupRulesByDivider(rules).map((group) => {
    const groupRules = TIP_SORTED_GROUPS.has(group.key)
      ? sortRulesByTipThenFind(group.rules)
      : group.rules;
    return {
      id: group.key,
      label: spellingBundleDisplayLabel(group.rules[0]),
      uiNote: spellingBundleUiNote(group.key),
      rules: groupRules,
      ruleCount: groupRules.length,
    };
  });
}
