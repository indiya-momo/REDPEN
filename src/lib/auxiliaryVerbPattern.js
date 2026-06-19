import {
  AUXILIARY_FLEX_SPACE,
  COMPOUND_PREFIX,
  HANGUL_SUFFIX,
  STEM_TAIL_BOUNDARY,
  STEM_TAIL_END,
  escapeRegex,
  isAuxiliaryStem,
  isHaeBoPattern,
} from './compoundPatternCommon.js';
import { buildAdjectiveCheHadaRules, isAdjectiveCheHadaTail } from './adjectiveCheHadaPattern.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

const AUX_SPACE = AUXILIARY_FLEX_SPACE;

/**
 * 보조 tail 1음절 뒤 명사·다른 동사로 이어지는 오탐 방지
 * (주택·지급·보상 등 — STEM_TAIL_END가 음절을 더 먹는 경우)
 */
const AUX_TAIL_FORBIDDEN_AFTER = {
  하: '루|하|히|허|할|함|합|핫',
  주: '택|민|식|문|장|의|재|권|년|일|번|소',
  지: '급|역|금|구|도|원|적|시|명|점|체|속|식|연|출',
  보: '상|통|율|안|류|수|호|증|장|험|관|고서',
};

/**
 * @param {string} head
 * @param {string} tailSyl
 */
function auxStem(head, tailSyl) {
  const forbid = AUX_TAIL_FORBIDDEN_AFTER[tailSyl];
  const tailPart = forbid
    ? String.raw`${escapeRegex(tailSyl)}(?!${forbid})${STEM_TAIL_END}`
    : String.raw`${escapeRegex(tailSyl)}${STEM_TAIL_END}`;
  return String.raw`(\S*${escapeRegex(head)})${AUX_SPACE}(${tailPart})(?!으로)${STEM_TAIL_BOUNDARY}`;
}

/**
 * 시트 stems(아 하, 해 보 …) — 띄움만 검색
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {import('./ruleTypes.js').Rule} base
 * @param {string} head
 * @param {string} tailSyl
 */
function pushSpacedStemRule(rules, base, head, tailSyl) {
  rules.push({ ...base, find: auxStem(head, tailSyl) });
}

/**
 * 본용언+보조용언 — 시트 stem 그대로(공백 있는 띄움형만)
 * @param {string} tailWord
 */
export function buildAuxiliaryVerbFindRules(tailWord) {
  const tail = tailWord.trim();
  if (!tail) return [];

  if (isAdjectiveCheHadaTail(tail)) {
    return buildAdjectiveCheHadaRules(tail);
  }

  const esc = escapeRegex(tail.split(/\s+/).join(''));

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
    pushSpacedStemRule(rules, base, '해', '보');
    return rules;
  }

  if (/\s/.test(tail)) {
    const parts = tail.split(/\s+/).filter(Boolean);
    if (parts.length === 2) {
      pushSpacedStemRule(rules, base, parts[0], parts[1]);
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

