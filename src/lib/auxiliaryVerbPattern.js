import {
  COMPOUND_PREFIX,
  FLEX_SPACE,
  HANGUL_SUFFIX,
  PHRASE_START,
  escapeRegex,
  isAuxiliaryStem,
  isHaeBoPattern,
} from './compoundPatternCommon.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/**
 * 본용언+보조용언 — 등록 형태 그대로 (보, 주, 해˅보, 해보 …)
 * @param {string} tailWord
 */
export function buildAuxiliaryVerbFindRules(tailWord) {
  const tail = tailWord.trim();
  if (!tail) return [];

  const esc = escapeRegex(tail.split(/\s+/).join(''));
  const glued = tail.replace(/\s+/g, '');

  const base = {
    enabled: true,
    pattern: 'regex',
    patternKind: 'auxiliary-verb',
    tailWord: tail,
    replace: '$0',
    label: encodeSpacesVisible(tail),
  };

  /** @type {import('./ruleTypes.js').Rule[]} */
  const rules = [];

  if (isAuxiliaryStem(tail)) {
    rules.push({
      ...base,
      find: String.raw`${COMPOUND_PREFIX}${FLEX_SPACE}${escapeRegex(tail)}${HANGUL_SUFFIX}(?!으로)`,
    });
    return rules;
  }

  if (isHaeBoPattern(tail)) {
    if (/\s/.test(tail)) {
      rules.push({
        ...base,
        find: String.raw`(\S*해)${FLEX_SPACE}(보${HANGUL_SUFFIX})(?!으로)`,
      });
      return rules;
    }
    rules.push({
      ...base,
      find: String.raw`${PHRASE_START}${escapeRegex(glued)}${HANGUL_SUFFIX}(?!\S)`,
    });
    // *해 + 공백 + 보 + 어미 (상상해 보아요, 먹어 보자)
    rules.push({
      ...base,
      find: String.raw`(\S*해)${FLEX_SPACE}(보${HANGUL_SUFFIX})(?!으로)`,
    });
    return rules;
  }

  if (/\s/.test(tail)) {
    const parts = tail.split(/\s+/).filter(Boolean);
    const tailFrag = parts.map(escapeRegex).join(FLEX_SPACE);
    rules.push({
      ...base,
      find: String.raw`${COMPOUND_PREFIX}${FLEX_SPACE}${tailFrag}${HANGUL_SUFFIX}(?!으로)`,
    });
    return rules;
  }

  rules.push({
    ...base,
    find: String.raw`${COMPOUND_PREFIX}${FLEX_SPACE}${esc}${HANGUL_SUFFIX}(?!으로)`,
  });
  return rules;
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} tailWord */
export function hasAuxiliaryVerbFind(rules, tailWord) {
  const t = tailWord.trim();
  return rules.some(
    (r) => r.patternKind === 'auxiliary-verb' && r.tailWord === t,
  );
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} tailWord */
export function removeAuxiliaryVerbFind(rules, tailWord) {
  const t = tailWord.trim();
  return rules.filter(
    (r) => !(r.patternKind === 'auxiliary-verb' && r.tailWord === t),
  );
}
