import {
  COMPOUND_PREFIX,
  FLEX_SPACE,
  tailRegexFragment,
} from './compoundPatternCommon.js';
import { parseCommaList } from './matchFilters.js';
import { formatCompoundTailLabel } from './patternDisplayLabels.js';

/**
 * @param {string} tailWord
 * @param {{ excludePrefixes?: string[] }} [options]
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function buildCompoundTailRules(tailWord, options = {}) {
  const tail = tailWord.trim();
  if (!tail) return [];

  const parts = tail.split(/\s+/).filter(Boolean);
  const tailFrag = tailRegexFragment(tail);
  if (!tailFrag) return [];

  const glued = parts.join('');
  const { excludePrefixes = [] } = options;

  return [
    {
      find: String.raw`${COMPOUND_PREFIX}${FLEX_SPACE}${tailFrag}(?!으로)`,
      replace: `$1${glued}`,
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-tail',
      tailWord: tail,
      excludePrefixes,
      label: formatCompoundTailLabel(tail),
    },
  ];
}

/** @param {string} input */
export function parseTailWords(input) {
  return parseCommaList(input);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function hasCompoundTail(rules, tailWord) {
  const t = tailWord.trim();
  return rules.some(
    (r) => r.patternKind === 'compound-tail' && r.tailWord === t,
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function removeCompoundTail(rules, tailWord) {
  const t = tailWord.trim();
  return rules.filter(
    (r) => !(r.patternKind === 'compound-tail' && r.tailWord === t),
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function getCompoundTailMeta(rules, tailWord) {
  const r = rules.find(
    (x) => x.patternKind === 'compound-tail' && x.tailWord === tailWord,
  );
  return {
    excludePrefixes: r?.excludePrefixes ?? [],
  };
}
