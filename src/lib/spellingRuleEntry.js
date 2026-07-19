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
 * @returns {{ find: string, replace: string }}
 */
export function spellingRuleChecklistParts(entry) {
  const custom = String(entry.displayLabel ?? '').trim();
  const finds = (entry.finds ?? []).map((f) => String(f).trim()).filter(Boolean);
  const leftFromFinds =
    finds.length >= 2 ? finds.join(', ') : String(entry.find ?? '').trim();

  if (custom.startsWith('→')) {
    return {
      find: leftFromFinds || String(entry.find ?? '').trim(),
      replace: custom.replace(/^→\s*/, ''),
    };
  }
  if (custom.includes('→')) {
    const idx = custom.indexOf('→');
    const left = custom.slice(0, idx).trim();
    const right = custom.slice(idx + 1).trim();
    return {
      find: left || leftFromFinds || String(entry.find ?? '').trim(),
      replace: right || String(entry.replace ?? '').trim(),
    };
  }
  if (custom) {
    return {
      find: custom,
      replace: String(entry.replace ?? '').trim(),
    };
  }
  return {
    find: String(entry.find ?? '').trim(),
    replace: String(entry.replace ?? '').trim(),
  };
}

/**
 * @param {{ find: string, replace: string, finds?: string[], displayLabel?: string }} entry
 */
export function spellingRuleDisplayLabel(entry) {
  const { find, replace } = spellingRuleChecklistParts(entry);
  if (!find) return replace;
  if (!replace) return find;
  return `${find} → ${replace}`;
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
  const label = spellingRuleDisplayLabel(rule);

  if (finds.length < 2) {
    return { ...rule, label };
  }

  const alternation = compileSpellingFindsAlternation(finds);
  const spellingRuleId = String(rule.ruleId ?? '').trim() || rule.find;

  return {
    ...rule,
    find: alternation,
    pattern: 'regex',
    spellingRuleId,
    label,
    spellingFinds: finds,
  };
}
