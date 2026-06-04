import { WORK_GUIDE_KEYS, isWorkGuidePinned } from './workGuideKeys.js';
import { isTooltipGuideDismissed } from './tooltipGuideStorage.js';

/**
 * @param {string} storageKey
 * @param {boolean} dismissed
 */
function dismissed(storageKey, dismissedMap) {
  if (dismissedMap && storageKey in dismissedMap) {
    return Boolean(dismissedMap[storageKey]);
  }
  return isTooltipGuideDismissed(storageKey);
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
  void uid;
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

  if (spellingActive && pageTextsReady) {
    if (!d(WORK_GUIDE_KEYS.PDF_OPENED)) {
      return {
        ...empty,
        showPdfOpenedGuide: true,
        workGuideOpen: true,
      };
    }
    if (!d(WORK_GUIDE_KEYS.LEFT_CRITERIA)) {
      return {
        ...empty,
        showLeftCriteriaGuide: true,
        workGuideOpen: true,
      };
    }
    if (spellingCheckDone && !d(WORK_GUIDE_KEYS.FIRST_RESULT)) {
      return {
        ...empty,
        showFirstResultGuide: true,
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
