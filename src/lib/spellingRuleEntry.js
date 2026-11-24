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
    // →가 없는 display_label은 분류 이름(예: 사잇소리, ^중) — 적힌 그대로만 보인다(^도 그대로)
    return {
      find: custom,
      replace: '',
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
 * 앞말이 붙은 형태(예: 「이것 뿐」의 「것 뿐」, 「그럴듯 하다」의 「듯 하」)를 일부러 잡는 띄어쓰기 규칙.
 * 시트에 allow_attached_prefix 열이 없을 때를 위한 기본 목록 — 시트 열(TRUE)이 있으면 그쪽이 우선.
 */
export const SPELLING_ALLOW_ATTACHED_PREFIX_FINDS = new Set(['것 뿐', '듯 하']);

/** @param {string | undefined} ch */
export function isHangulSyllable(ch) {
  return typeof ch === 'string' && ch.length === 1 && ch >= '가' && ch <= '힣';
}

/** @param {unknown} f */
function findHasInnerSpace(f) {
  return /\s/.test(String(f ?? '').trim());
}

/**
 * 띄어쓰기 규칙(봄 밤 → 봄밤, 물 속 → 물속)은 첫 어절이 독립된 말이어야 한다.
 * 「건물 속」「작품 속」처럼 바로 앞에 한글 음절이 붙은 매칭은 제외한다.
 * - 모든 이형태(finds 없으면 find)가 띄어 쓴 형태일 때만 켠다.
 *   붙여 쓴 오기(되요·쥬스·성장율 등)는 「안되요」「오렌지쥬스」처럼 앞말 붙은 형태를 일부러 잡으므로 제외.
 * - allowAttachedPrefix(시트 allow_attached_prefix) 또는 기본 목록에 있으면 끈다.
 * - 뒤 경계는 보지 않는다(물 속에서·물 속도 등 조사 허용).
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function spellingRuleNeedsLeadingHangulBoundary(rule) {
  if (rule.allowAttachedPrefix === true) return false;
  if (rule.pattern === 'regex') return false;
  const primary = String(rule.find ?? '').trim();
  if (!primary) return false;
  if (SPELLING_ALLOW_ATTACHED_PREFIX_FINDS.has(primary)) return false;
  const finds = rule.finds?.filter(Boolean) ?? [];
  const variants = finds.length >= 2 ? finds : [primary];
  return variants.every(findHasInnerSpace);
}

/**
 * 시트 행 → 검사용 Rule (finds 없으면 입력 그대로)
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function buildSpellingCheckRuleFromBuiltIn(rule) {
  const finds = rule.finds?.filter(Boolean) ?? [];
  const label = spellingRuleDisplayLabel(rule);
  const boundary = spellingRuleNeedsLeadingHangulBoundary(rule)
    ? { spellingLeadingHangulBoundary: true }
    : {};

  if (finds.length < 2) {
    return { ...rule, label, ...boundary };
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
    ...boundary,
  };
}
