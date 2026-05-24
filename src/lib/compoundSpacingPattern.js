import {
  COMPOUND_PREFIX,
  HANGUL_SUFFIX,
  PHRASE_START,
  escapeRegex,
  isHaeBoPattern,
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

  const base = {
    enabled: true,
    pattern: 'regex',
    patternKind: 'compound-spacing',
    tailWord: tail,
    label: formatCompoundSpacingLabel(tail),
  };

  /** @type {import('./ruleTypes.js').Rule[]} */
  const rules = [
    {
      ...base,
      find: String.raw`${PHRASE_START}${esc}${HANGUL_SUFFIX}(?!\S)`,
      replace: spaced,
    },
    {
      ...base,
      find: String.raw`${COMPOUND_PREFIX}${esc}${HANGUL_SUFFIX}(?!\s)`,
      replace: `$1 ${spaced}`,
    },
  ];

  if (isHaeBoPattern(tail)) {
    rules.push({
      ...base,
      find: String.raw`(\S*해)(보${HANGUL_SUFFIX})(?!\s)`,
      replace: '$1 $2',
    });
  }

  return rules;
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
