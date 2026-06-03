const GAP = '[\\s\\u00A0\\n\\r\\u200B\\uFEFF]*';
const GAP_REQ = '[\\s\\u00A0\\n\\r\\u200B\\uFEFF]+';

function escapeRegexLiteral(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    const wordParts = trimmed.split(/\s+/).filter(Boolean);
    const body = wordParts
      .map((word) => {
        const esc = escapeRegexLiteral(word);
        if (word.length <= 1) return esc;
        return esc.split('').join(GAP);
      })
      .join(GAP_REQ);

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
