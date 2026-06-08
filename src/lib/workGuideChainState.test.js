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
  it('PDF 열림 후 1단(기준 선택)만 보인다', () => {
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: false,
    });
    expect(chain.showLeftCriteriaGuide).toBe(true);
    expect(chain.showPdfOpenedGuide).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
  });

  it('텍스트 추출 전에도 PDF만 있으면 1단이 보인다', () => {
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, pageTextsReady: false },
      keyFor,
      null,
      { pinAll: false },
    );
    expect(chain.showLeftCriteriaGuide).toBe(true);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
  });

  it('1단 확인 후 검수 전에는 2·3단이 없다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
    };
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, dismissedMap, {
      pinAll: false,
    });
    expect(chain.showLeftCriteriaGuide).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
    expect(chain.workGuideOpen).toBe(false);
  });

  it('1단 확인·검수 완료 후 2단(결과)이 보인다', () => {
    const dismissedMap = {
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
    expect(chain.showPdfOpenedGuide).toBe(false);
  });

  it('dev force 1이어도 1단 dismiss면 2·3단이 안 보인다', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => '1',
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', search: '' },
    });
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
    };
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, dismissedMap, {
      pinAll: false,
    });
    expect(chain.showLeftCriteriaGuide).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
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

  it('2단 확인 후 3단(보정)이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showPdfOpenedGuide).toBe(true);
    expect(chain.showFirstResultGuide).toBe(false);
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

  it('pin 모드여도 1단(기준)만 보인다', () => {
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: true,
    });
    expect(chain.showLeftCriteriaGuide).toBe(true);
    expect(chain.showPdfOpenedGuide).toBe(false);
    expect(chain.pinAll).toBe(true);
  });

  it('검수 완료여도 2단(결과) 미확인이면 3단 대신 2단', () => {
    const dismissedMap = {
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
    expect(chain.showPdfOpenedGuide).toBe(false);
  });

  it('온보딩 5회 소진 후 말풍선이 뜨지 않는다', () => {
    localStorage.setItem(
      'indiya-work-guide-onboarding-exposure--u1',
      JSON.stringify({ count: 5, lastDayId: '2026-06-01' }),
    );
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: false,
    });
    expect(chain.workGuideOpen).toBe(false);
    expect(chain.showLeftCriteriaGuide).toBe(false);
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
