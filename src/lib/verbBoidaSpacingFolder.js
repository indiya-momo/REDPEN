/**
 * 맞춤법 탭 띄어쓰기 「제47항」 묶음에 속한 (아/어)+보이다.
 * 1차 찾기는 본조 verb-boida 규칙 그대로, 결과는 띄어쓰기 폴더 범주로 붙인다.
 */
import { enrichAuxiliaryDictSolid } from './auxiliaryDictSolid.js';
import { enrichAuxiliaryGluedFromSpaced } from './auxiliaryGluedFromSpaced.js';
import { enrichAuxiliaryNonAeoSpace } from './auxiliaryNonAeoSpace.js';
import {
  finalizeConsistencyCheckResults,
} from './checkResultUtils.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { normalizeSpacingFolderEnabled } from './spacingFolderBundles.js';

export const VERB_BOIDA_ITEM_ID = 'verb-boida';

export const VERB_BOIDA_SPACING_CATEGORY = 'spacing:nonAeoAux';

/** @param {{ bonBojoItemId?: string } | null | undefined} ruleOrGroup */
export function isVerbBoidaItem(ruleOrGroup) {
  return String(ruleOrGroup?.bonBojoItemId ?? '').trim() === VERB_BOIDA_ITEM_ID;
}

/**
 * 제47항 묶음이 켜져 있으면 보이다 규칙을 켠다.
 * @param {import('./ruleTypes.js').Rule[] | null | undefined} customRules
 * @param {Record<string, boolean> | null | undefined} spacingFolderEnabled
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function verbBoidaRulesForSpacingCheck(
  customRules,
  spacingFolderEnabled,
) {
  const folder = normalizeSpacingFolderEnabled(spacingFolderEnabled);
  if (folder.nonAeoAux !== true) return [];
  return ensureDefaultAuxiliaryVerbs(customRules)
    .filter((r) => isVerbBoidaItem(r) && !r.auxNonAeoGate)
    .map((r) => ({
      ...r,
      enabled: true,
      category: VERB_BOIDA_SPACING_CATEGORY,
    }));
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function markVerbBoidaGroupsAsSpacing(groups) {
  return (groups ?? []).map((g) =>
    isVerbBoidaItem(g)
      ? { ...g, category: VERB_BOIDA_SPACING_CATEGORY }
      : g,
  );
}

/**
 * 본조 검수와 같은 보이다 후처리(이미 띈 올바른 표면 제거 등) 후 띄어쓰기 범주 표시.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {import('./ruleTypes.js').Rule[]} boidaRules
 * @param {readonly { pageNum?: number, text?: string }[]} pageTexts
 * @param {{ globalExcludePhrases?: string[] }} [opts]
 */
export async function finalizeVerbBoidaSpacingGroups(
  groups,
  boidaRules,
  pageTexts,
  opts = {},
) {
  const shared = {
    rules: boidaRules,
    globalExcludePhrases: opts.globalExcludePhrases,
    ...(opts.analyze ? { analyze: opts.analyze } : {}),
  };
  const enriched = await enrichAuxiliaryDictSolid(
    await enrichAuxiliaryNonAeoSpace(
      await enrichAuxiliaryGluedFromSpaced(
        finalizeConsistencyCheckResults(groups, boidaRules),
        pageTexts,
        shared,
      ),
      pageTexts,
      shared,
    ),
    pageTexts,
    shared,
  );
  return markVerbBoidaGroupsAsSpacing(
    finalizeConsistencyCheckResults(enriched, boidaRules),
  );
}
