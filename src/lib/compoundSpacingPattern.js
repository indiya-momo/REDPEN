import {
  COMPOUND_PREFIX,
  escapeRegex,
} from './compoundPatternCommon.js';
import { parseCommaList } from './matchFilters.js';
import { formatCompoundSpacingLabel } from './patternDisplayLabels.js';

/**
 * @param {string} tailWord
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function buildCompoundSpacingRules(tailWord) {
  const tail = tailWord.trim();
  if (!tail) return [];

  const parts = tail.split(/\s+/).filter(Boolean);
  const glued = parts.join('');
  const esc = escapeRegex(glued);
  const spaced = parts.length >= 2 ? parts.join(' ') : tail;

  return [
    {
      find: String.raw`${COMPOUND_PREFIX}${esc}(?!\s)`,
      replace: `$1 ${spaced}`,
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-spacing',
      tailWord: tail,
      label: formatCompoundSpacingLabel(tail),
    },
  ];
}

/** @param {string} input */
export function parseSpacingTailWords(input) {
  return parseCommaList(input);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function hasCompoundSpacing(rules, tailWord) {
  const t = tailWord.trim();
  return rules.some(
    (r) => r.patternKind === 'compound-spacing' && r.tailWord === t,
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function removeCompoundSpacing(rules, tailWord) {
  const t = tailWord.trim();
  return rules.filter(
    (r) => !(r.patternKind === 'compound-spacing' && r.tailWord === t),
  );
}
