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
 * 시트 divider_group 코드 → 화면에서 합쳐 보여 줄 한 폴더.
 * 일반적인 접두어 병합은 하지 않는다(A1/A2/A, C/C1/C2는 따로 둔다).
 * 규칙의 dividerGroup 값은 바꾸지 않는다(B1 자동 전개·엑셀 내보내기가 원래 코드를 씀).
 * @type {Record<string, { bundleId: string, label: string, order: number }>}
 */
export const SPELLING_BUNDLE_MERGE = {
  B0: { bundleId: 'B', label: '잘못된 표현', order: 0 },
  B1: { bundleId: 'B', label: '잘못된 표현', order: 1 },
  B2: { bundleId: 'B', label: '잘못된 표현', order: 2 },
};

/**
 * @param {import('./ruleTypes.js').Rule} a
 * @param {import('./ruleTypes.js').Rule} b
 */
function compareMergedBundleRules(a, b) {
  const oa = SPELLING_BUNDLE_MERGE[String(a.dividerGroup ?? '').trim()]?.order ?? 0;
  const ob = SPELLING_BUNDLE_MERGE[String(b.dividerGroup ?? '').trim()]?.order ?? 0;
  if (oa !== ob) return oa - ob;
  return String(a.find ?? '').localeCompare(String(b.find ?? ''), 'ko');
}

/**
 * 합쳐질 묶음(B0~B2)은 목록 어디에 있든 한 폴더로 모은다.
 * 폴더는 처음 나온 코드 자리에 두고, 안에서는 코드 순 → find 가나다순.
 * 나머지는 기존처럼 연속된 dividerGroup끼리 묶는다.
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {{ id: string, label: string, uiNote: string, rules: import('./ruleTypes.js').Rule[], ruleCount: number }[]}
 */
export function buildSpellingRuleBundles(rules) {
  /** @type {Map<string, import('./ruleTypes.js').Rule[]>} */
  const merged = new Map();
  /** @type {import('./ruleTypes.js').Rule[]} */
  const rest = [];
  /** @type {(string | null)[]} 합쳐질 폴더가 처음 나온 자리 표시 */
  const slots = [];
  for (const rule of rules) {
    const conf = SPELLING_BUNDLE_MERGE[String(rule.dividerGroup ?? '').trim()];
    if (!conf) {
      rest.push(rule);
      slots.push(null);
      continue;
    }
    if (!merged.has(conf.bundleId)) {
      merged.set(conf.bundleId, []);
      slots.push(conf.bundleId);
    }
    merged.get(conf.bundleId).push(rule);
  }

  /** @type {ReturnType<typeof buildSpellingRuleBundles>} */
  const out = [];
  /** @type {import('./ruleTypes.js').Rule[]} */
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    for (const group of groupRulesByDivider(pending)) {
      out.push({
        id: group.key,
        label: spellingBundleDisplayLabel(group.rules[0]),
        uiNote: spellingBundleUiNote(group.key),
        rules: group.rules,
        ruleCount: group.rules.length,
      });
    }
    pending = [];
  };
  let restIdx = 0;
  for (const slot of slots) {
    if (slot === null) {
      pending.push(rest[restIdx]);
      restIdx += 1;
      continue;
    }
    flush();
    const bundleRules = [...merged.get(slot)].sort(compareMergedBundleRules);
    const conf = Object.values(SPELLING_BUNDLE_MERGE).find((c) => c.bundleId === slot);
    out.push({
      id: slot,
      label: conf?.label ?? slot,
      uiNote: spellingBundleUiNote(slot),
      rules: bundleRules,
      ruleCount: bundleRules.length,
    });
  }
  flush();
  return out;
}
