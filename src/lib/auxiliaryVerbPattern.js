import {
  AUXILIARY_FLEX_SPACE,
  COMPOUND_PREFIX,
  HANGUL_SUFFIX,
  PHRASE_START,
  buildSpacedStemFindPattern,
  escapeRegex,
  isAuxiliaryStem,
  isHaeBoPattern,
} from './compoundPatternCommon.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

const AUX_SPACE = AUXILIARY_FLEX_SPACE;
const auxStem = (head, tail) =>
  buildSpacedStemFindPattern(head, tail, AUX_SPACE);

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
      find: String.raw`${COMPOUND_PREFIX}${AUX_SPACE}${escapeRegex(tail)}${HANGUL_SUFFIX}(?!으로)`,
    });
    return rules;
  }

  if (isHaeBoPattern(tail)) {
    if (/\s/.test(tail)) {
      rules.push({
        ...base,
        find: auxStem('해', '보'),
      });
      return rules;
    }
    rules.push({
      ...base,
      find: String.raw`${PHRASE_START}${escapeRegex(glued)}${HANGUL_SUFFIX}(?!\S)`,
    });
    rules.push({
      ...base,
      find: auxStem('해', '보'),
    });
    return rules;
  }

  if (/\s/.test(tail)) {
    const parts = tail.split(/\s+/).filter(Boolean);
    if (parts.length === 2) {
      rules.push({
        ...base,
        find: auxStem(parts[0], parts[1]),
      });
      return rules;
    }
    const tailFrag = parts.map(escapeRegex).join(AUX_SPACE);
    rules.push({
      ...base,
      find: String.raw`${COMPOUND_PREFIX}${AUX_SPACE}${tailFrag}${HANGUL_SUFFIX}(?!으로)`,
    });
    return rules;
  }

  rules.push({
    ...base,
    find: String.raw`${COMPOUND_PREFIX}${AUX_SPACE}${esc}${HANGUL_SUFFIX}(?!으로)`,
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
