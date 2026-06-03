import {
  STEM_TAIL_BOUNDARY,
  STEM_TAIL_END,
  escapeRegex,
} from './compoundPatternCommon.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

/** 관형어(은·는·ㄴ)+체하다 붙임 — 아는체하다·읽은체했다 등 */
const GYEONGHYEONG_BEFORE_CHE = String.raw`(\S*(?:은|는|ㄴ))`;

/** @param {string} tailWord */
function normalizeCheHadaTail(tailWord) {
  return tailWord.trim().replace(/\s+/g, '');
}

/**
 * @param {string} tailWord
 */
export function isAdjectiveCheHadaTail(tailWord) {
  return normalizeCheHadaTail(tailWord) === '체하';
}

/**
 * @param {string} tailWord
 */
export function buildAdjectiveCheHadaRules(tailWord) {
  const tail = tailWord.trim();
  if (!isAdjectiveCheHadaTail(tail)) return [];

  const base = {
    enabled: true,
    pattern: 'regex',
    patternKind: 'auxiliary-verb',
    tailWord: '체하',
    replace: '$0',
    label: encodeSpacesVisible('체하'),
  };

  const che = escapeRegex('체');
  const ha = escapeRegex('하');
  const cheHadaTail = String.raw`(?:${ha}(?!루)${STEM_TAIL_END}|한다|했다)`;

  return [
    {
      ...base,
      find: String.raw`${GYEONGHYEONG_BEFORE_CHE}${che}${cheHadaTail}(?!으로)${STEM_TAIL_BOUNDARY}`,
    },
  ];
}
