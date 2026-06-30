import { compileSpellingFindsAlternation } from './regexFromFind.js';

/**
 * @param {{ ruleId?: string, find: string, finds?: string[] }} entry
 */
export function builtInEnabledKey(entry) {
  const id = String(entry.ruleId ?? '').trim();
  if (id) return id;
  return entry.find;
}

/**
 * @param {string} raw
 * @param {string} primaryFind
 * @returns {string[] | null} 2개 이상일 때만
 */
export function parseSpellingFindsColumn(raw, primaryFind) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const parts = text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  const primary = String(primaryFind ?? '').trim();
  if (primary && !unique.includes(primary)) {
    unique.unshift(primary);
  }
  if (unique.length < 2) return null;
  return unique;
}

/**
 * @param {{ find: string, replace: string, finds?: string[], displayLabel?: string }} entry
 */
export function spellingRuleDisplayLabel(entry) {
  const custom = String(entry.displayLabel ?? '').trim();
  if (custom) return custom;

  const finds = entry.finds?.filter(Boolean) ?? [];
  if (finds.length >= 2) {
    const sorted = [...finds].sort((a, b) => a.localeCompare(b, 'ko'));
    return `${sorted.join('·')} → ${entry.replace}`;
  }
  return `${entry.find} → ${entry.replace}`;
}

/**
 * @param {{ finds?: string[] }} entry
 */
export function hasSpellingFindVariants(entry) {
  return (entry.finds?.filter(Boolean).length ?? 0) >= 2;
}

/**
 * 시트 행 → 검사용 Rule (finds 없으면 입력 그대로)
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function buildSpellingCheckRuleFromBuiltIn(rule) {
  const finds = rule.finds?.filter(Boolean) ?? [];
  if (finds.length < 2) {
    return rule;
  }

  const alternation = compileSpellingFindsAlternation(finds);
  const spellingRuleId = String(rule.ruleId ?? '').trim() || rule.find;
  const label = spellingRuleDisplayLabel(rule);

  return {
    ...rule,
    find: alternation,
    pattern: 'regex',
    spellingRuleId,
    label,
    spellingFinds: finds,
  };
}
