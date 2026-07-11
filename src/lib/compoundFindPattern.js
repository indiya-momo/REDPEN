import { escapeRegex, tailRegexFragment } from './compoundPatternCommon.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/**
 * 문자열 찾기 — 등록 문자열 그대로 (경제˅전망, 경제전망, 김말이 …)
 * @param {string} tailWord
 * @param {{ excludePrefixes?: string[], requireLeadingBoundary?: boolean }} [options]
 */
export function buildCompoundFindRules(tailWord, options = {}) {
  const tail = tailWord.trim();
  if (!tail) return [];

  const tailFrag = tailRegexFragment(tail);
  const esc = escapeRegex(tail.replace(/\s+/g, ''));
  const { excludePrefixes = [], requireLeadingBoundary = false } = options;

  const base = {
    enabled: true,
    pattern: 'regex',
    patternKind: 'compound-find',
    tailWord: tail,
    replace: '$0',
    excludePrefixes,
    label: encodeSpacesVisible(tail),
  };

  if (/\s/.test(tail)) {
    if (!tailFrag) return [];
    return [
      {
        ...base,
        find: tailFrag,
        requireLeadingBoundary,
      },
    ];
  }

  return [
    {
      ...base,
      find: esc,
      requireLeadingBoundary,
    },
  ];
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} tailWord */
export function hasCompoundFind(rules, tailWord) {
  const t = tailWord.trim();
  return rules.some(
    (r) =>
      (r.patternKind === 'compound-find' ||
        r.patternKind === 'compound-tail' ||
        r.patternKind === 'compound-spacing') &&
      r.tailWord === t,
  );
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} tailWord */
export function removeCompoundFind(rules, tailWord) {
  const t = tailWord.trim();
  return rules.filter(
    (r) =>
      !(
        (r.patternKind === 'compound-find' ||
          r.patternKind === 'compound-tail' ||
          r.patternKind === 'compound-spacing') &&
        r.tailWord === t
      ),
  );
}
