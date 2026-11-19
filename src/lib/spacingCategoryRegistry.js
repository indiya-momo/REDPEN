/**
 * 띄어쓰기 탭에 묶는 검출기 목록.
 * 각 findHits는 페이지 텍스트 → { index, matchedText, suggestedText }[]
 * ruleEngine·useRuleCheck에 넣지 않는다.
 */

import {
  NUMERAL_SPACING_LABEL,
  NUMERAL_SPACING_TIP,
  findNumeralSpacingHits,
} from './numeralSpacing.js';
import {
  MAN_EOK_JO_LABEL,
  MAN_EOK_JO_TIP,
  findManEokJoSpacingHits,
} from './manEokJoSpacing.js';
import {
  DIGIT_UNIT_LABEL,
  DIGIT_UNIT_TIP,
  findDigitUnitSpacingHits,
} from './digitUnitSpacing.js';
import {
  ADNOMINAL_DEP_LABEL,
  ADNOMINAL_DEP_TIP,
  findAdnominalDependentNounHits,
} from './adnominalDependentNoun.js';
import {
  NOUN_PRED_LABEL,
  NOUN_PRED_TIP,
  findNounPredicateSpacingHits,
} from './nounPredicateSpacing.js';
import {
  RIEUL_KKA_BODA_LABEL,
  RIEUL_KKA_BODA_TIP,
  findRieulKkaBodaSpacingHits,
} from './rieulKkaBodaSpacing.js';
import {
  N_JI_DURATION_LABEL,
  N_JI_DURATION_TIP,
  findNJiDurationSpacingHits,
} from './nJiDurationSpacing.js';
import {
  N_BA_LABEL,
  N_BA_TIP,
  findNBaDependentNounHits,
} from './nBaDependentNoun.js';
import {
  HAN_BEON_LABEL,
  HAN_BEON_TIP,
  findHanBeonSpacingHits,
} from './hanBeonSpacing.js';
import {
  DAEUM_NAL_LABEL,
  DAEUM_NAL_TIP,
  findDaeumNalSpacingHits,
} from './daeumNalSpacing.js';
import {
  OFFICIAL_AUX_LABEL,
  OFFICIAL_AUX_TIP,
  findOfficialAuxSpacingHits,
} from './officialAuxSpacing.js';
import {
  PUNCT_SPACING_LABEL,
  PUNCT_SPACING_TIP,
  findPunctSpacingHits,
} from './punctSpacing.js';
import {
  NON_AEO_AUX_SPACING_LABEL,
  NON_AEO_AUX_SPACING_TIP,
  findNonAeoAuxSpacingHits,
} from './nonAeoAuxSpacing.js';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   tip: string,
 *   findHits: (text: string) => { index: number, matchedText: string, suggestedText: string }[],
 * }} SpacingCategoryDef
 */

/** @type {SpacingCategoryDef[]} */
export const SPACING_CATEGORY_DEFS = [
  {
    id: 'numeral',
    label: NUMERAL_SPACING_LABEL,
    tip: NUMERAL_SPACING_TIP,
    findHits: findNumeralSpacingHits,
  },
  {
    id: 'man-eok-jo',
    label: MAN_EOK_JO_LABEL,
    tip: MAN_EOK_JO_TIP,
    findHits: findManEokJoSpacingHits,
  },
  {
    id: 'digit-unit',
    label: DIGIT_UNIT_LABEL,
    tip: DIGIT_UNIT_TIP,
    findHits: findDigitUnitSpacingHits,
  },
  {
    id: 'adnominal-dep',
    label: ADNOMINAL_DEP_LABEL,
    tip: ADNOMINAL_DEP_TIP,
    findHits: findAdnominalDependentNounHits,
  },
  {
    id: 'noun-pred',
    label: NOUN_PRED_LABEL,
    tip: NOUN_PRED_TIP,
    findHits: findNounPredicateSpacingHits,
  },
  {
    id: 'rieul-kka',
    label: RIEUL_KKA_BODA_LABEL,
    tip: RIEUL_KKA_BODA_TIP,
    findHits: findRieulKkaBodaSpacingHits,
  },
  {
    id: 'n-ji',
    label: N_JI_DURATION_LABEL,
    tip: N_JI_DURATION_TIP,
    findHits: findNJiDurationSpacingHits,
  },
  {
    id: 'n-ba',
    label: N_BA_LABEL,
    tip: N_BA_TIP,
    findHits: findNBaDependentNounHits,
  },
  {
    id: 'han-beon',
    label: HAN_BEON_LABEL,
    tip: HAN_BEON_TIP,
    findHits: findHanBeonSpacingHits,
  },
  {
    id: 'daeum-nal',
    label: DAEUM_NAL_LABEL,
    tip: DAEUM_NAL_TIP,
    findHits: findDaeumNalSpacingHits,
  },
  {
    id: 'official-aux',
    label: OFFICIAL_AUX_LABEL,
    tip: OFFICIAL_AUX_TIP,
    findHits: findOfficialAuxSpacingHits,
  },
  {
    id: 'punct',
    label: PUNCT_SPACING_LABEL,
    tip: PUNCT_SPACING_TIP,
    findHits: findPunctSpacingHits,
  },
  {
    id: 'non-aeo-aux',
    label: NON_AEO_AUX_SPACING_LABEL,
    tip: NON_AEO_AUX_SPACING_TIP,
    findHits: (text) => findNonAeoAuxSpacingHits(text),
  },
];

/**
 * @param {{ pageNum: number, index: number, matchedText: string, suggestedText: string, categoryId: string, label: string }[]} hits
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function spacingHitsToGroups(hits) {
  return (hits ?? []).map((hit) => {
    const instance = {
      find: hit.matchedText,
      replace: hit.suggestedText,
      matchedText: hit.matchedText,
      suggestedText: hit.suggestedText,
      pageNum: hit.pageNum,
      index: hit.index,
    };
    return {
      find: hit.matchedText,
      replace: hit.suggestedText,
      label: hit.label,
      category: hit.categoryId,
      tip: '',
      instances: [instance],
    };
  });
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {number} pageNum
 */
export function countSpacingHitsOnPage(groups, pageNum) {
  let count = 0;
  for (const group of groups ?? []) {
    for (const inst of group.instances ?? []) {
      if (inst.pageNum === pageNum) count += 1;
    }
  }
  return count;
}
