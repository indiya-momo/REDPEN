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
  // 이|일|여|였 — 보이다 활용(보이는·보일·보여·보였)을 보다 stem「보」로 오인하지 않음
  보: '상|통|율|안|류|수|호|증|장|험|관|고서|이|일|여|였',
  // 운|워|웠|움 — 어둡다 활용(어두운·어두워·어두움)을 두다 stem「두」로 오인하지 않음
  두: '운|워|웠|움',
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
 * 붙여 쓴 본용언+보조. 앞 캡처는 연결 음절을 포함한 3음절 이상.
 * @param {string[]} stems `어 주` 꼴
 */
export function buildLongCompoundSplitRules(stems) {
  /** @type {Set<string>} */
  const endings = new Set();
  /** @type {Map<string, string>} */
  const tails = new Map();
  for (const raw of stems) {
    const parts = String(raw ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length !== 2) continue;
    endings.add(parts[0]);
    if (!tails.has(parts[1])) tails.set(parts[1], tailAlternative(parts[1]));
  }
  if (!endings.size || !tails.size) return [];

  const endingAlt = [...endings]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const tailAlt = [...tails.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([, alt]) => alt)
    .join('|');
  const find = String.raw`(?<![\uAC00-\uD7A3])([\uAC00-\uD7A3]{2,}(?:${endingAlt}))(${tailAlt})(?!으로)${STEM_TAIL_BOUNDARY}`;

  return [
    {
      enabled: false,
      pattern: 'regex',
      patternKind: 'auxiliary-verb',
      auxSplitLongCompound: true,
      tailWord: '본용언이 3음절 이상 복합어/파생어(띄어쓰기 필수)',
      replace: '$1 $2',
      label: '본용언이 3음절 이상 복합어/파생어(띄어쓰기 필수)',
      tip: '본용언 활용형이 3음절 이상인 복합어·파생어는 보조용언을 띄어 씁니다.',
      find,
    },
  ];
}

/** @param {string} tailSyl */
function tailAlternative(tailSyl) {
  const forbid = AUX_TAIL_FORBIDDEN_AFTER[tailSyl];
  const core = escapeRegex(tailSyl);
  const neg = forbid ? `(?!${forbid})` : '';
  return `${core}${neg}${STEM_TAIL_END}`;
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

