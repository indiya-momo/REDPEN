import { parseCommaList } from './matchFilters.js';

/** @param {string} s */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} tailWord
 * @param {{ excludePrefixes?: string[] }} [options]
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function buildCompoundTailRules(tailWord, options = {}) {
  const tail = tailWord.trim();
  if (!tail) return [];

  const esc = escapeRegex(tail);
  const { excludePrefixes = [] } = options;

  return [
    {
      find: String.raw`([\uAC00-\uD7A3A-Za-z]{2,})[ \u00A0]+${esc}(?!으로)`,
      replace: `$1${tail}`,
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-tail',
      tailWord: tail,
      excludePrefixes,
      label: `○○ ${tail} → ○○${tail}`,
    },
  ];
}

/**
 * @param {string} input — 꼬리 단어 여러 개: "정책, 상황"
 * @returns {string[]}
 */
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
