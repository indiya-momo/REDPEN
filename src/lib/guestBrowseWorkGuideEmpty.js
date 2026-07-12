/**
 * 둘러보기(게스트) 작업 말풍선 — 꺼진 상태.
 * 일반 로그인 작업은 이 객체만 쓰고, 체인/노출/강제 단계를 계산하지 않는다.
 */
export const EMPTY_GUEST_BROWSE_WORK_GUIDE = Object.freeze({
  storageKey: (key) => String(key ?? ''),
  dismiss: () => {},
  pinAll: false,
  showPreUploadGuide: false,
  showPdfOpenedGuide: false,
  showLeftCriteriaGuide: false,
  showFirstResultGuide: false,
  showConsistencyGuide: false,
  showConsistencyUnifyPinGuide: false,
  showAuxiliaryVerbGuide: false,
  showRuleSetSaveGuide: false,
  showWorkExitGuide: false,
  workGuideOpen: false,
  requestConsistencyTab: false,
});
