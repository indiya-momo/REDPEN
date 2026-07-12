import {
  WORK_GUIDE_KEYS,
  getDevWorkGuideForceStep,
  isWorkGuidePinned,
} from './workGuideKeys.js';
import { isTooltipGuideDismissed } from './tooltipGuideStorage.js';
import { isWorkGuideOnboardingExposureAllowed } from './workGuideOnboardingExposure.js';
import { guestBrowseShowsWorkGuideChain } from './guestBrowsePolicy.js';

function emptyWorkGuideChainState(pinAll) {
  return {
    pinAll,
    showPreUploadGuide: false,
    showLoanwordIntroGuide: false,
    showPdfOpenedGuide: false,
    showLeftCriteriaGuide: false,
    showSpellingStartCheckGuide: false,
    showFirstResultGuide: false,
    showConsistencyGuide: false,
    showConsistencyUnifyPinGuide: false,
    showAuxiliaryVerbGuide: false,
    showRuleSetSaveGuide: false,
    showWorkExitGuide: false,
    workGuideOpen: false,
    requestConsistencyTab: false,
  };
}
/**
 * @param {ReturnType<typeof getWorkGuideChainState>} chain
 * @returns {string | null}
 */
export function activeWorkGuideKeyFromChain(chain) {
  if (chain.showLoanwordIntroGuide) return WORK_GUIDE_KEYS.LOANWORD_INTRO;
  if (chain.showLeftCriteriaGuide) return WORK_GUIDE_KEYS.LEFT_CRITERIA;
  if (chain.showSpellingStartCheckGuide) {
    return WORK_GUIDE_KEYS.SPELLING_START_CHECK;
  }
  if (chain.showPreUploadGuide) return WORK_GUIDE_KEYS.PRE_UPLOAD;
  if (chain.showFirstResultGuide) return WORK_GUIDE_KEYS.FIRST_RESULT;
  if (chain.showPdfOpenedGuide) return WORK_GUIDE_KEYS.PDF_OPENED;
  if (chain.showConsistencyGuide) return WORK_GUIDE_KEYS.CONSISTENCY_INTRO;
  if (chain.showConsistencyUnifyPinGuide) {
    return WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN;
  }
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
  if (chain.showLoanwordIntroGuide) return 0;
  if (chain.showLeftCriteriaGuide) return 1;
  if (chain.showSpellingStartCheckGuide) return 2;
  /** 회원 1b·둘러보기 업로드 — LOANWORD(0)과 겹치지 않게 10 */
  if (chain.showPreUploadGuide) return 10;
  if (chain.showFirstResultGuide) return 3;
  if (chain.showPdfOpenedGuide) return 4;
  if (chain.showConsistencyGuide) return 5;
  if (chain.showConsistencyUnifyPinGuide) return 6;
  if (chain.showAuxiliaryVerbGuide) return 7;
  if (chain.showRuleSetSaveGuide) return 8;
  if (chain.showWorkExitGuide) return 9;
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
 * @param {{ guestBrowseActive?: boolean }} [forceOptions]
 */
function getDevForcedWorkGuideChain(
  step,
  empty,
  ctx,
  pinAll,
  keyFor,
  dismissedMap,
  forceOptions = {},
) {
  const { hasPdf, pageTextsReady } = ctx;
  const d = (key) => dismissed(keyFor(key), dismissedMap);
  const base = { ...empty, pinAll, workGuideOpen: true };
  const guestBrowse = Boolean(forceOptions.guestBrowseActive);

  if (step === 0) {
    if (guestBrowse) {
      if (d(WORK_GUIDE_KEYS.PRE_UPLOAD)) return null;
      if (!hasPdf) return { ...base, showPreUploadGuide: true };
      return null;
    }
    if (d(WORK_GUIDE_KEYS.LOANWORD_INTRO)) return null;
    return { ...base, showLoanwordIntroGuide: true };
  }

  if (step === 10) {
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
      if (d(WORK_GUIDE_KEYS.SPELLING_START_CHECK)) return null;
      return { ...base, showSpellingStartCheckGuide: true };
    case 3:
      if (!d(WORK_GUIDE_KEYS.LEFT_CRITERIA)) return null;
      if (!guestBrowse && !d(WORK_GUIDE_KEYS.LOANWORD_INTRO)) return null;
      if (guestBrowse && !d(WORK_GUIDE_KEYS.SPELLING_START_CHECK)) return null;
      if (d(WORK_GUIDE_KEYS.FIRST_RESULT)) return null;
      return pageTextsReady ? { ...base, showFirstResultGuide: true } : null;
    case 4:
      if (d(WORK_GUIDE_KEYS.PDF_OPENED)) return null;
      return pageTextsReady ? { ...base, showPdfOpenedGuide: true } : null;
    case 5:
      if (d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)) return null;
      return { ...base, showConsistencyGuide: true };
    case 6:
      if (d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)) return null;
      return { ...base, showConsistencyUnifyPinGuide: true };
    case 7:
      if (d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)) return null;
      return { ...base, showAuxiliaryVerbGuide: true };
    case 8:
      if (d(WORK_GUIDE_KEYS.RULE_SET_SAVE)) return null;
      return { ...base, showRuleSetSaveGuide: true };
    case 9:
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
 *   consistencyCheckDone?: boolean,
 *   consistencyExportGuideReady?: boolean,
 * }} ctx
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} dismissedMap
 * @param {{ pinAll?: boolean }} options
 */
