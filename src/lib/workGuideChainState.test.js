import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkGuideChainState } from './workGuideChainState.js';
import { WORK_GUIDE_KEYS, workGuideStorageKey } from './workGuideKeys.js';

/** @type {Record<string, string>} */
const store = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseCtx = {
  hasPdf: true,
  pageTextsReady: true,
  workTab: 'spelling',
  spellingCheckDone: false,
};

const keyFor = (key) => workGuideStorageKey('u1', key);

describe('getWorkGuideChainState', () => {
  it('PDF 열림 후 1단만 보인다', () => {
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: false,
    });
    expect(chain.showPdfOpenedGuide).toBe(true);
    expect(chain.showLeftCriteriaGuide).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
  });

  it('1단 확인 후 2단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
    };
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, dismissedMap, {
      pinAll: false,
    });
    expect(chain.showPdfOpenedGuide).toBe(false);
    expect(chain.showLeftCriteriaGuide).toBe(true);
  });

  it('4단 확인·일관성 탭에서 5단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true, workTab: 'consistency' },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showAuxiliaryVerbGuide).toBe(true);
    expect(chain.showConsistencyGuide).toBe(false);
  });

  it('3단 확인·검수 완료 후 4단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showConsistencyGuide).toBe(true);
    expect(chain.showFirstResultGuide).toBe(false);
  });

  it('검수 완료 후 3단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showFirstResultGuide).toBe(true);
    expect(chain.showLeftCriteriaGuide).toBe(false);
  });

  it('모든 단계 확인 후 체인이 끝난다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PRE_UPLOAD)]: true,
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.RULE_SET_SAVE)]: true,
      [keyFor(WORK_GUIDE_KEYS.WORK_EXIT)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.workGuideOpen).toBe(false);
  });

  it('5단 확인 후 6단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true, workTab: 'consistency' },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showRuleSetSaveGuide).toBe(true);
    expect(chain.showAuxiliaryVerbGuide).toBe(false);
  });

  it('6단 확인 후 7단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.RULE_SET_SAVE)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showWorkExitGuide).toBe(true);
    expect(chain.showRuleSetSaveGuide).toBe(false);
  });

  it('pin 모드여도 1단만 보인다', () => {
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: true,
    });
    expect(chain.showPdfOpenedGuide).toBe(true);
    expect(chain.showLeftCriteriaGuide).toBe(false);
    expect(chain.pinAll).toBe(true);
  });

  it('검수 완료여도 2단 미확인이면 3단 대신 2단', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showLeftCriteriaGuide).toBe(true);
    expect(chain.showFirstResultGuide).toBe(false);
  });

  it('업로드 전에는 pre-upload만 대상이다', () => {
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, hasPdf: false, pageTextsReady: false },
      keyFor,
      null,
      { pinAll: false },
    );
    expect(chain.showPreUploadGuide).toBe(true);
    expect(chain.showPdfOpenedGuide).toBe(false);
  });
});
