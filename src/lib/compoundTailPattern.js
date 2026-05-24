import {
  COMPOUND_PREFIX,
  FLEX_SPACE,
  HANGUL_SUFFIX,
  PHRASE_START,
  escapeRegex,
  isAuxiliaryStem,
  isHaeBoPattern,
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
  if (!tailFrag && !isAuxiliaryStem(tail)) return [];

  const glued = parts.join('');
  const { excludePrefixes = [] } = options;

  const base = {
    enabled: true,
    pattern: 'regex',
    patternKind: 'compound-tail',
    tailWord: tail,
    excludePrefixes,
    label: formatCompoundTailLabel(tail),
  };

  /** @type {import('./ruleTypes.js').Rule[]} */
  const rules = [];

  if (parts.length === 1 && isAuxiliaryStem(parts[0])) {
    const esc = escapeRegex(parts[0]);
    rules.push({
      ...base,
      find: String.raw`${COMPOUND_PREFIX}${FLEX_SPACE}${esc}${HANGUL_SUFFIX}(?!으로)`,
      replace: `$1${parts[0]}`,
    });
  } else if (parts.length >= 2 && isHaeBoPattern(tail)) {
    rules.push({
      ...base,
      find: String.raw`(\S*해)${FLEX_SPACE}(보${HANGUL_SUFFIX})(?!으로)`,
      replace: `$1$2`,
    });
  } else {
    rules.push({
      ...base,
      find: String.raw`${COMPOUND_PREFIX}${FLEX_SPACE}${tailFrag}${HANGUL_SUFFIX}(?!으로)`,
      replace: `$1${glued}`,
    });

    if (parts.length >= 2) {
      rules.push({
        ...base,
        find: String.raw`${PHRASE_START}${tailFrag}${HANGUL_SUFFIX}(?!으로)`,
        replace: glued,
      });
    }
  }

  return rules;
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
