/**
 * @param {import('./ruleTypes.js').Rule} rule
 * @returns {RegExp | null}
 */
export function compileRuleRegex(rule) {
  const isRegex = rule.pattern === 'regex';
  try {
    if (isRegex) {
      return new RegExp(rule.find, 'gu');
    }
    const escaped = rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flexible = escaped.replace(/\s+/g, '[ \\u00A0]+');
    return new RegExp(flexible, 'gu');
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
  formatCompoundSpacingLabel,
  formatCompoundTailLabel,
} from './patternDisplayLabels.js';

/**
 * @param {import('./ruleTypes.js').Rule} rule
 */
export function ruleDisplayLabel(rule) {
  if (rule.patternKind === 'compound-tail' && rule.tailWord) {
    return formatCompoundTailLabel(rule.tailWord);
  }
  if (rule.patternKind === 'compound-spacing' && rule.tailWord) {
    return formatCompoundSpacingLabel(rule.tailWord);
  }
  if (rule.label) return rule.label;
  return `${rule.find} → ${rule.replace}`;
}
