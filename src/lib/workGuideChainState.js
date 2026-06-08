import {
  WORK_GUIDE_KEYS,
  getDevWorkGuideForceStep,
  isWorkGuidePinned,
} from './workGuideKeys.js';
import { isTooltipGuideDismissed } from './tooltipGuideStorage.js';
import { isWorkGuideOnboardingExposureAllowed } from './workGuideOnboardingExposure.js';

/**
 * @param {ReturnType<typeof getWorkGuideChainState>} chain
 * @returns {string | null}
 */
export function activeWorkGuideKeyFromChain(chain) {
  if (chain.showPreUploadGuide) return WORK_GUIDE_KEYS.PRE_UPLOAD;
  if (chain.showLeftCriteriaGuide) return WORK_GUIDE_KEYS.LEFT_CRITERIA;
  if (chain.showFirstResultGuide) return WORK_GUIDE_KEYS.FIRST_RESULT;
  if (chain.showPdfOpenedGuide) return WORK_GUIDE_KEYS.PDF_OPENED;
  if (chain.showConsistencyGuide) return WORK_GUIDE_KEYS.CONSISTENCY_INTRO;
  if (chain.showAuxiliaryVerbGuide) return WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO;
  if (chain.showRuleSetSaveGuide) return WORK_GUIDE_KEYS.RULE_SET_SAVE;
  if (chain.showWorkExitGuide) return WORK_GUIDE_KEYS.WORK_EXIT;
  return null;
}

/**
 * @param {ReturnType<typeof getWorkGuideChainState>} chain
 * @returns {number | null}
 */
export function devWorkGuideStepFromChain(chain) {
  if (chain.showPreUploadGuide) return 0;
  if (chain.showLeftCriteriaGuide) return 1;
  if (chain.showFirstResultGuide) return 2;
  if (chain.showPdfOpenedGuide) return 3;
  if (chain.showConsistencyGuide) return 4;
  if (chain.showAuxiliaryVerbGuide) return 5;
  if (chain.showRuleSetSaveGuide) return 6;
  if (chain.showWorkExitGuide) return 7;
  return null;
}

/**
 * @param {number} step
 * @param {ReturnType<typeof getWorkGuideChainState>} empty
 * @param {{
 *   hasPdf: boolean,
 *   pageTextsReady: boolean,
 *   workTab: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 * }} ctx
 * @param {boolean} pinAll
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} dismissedMap
 */
function getDevForcedWorkGuideChain(step, empty, ctx, pinAll, keyFor, dismissedMap) {
  const { hasPdf, pageTextsReady } = ctx;
  const d = (key) => dismissed(keyFor(key), dismissedMap);
  const base = { ...empty, pinAll, workGuideOpen: true };
  if (step === 0) {
    if (d(WORK_GUIDE_KEYS.PRE_UPLOAD)) return null;
    if (!hasPdf) return { ...base, showPreUploadGuide: true };
    return null;
  }
  if (!hasPdf) return null;
  switch (step) {
    case 1:
      if (d(WORK_GUIDE_KEYS.LEFT_CRITERIA)) return null;
      return { ...base, showLeftCriteriaGuide: true };
    case 2:
      if (!d(WORK_GUIDE_KEYS.LEFT_CRITERIA)) return null;
      if (d(WORK_GUIDE_KEYS.FIRST_RESULT)) return null;
      return pageTextsReady ? { ...base, showFirstResultGuide: true } : null;
    case 3:
      if (d(WORK_GUIDE_KEYS.PDF_OPENED)) return null;
      return pageTextsReady ? { ...base, showPdfOpenedGuide: true } : null;
    case 4:
      if (d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)) return null;
      return { ...base, showConsistencyGuide: true };
    case 5:
      if (d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)) return null;
      return { ...base, showAuxiliaryVerbGuide: true };
    case 6:
      if (d(WORK_GUIDE_KEYS.RULE_SET_SAVE)) return null;
      return { ...base, showRuleSetSaveGuide: true };
    case 7:
      if (d(WORK_GUIDE_KEYS.WORK_EXIT)) return null;
      return { ...base, showWorkExitGuide: true };
    default:
      return null;
  }
}

/**
 * @param {string} storageKey
 * @param {Record<string, boolean> | null} dismissedMap
 */
function dismissed(storageKey, dismissedMap) {
  if (dismissedMap && storageKey in dismissedMap) {
    return Boolean(dismissedMap[storageKey]);
  }
  return isTooltipGuideDismissed(storageKey);
}

/**
 * @param {{
 *   hasPdf: boolean,
 *   pageTextsReady: boolean,
 *   workTab: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 * }} ctx
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} dismissedMap
 * @param {{ pinAll?: boolean }} options
 */
