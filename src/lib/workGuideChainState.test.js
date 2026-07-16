import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginGuestBrowse, endGuestBrowse } from './guestBrowsePolicy.js';
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
  vi.stubGlobal('sessionStorage', {
    getItem: (key) => store[`session:${key}`] ?? null,
    setItem: (key, value) => {
      store[`session:${key}`] = String(value);
    },
    removeItem: (key) => {
      delete store[`session:${key}`];
    },
  });
  beginGuestBrowse();
});

afterEach(() => {
  endGuestBrowse();
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
    expect(chain.showSpellingStartCheckGuide).toBe(false);
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
    expect(chain.showSpellingStartCheckGuide).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
  });

  it('1단 확인 후 검수 전에는 1b(검수 시작)만 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
    };
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, dismissedMap, {
      pinAll: false,
    });
    expect(chain.showLeftCriteriaGuide).toBe(false);
    expect(chain.showSpellingStartCheckGuide).toBe(true);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
    expect(chain.workGuideOpen).toBe(true);
  });

  it('1단·1b 확인·검수 완료 후 2단(결과)이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showFirstResultGuide).toBe(true);
    expect(chain.showSpellingStartCheckGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
  });

  it('dev force 1이어도 1단 dismiss면 1단은 안 보이고 1b로 넘어간다', () => {
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
    expect(chain.showSpellingStartCheckGuide).toBe(true);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showPdfOpenedGuide).toBe(false);
  });

  it('4단 확인·일관성 탭에서 핀 가이드가 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
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
    expect(chain.showConsistencyUnifyPinGuide).toBe(true);
    expect(chain.showAuxiliaryVerbGuide).toBe(false);
    expect(chain.showConsistencyGuide).toBe(false);
  });

  it('핀 가이드 확인 후 본·보 가이드가 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true, workTab: 'consistency' },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showAuxiliaryVerbGuide).toBe(true);
    expect(chain.showConsistencyUnifyPinGuide).toBe(false);
  });

  it('3단 확인·검수 완료 후 맞춤법 탭이면 표기 통일 탭 전환을 요청한다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.requestConsistencyTab).toBe(true);
    expect(chain.showConsistencyGuide).toBe(false);
  });

  it('3단 확인·검수 완료 후 표기 통일 탭에서 4단이 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true, workTab: 'consistency' },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showConsistencyGuide).toBe(true);
    expect(chain.requestConsistencyTab).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
  });

  it('2단 확인 후 보정 가이드 없이 표기 통일 탭 전환을 요청한다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showPdfOpenedGuide).toBe(false);
    expect(chain.requestConsistencyTab).toBe(true);
    expect(chain.showConsistencyGuide).toBe(false);
    expect(chain.showFirstResultGuide).toBe(false);
    expect(chain.showLeftCriteriaGuide).toBe(false);
  });

  it('모든 단계 확인 후 체인이 끝난다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PRE_UPLOAD)]: true,
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
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

  it('본·보 안내 후 표기 통일 기준 검수 말풍선은 없다', () => {
    endGuestBrowse();
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.LOANWORD_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      {
        ...baseCtx,
        spellingCheckDone: true,
        consistencyCheckDone: false,
        workTab: 'consistency',
      },
      keyFor,
      dismissedMap,
      { pinAll: false, guestBrowseActive: false },
    );
    expect(chain.showConsistencyStartCheckGuide).toBe(false);
    expect(chain.showRuleSetSaveGuide).toBe(false);
    expect(chain.workGuideOpen).toBe(false);
  });

  it('본·보·표기 통일 검수 완료 후 다운로드 가이드가 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      {
        ...baseCtx,
        spellingCheckDone: true,
        consistencyCheckDone: true,
        consistencyExportGuideReady: true,
        workTab: 'consistency',
      },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showRuleSetSaveGuide).toBe(true);
    expect(chain.showWorkExitGuide).toBe(false);
    expect(chain.showAuxiliaryVerbGuide).toBe(false);
  });

  it('검수 완료여도 다운로드 가이드 준비가 안 되면 숨긴다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      {
        ...baseCtx,
        spellingCheckDone: true,
        consistencyCheckDone: true,
        consistencyExportGuideReady: false,
        workTab: 'consistency',
      },
      keyFor,
      dismissedMap,
      { pinAll: false },
    );
    expect(chain.showRuleSetSaveGuide).toBe(false);
    expect(chain.workGuideOpen).toBe(false);
  });

  it('다운로드 가이드 확인 후 종료 가이드가 보인다', () => {
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.PDF_OPENED)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.RULE_SET_SAVE)]: true,
    };
    const chain = getWorkGuideChainState(
      'u1',
      { ...baseCtx, spellingCheckDone: true, consistencyCheckDone: true },
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
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
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

  it('비로그인·비둘러보기에서는 체인이 꺼진다', () => {
    endGuestBrowse();
    const chain = getWorkGuideChainState('', baseCtx, (k) => k, null, {
      pinAll: true,
      guestBrowseActive: false,
    });
    expect(chain.workGuideOpen).toBe(false);
    expect(chain.showLeftCriteriaGuide).toBe(false);
  });

  it('로그인 회원은 둘러보기 없이도 온보딩 말풍선이 켜진다', () => {
    endGuestBrowse();
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: false,
      guestBrowseActive: false,
    });
    expect(chain.workGuideOpen).toBe(true);
    expect(chain.showLoanwordIntroGuide).toBe(true);
  });

  it('온보딩 5회 소진 후 말풍선이 뜨지 않는다', () => {
    endGuestBrowse();
    localStorage.setItem(
      'indiya-work-guide-onboarding-exposure--u1',
      JSON.stringify({ count: 5, lastDayId: '2026-06-01' }),
    );
    const chain = getWorkGuideChainState('u1', baseCtx, keyFor, null, {
      pinAll: false,
      guestBrowseActive: false,
    });
    expect(chain.workGuideOpen).toBe(false);
    expect(chain.showLeftCriteriaGuide).toBe(false);
  });

  it('회원 온보딩은 0 외래어 → 1 기준 → 1b 업로드 → 업로드 후 기준 검수 순이다', () => {
    endGuestBrowse();
    const chain0 = getWorkGuideChainState(
      'u1',
      { ...baseCtx, hasPdf: false },
      keyFor,
      null,
      { pinAll: false, guestBrowseActive: false },
    );
    expect(chain0.showLoanwordIntroGuide).toBe(true);
    expect(chain0.showLeftCriteriaGuide).toBe(false);
    expect(chain0.showPreUploadGuide).toBe(false);

    const chain1 = getWorkGuideChainState(
      'u1',
      { ...baseCtx, hasPdf: false },
      keyFor,
      { [keyFor(WORK_GUIDE_KEYS.LOANWORD_INTRO)]: true },
      { pinAll: false, guestBrowseActive: false },
    );
    expect(chain1.showLeftCriteriaGuide).toBe(true);
    expect(chain1.showPreUploadGuide).toBe(false);

    const chain1b = getWorkGuideChainState(
      'u1',
      { ...baseCtx, hasPdf: false },
      keyFor,
      {
        [keyFor(WORK_GUIDE_KEYS.LOANWORD_INTRO)]: true,
        [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      },
      { pinAll: false, guestBrowseActive: false },
    );
    expect(chain1b.showPreUploadGuide).toBe(true);
    expect(chain1b.showSpellingStartCheckGuide).toBe(false);

    const chainAfterUpload = getWorkGuideChainState(
      'u1',
      { ...baseCtx, hasPdf: true, pageTextsReady: true, spellingCheckDone: false },
      keyFor,
      {
        [keyFor(WORK_GUIDE_KEYS.LOANWORD_INTRO)]: true,
        [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      },
      { pinAll: false, guestBrowseActive: false },
    );
    expect(chainAfterUpload.showPreUploadGuide).toBe(false);
    expect(chainAfterUpload.showSpellingStartCheckGuide).toBe(true);
    expect(chainAfterUpload.showFirstResultGuide).toBe(false);
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

  it('회원은 결과 팝업 확인 전에 저장 안내를 숨긴다', () => {
    endGuestBrowse();
    const dismissedMap = {
      [keyFor(WORK_GUIDE_KEYS.LOANWORD_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.LEFT_CRITERIA)]: true,
      [keyFor(WORK_GUIDE_KEYS.SPELLING_START_CHECK)]: true,
      [keyFor(WORK_GUIDE_KEYS.FIRST_RESULT)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)]: true,
      [keyFor(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN)]: true,
      [keyFor(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO)]: true,
    };
    const locked = getWorkGuideChainState(
      'u1',
      {
        ...baseCtx,
        spellingCheckDone: true,
        consistencyCheckDone: true,
        consistencyExportGuideReady: false,
        workTab: 'consistency',
      },
      keyFor,
      dismissedMap,
      { pinAll: false, guestBrowseActive: false },
    );
    expect(locked.showRuleSetSaveGuide).toBe(false);
    expect(locked.workGuideOpen).toBe(false);

    const unlocked = getWorkGuideChainState(
      'u1',
      {
        ...baseCtx,
        spellingCheckDone: true,
        consistencyCheckDone: true,
        consistencyExportGuideReady: true,
        workTab: 'consistency',
      },
      keyFor,
      dismissedMap,
      { pinAll: false, guestBrowseActive: false },
    );
    expect(unlocked.showRuleSetSaveGuide).toBe(true);
    expect(unlocked.workGuideOpen).toBe(true);
  });
});
