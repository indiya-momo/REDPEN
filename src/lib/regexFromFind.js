const GAP = '[\\s\\u00A0\\n\\r\\u200B\\uFEFF]*';
const GAP_REQ = '[\\s\\u00A0\\n\\r\\u200B\\uFEFF]+';
/** find에 띄어쓰기 없음 — PDF 줄바꿈만 허용(일반 공백은 시트 find와 불일치) */
const LINE_BREAK_GAP = '[\\n\\r]*';

function escapeRegexLiteral(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} trimmed
 */
export function compileLiteralFindBody(trimmed) {
  const wordParts = trimmed.split(/\s+/).filter(Boolean);
  if (!wordParts.length) return null;

  if (wordParts.length === 1) {
    const word = wordParts[0];
    const esc = escapeRegexLiteral(word);
    if (word.length <= 1) return esc;
    return esc.split('').join(LINE_BREAK_GAP);
  }

  return wordParts
    .map((word) => {
      const esc = escapeRegexLiteral(word);
      if (word.length <= 1) return esc;
      return esc.split('').join(GAP);
    })
    .join(GAP_REQ);
}

/**
 * 맞춤법 finds[] → 단일 alternation 패턴 (각 변형은 literal find 규칙과 동일)
 * @param {string[]} finds
 */
export function compileSpellingFindsAlternation(finds) {
  const bodies = finds
    .map((f) => compileLiteralFindBody(String(f ?? '').trim()))
    .filter(Boolean);
  if (!bodies.length) return '';
  if (bodies.length === 1) return bodies[0];
  return `(?:${bodies.join('|')})`;
}

/**
 * @param {import('./ruleTypes.js').Rule} rule
 * @returns {RegExp | null}
 */
export function compileRuleRegex(rule) {
  try {
    if (rule.pattern === 'regex') {
      return new RegExp(rule.find, 'gu');
    }

    const trimmed = rule.find.trim();
    if (!trimmed) return null;

    const body = compileLiteralFindBody(trimmed);
    if (!body) return null;

    return new RegExp(body, 'gu');
  } catch {
    return null;
  }
}

/**
 * $1, $2 치환 (표시·안내용, 자동 수정 아님)
 * @param {string} template
 * @param {RegExpExecArray} match
 */
export function applyReplaceTemplate(template, match) {
  return template.replace(/\$(\d+)/g, (_, digits) => {
    const idx = Number(digits);
    return match[idx] ?? '';
  });
}

import {
  formatAuxiliaryVerbResultLabel,
  formatCompoundSpacingLabel,
  formatCompoundTailLabel,
} from './patternDisplayLabels.js';

/**
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function ruleDisplayLabel(rule) {
  if (
    (rule.patternKind === 'compound-find' ||
      rule.patternKind === 'compound-tail' ||
      rule.patternKind === 'compound-spacing' ||
      rule.patternKind === 'phrase-slot-find' ||
      rule.patternKind === 'auxiliary-verb') &&
    rule.tailWord
  ) {
    if (rule.patternKind === 'auxiliary-verb') {
      return formatAuxiliaryVerbResultLabel(rule.tailWord, rule.label);
    }
    return formatCompoundTailLabel(rule.tailWord);
  }
  if (rule.label) return rule.label;
  return `${rule.find} → ${rule.replace}`;
}