function computeGuestBrowseWorkGuideChain(ctx, keyFor, dismissedMap, options) {
  const {
    hasPdf,
    pageTextsReady,
    workTab,
    spellingCheckDone,
    consistencyCheckDone = false,
    consistencyExportGuideReady = true,
  } = ctx;
  const spellingActive = workTab === 'spelling';
  const consistencyActive = workTab === 'consistency';
  const pinAll = options.pinAll ?? isWorkGuidePinned();
  const d = (key) => dismissed(keyFor(key), dismissedMap);
  const empty = emptyWorkGuideChainState(pinAll);

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

  if (
    spellingActive &&
    hasPdf &&
    d(WORK_GUIDE_KEYS.LEFT_CRITERIA) &&
    !d(WORK_GUIDE_KEYS.SPELLING_START_CHECK) &&
    !spellingCheckDone
  ) {
    return {
      ...empty,
      showSpellingStartCheckGuide: true,
      workGuideOpen: true,
    };
  }

  if (spellingActive && pageTextsReady) {
    if (
      spellingCheckDone &&
      d(WORK_GUIDE_KEYS.LEFT_CRITERIA) &&
      d(WORK_GUIDE_KEYS.SPELLING_START_CHECK) &&
      !d(WORK_GUIDE_KEYS.FIRST_RESULT)
    ) {
      return {
        ...empty,
        showFirstResultGuide: true,
        workGuideOpen: true,
      };
    }
  }

  const spellingStepsDone =
    d(WORK_GUIDE_KEYS.LEFT_CRITERIA) &&
    d(WORK_GUIDE_KEYS.SPELLING_START_CHECK) &&
    d(WORK_GUIDE_KEYS.FIRST_RESULT);

  if (spellingCheckDone && spellingStepsDone && !d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)) {
    if (!consistencyActive) {
      return {
        ...empty,
        requestConsistencyTab: true,
      };
    }
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
    !d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)
  ) {
    return {
      ...empty,
      showConsistencyUnifyPinGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    consistencyActive &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN) &&
    !d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)
  ) {
    return {
      ...empty,
      showAuxiliaryVerbGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    consistencyActive &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN) &&
    d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO) &&
    !d(WORK_GUIDE_KEYS.RULE_SET_SAVE)
  ) {
    if (!consistencyCheckDone || !consistencyExportGuideReady) return empty;
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
    d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN) &&
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
 * 로그인 온보딩: 0 외래어 → 1 기준 → 1b 업로드(PRE_UPLOAD) → 2…
 * 둘러보기 체인과 분리.
 */
