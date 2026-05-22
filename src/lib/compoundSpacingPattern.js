import { parseCommaList } from './matchFilters.js';

/** @param {string} s */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 붙임의 반대: ○○[단어] → ○○ [단어]
 * @param {string} tailWord
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function buildCompoundSpacingRules(tailWord) {
  const tail = tailWord.trim();
  if (!tail) return [];

  const esc = escapeRegex(tail);

  return [
    {
      find: String.raw`(\S+)${esc}(?!\s)`,
      replace: `$1 ${tail}`,
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-spacing',
      tailWord: tail,
      label: `○○${tail} → ○○ ${tail}`,
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