function computeWorkGuideChainState(ctx, keyFor, dismissedMap, options) {
  const {
    hasPdf,
    pageTextsReady,
    workTab,
    spellingCheckDone,
  } = ctx;
  const spellingActive = workTab === 'spelling';
  const consistencyActive = workTab === 'consistency';
  const pinAll = options.pinAll ?? isWorkGuidePinned();

  const d = (key) => dismissed(keyFor(key), dismissedMap);

  const empty = {
    pinAll,
    showPreUploadGuide: false,
    showPdfOpenedGuide: false,
    showLeftCriteriaGuide: false,
    showFirstResultGuide: false,
    showConsistencyGuide: false,
    showAuxiliaryVerbGuide: false,
    showRuleSetSaveGuide: false,
    showWorkExitGuide: false,
    workGuideOpen: false,
  };

  if (!hasPdf) {
    const showPreUploadGuide = !d(WORK_GUIDE_KEYS.PRE_UPLOAD);
    return {
      ...empty,
      showPreUploadGuide,
      workGuideOpen: showPreUploadGuide,
    };
  }

  if (spellingActive && hasPdf && !d(WORK_GUIDE_KEYS.LEFT_CRITERIA)) {
    return {
      ...empty,
      showLeftCriteriaGuide: true,
      workGuideOpen: true,
    };
  }

  if (spellingActive && pageTextsReady) {
    if (spellingCheckDone && !d(WORK_GUIDE_KEYS.FIRST_RESULT)) {
      return {
        ...empty,
        showFirstResultGuide: true,
        workGuideOpen: true,
      };
    }
    if (d(WORK_GUIDE_KEYS.FIRST_RESULT) && !d(WORK_GUIDE_KEYS.PDF_OPENED)) {
      return {
        ...empty,
        showPdfOpenedGuide: true,
        workGuideOpen: true,
      };
    }
  }

  const spellingStepsDone =
    d(WORK_GUIDE_KEYS.PDF_OPENED) &&
    d(WORK_GUIDE_KEYS.LEFT_CRITERIA) &&
    d(WORK_GUIDE_KEYS.FIRST_RESULT);

  if (spellingCheckDone && spellingStepsDone && !d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)) {
    return {
      ...empty,
      showConsistencyGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    consistencyActive &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    !d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)
  ) {
    return {
      ...empty,
      showAuxiliaryVerbGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    hasPdf &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO) &&
    !d(WORK_GUIDE_KEYS.RULE_SET_SAVE)
  ) {
    return {
      ...empty,
      showRuleSetSaveGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    hasPdf &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO) &&
    d(WORK_GUIDE_KEYS.RULE_SET_SAVE) &&
    !d(WORK_GUIDE_KEYS.WORK_EXIT)
  ) {
    return {
      ...empty,
      showWorkExitGuide: true,
      workGuideOpen: true,
    };
  }

  return empty;
}

/**
 * @param {ReturnType<typeof getWorkGuideChainState>} empty
 * @param {ReturnType<typeof getWorkGuideChainState>} chain
 * @param {string} uid
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} dismissedMap
 */
function applyOnboardingExposureGate(empty, chain, uid, keyFor, dismissedMap) {
  if (!chain.workGuideOpen) return chain;
  const guideKey = activeWorkGuideKeyFromChain(chain);
  const guideDismissed = guideKey
    ? dismissed(keyFor(guideKey), dismissedMap)
    : true;
  if (
    !isWorkGuideOnboardingExposureAllowed(
      uid,
      chain,
      guideKey,
      guideDismissed,
    )
  ) {
    return { ...empty, pinAll: chain.pinAll };
  }
  return chain;
}

/** 1~7번 말풍선 — 한 번에 하나만, 확인 후 다음 단계 */

/**
 * @param {string} uid
 * @param {{
 *   hasPdf: boolean,
 *   pageTextsReady: boolean,
 *   workTab: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 * }} ctx
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} [dismissedMap]
 * @param {{ pinAll?: boolean }} [options]
 */
export function getWorkGuideChainState(
  uid,
  ctx,
  keyFor,
  dismissedMap = null,
  options = {},
) {
  const pinAll = options.pinAll ?? isWorkGuidePinned();
  const empty = {
    pinAll,
    showPreUploadGuide: false,
    showPdfOpenedGuide: false,
    showLeftCriteriaGuide: false,
    showFirstResultGuide: false,
    showConsistencyGuide: false,
    showAuxiliaryVerbGuide: false,
    showRuleSetSaveGuide: false,
    showWorkExitGuide: false,
    workGuideOpen: false,
  };

  const devForceStep = getDevWorkGuideForceStep();
  if (devForceStep != null) {
    const forced = getDevForcedWorkGuideChain(
      devForceStep,
      empty,
      ctx,
      pinAll,
      keyFor,
      dismissedMap,
    );
    if (forced) return forced;
  }

  const chain = computeWorkGuideChainState(ctx, keyFor, dismissedMap, options);
  return applyOnboardingExposureGate(empty, chain, uid, keyFor, dismissedMap);
}