function computeMemberWorkGuideChain(ctx, keyFor, dismissedMap, options) {
  const {
    hasPdf,
    pageTextsReady,
    workTab,
    spellingCheckDone,
    consistencyCheckDone = false,
    consistencyExportGuideReady = true,
  } = ctx;
  const spellingActive = workTab === 'spelling';
  const consistencyActive = workTab === 'consistency';
  const pinAll = options.pinAll ?? isWorkGuidePinned();
  const d = (key) => {
    if (key === WORK_GUIDE_KEYS.SPELLING_START_CHECK) return true;
    if (key === WORK_GUIDE_KEYS.PRE_UPLOAD && hasPdf) return true;
    return dismissed(keyFor(key), dismissedMap);
  };
  const empty = emptyWorkGuideChainState(pinAll);

  if (spellingActive && !d(WORK_GUIDE_KEYS.LOANWORD_INTRO)) {
    return {
      ...empty,
      showLoanwordIntroGuide: true,
      workGuideOpen: true,
    };
  }

  if (spellingActive && !d(WORK_GUIDE_KEYS.LEFT_CRITERIA)) {
    return {
      ...empty,
      showLeftCriteriaGuide: true,
      workGuideOpen: true,
    };
  }

  if (!hasPdf && !d(WORK_GUIDE_KEYS.PRE_UPLOAD)) {
    return {
      ...empty,
      showPreUploadGuide: true,
      workGuideOpen: true,
    };
  }

  if (spellingActive && pageTextsReady) {
    if (
      spellingCheckDone &&
      d(WORK_GUIDE_KEYS.LOANWORD_INTRO) &&
      d(WORK_GUIDE_KEYS.LEFT_CRITERIA) &&
      !d(WORK_GUIDE_KEYS.FIRST_RESULT)
    ) {
      return {
        ...empty,
        showFirstResultGuide: true,
        workGuideOpen: true,
      };
    }
  }

  const spellingStepsDone =
    d(WORK_GUIDE_KEYS.LOANWORD_INTRO) &&
    d(WORK_GUIDE_KEYS.LEFT_CRITERIA) &&
    d(WORK_GUIDE_KEYS.FIRST_RESULT);

  if (spellingCheckDone && spellingStepsDone && !d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)) {
    if (!consistencyActive) {
      return {
        ...empty,
        requestConsistencyTab: true,
      };
    }
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
    !d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)
  ) {
    return {
      ...empty,
      showConsistencyUnifyPinGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    consistencyActive &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN) &&
    !d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)
  ) {
    return {
      ...empty,
      showAuxiliaryVerbGuide: true,
      workGuideOpen: true,
    };
  }

  if (
    consistencyActive &&
    spellingCheckDone &&
    spellingStepsDone &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_INTRO) &&
    d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN) &&
    d(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO) &&
    !d(WORK_GUIDE_KEYS.RULE_SET_SAVE)
  ) {
    if (!consistencyCheckDone || !consistencyExportGuideReady) return empty;
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
    d(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN) &&
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
 * @param {{
 *   hasPdf: boolean,
 *   pageTextsReady: boolean,
 *   workTab: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 *   consistencyCheckDone?: boolean,
 *   consistencyExportGuideReady?: boolean,
 * }} ctx
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} dismissedMap
 * @param {{ pinAll?: boolean, guestBrowseActive?: boolean }} options
 */
function computeWorkGuideChainState(ctx, keyFor, dismissedMap, options) {
  if (options.guestBrowseActive) {
    return computeGuestBrowseWorkGuideChain(ctx, keyFor, dismissedMap, options);
  }
  return computeMemberWorkGuideChain(ctx, keyFor, dismissedMap, options);
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
 *   consistencyCheckDone?: boolean,
 *   consistencyExportGuideReady?: boolean,
 * }} ctx
 * @param {(key: string) => string} keyFor
 * @param {Record<string, boolean> | null} [dismissedMap]
 * @param {{ pinAll?: boolean, guestBrowseActive?: boolean }} [options]
 */
export function getWorkGuideChainState(
  uid,
  ctx,
  keyFor,
  dismissedMap = null,
  options = {},
) {
  const pinAll = options.pinAll ?? isWorkGuidePinned();
  const empty = emptyWorkGuideChainState(pinAll);

  // 둘러보기(게스트) 또는 로그인 회원 온보딩. 비로그인·비둘러보기는 끔.
  const guestBrowse =
    options.guestBrowseActive ?? guestBrowseShowsWorkGuideChain();
  const memberUid = typeof uid === 'string' ? uid.trim() : '';
  if (!guestBrowse && !memberUid) {
    return empty;
  }

  const devForceStep = getDevWorkGuideForceStep();
  if (devForceStep != null) {
    const forced = getDevForcedWorkGuideChain(
      devForceStep,
      empty,
      ctx,
      pinAll,
      keyFor,
      dismissedMap,
      { guestBrowseActive: guestBrowse },
    );
    if (forced) return forced;
  }

  const chain = computeWorkGuideChainState(ctx, keyFor, dismissedMap, {
    ...options,
    pinAll,
    guestBrowseActive: guestBrowse,
  });
  // 회원만 노출 횟수 게이트 (게스트 uid '' 는 게이트 통과)
  return applyOnboardingExposureGate(empty, chain, uid, keyFor, dismissedMap);
}
