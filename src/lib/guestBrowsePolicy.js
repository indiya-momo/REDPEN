/**
 * 둘러보기(게스트) 기능 경계 — session 플래그는 guestBrowseSession,
 * “무엇을 허용할지”는 여기만 본다.
 */
import {
  beginGuestBrowse as beginGuestBrowseSession,
  endGuestBrowse as endGuestBrowseSession,
  isGuestBrowseActive,
} from './guestBrowseSession.js';
import {
  clearAllWorkGuideDismissals,
  setDevWorkGuideForceStep,
} from './workGuideKeys.js';
import {
  listAuxiliaryVerbEntries,
  setAllAuxiliaryVerbEntries,
} from './auxiliaryVerbRegister.js';

/** 표기 통일 등록 칩(여러 개 찾기·통일형·공통 항목) patternKind */
const GUEST_BROWSE_CONSISTENCY_CHIP_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
  'phrase-slot-find',
]);

/** @typedef {{
 *   stayOnMainWithoutLogin: boolean,
 *   demoPdfAutoLoad: boolean,
 *   runCheckAndResultPopup: boolean,
 *   hideProjectSaveUi: boolean,
 *   hideGreetingText: boolean,
 *   hideThumbStrip: boolean,
 *   autoRunCriteriaCheck: boolean,
 * }} GuestBrowseCapabilities */

/** @type {GuestBrowseCapabilities} */
export const GUEST_BROWSE_CAPABILITIES = {
  stayOnMainWithoutLogin: true,
  demoPdfAutoLoad: true,
  runCheckAndResultPopup: true,
  hideProjectSaveUi: false,
  hideGreetingText: true,
  hideThumbStrip: true,
  /** 1번 가이드 후 손을 보여 기준 검수 클릭을 안내 (자동 실행 없음) */
  autoRunCriteriaCheck: true,
};

/** 둘러보기 2번 — 데모 결과(빼곡이→빼곡히) 라벨 매칭 */
export const GUEST_BROWSE_DEMO_RESULT_NEEDLE = '빼곡이';

/**
 * 데모 원고의 「빼곡이」 맞춤법 그룹
 * @param {import('./ruleEngine.js').RuleResultGroup[] | null | undefined} spellingResults
 */
export function findGuestBrowseDemoSpellingGroup(spellingResults) {
  if (!Array.isArray(spellingResults)) return null;
  return (
    spellingResults.find(
      (group) =>
        group?.category !== 'caution' &&
        typeof group.label === 'string' &&
        group.label.includes(GUEST_BROWSE_DEMO_RESULT_NEEDLE),
    ) ?? null
  );
}

/** 둘러보기 반자동 타이밍 (손 클릭 기준) */
export const GUEST_BROWSE_TIMING = {
  /** 손/기준 검수 클릭 → 결과 팝업 */
  resultAfterClickMs: 1000,
};

/** @type {number} */
let criteriaClickAtMs = 0;
/** @type {boolean} */
let nextGuideReady = true;
/** @type {boolean} */
let exportGuideReady = true;
/** @type {Set<() => void>} */
const nextGuideListeners = new Set();
/** @type {Set<() => void>} */
const exportGuideListeners = new Set();

function notifyNextGuideListeners() {
  for (const listener of nextGuideListeners) {
    listener();
  }
}

function notifyExportGuideListeners() {
  for (const listener of exportGuideListeners) {
    listener();
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function endGuestBrowse() {
  endGuestBrowseSession();
  criteriaClickAtMs = 0;
  nextGuideReady = true;
  exportGuideReady = true;
  notifyNextGuideListeners();
  notifyExportGuideListeners();
}

export { isGuestBrowseActive };

/**
 * 작업 화면 말풍선 체인(1~7·📌) — **둘러보기 세션**에서만 true.
 * 로그인 회원 온보딩 말풍선은 uid + 노출 게이트로 따로 켠다.
 */
export function guestBrowseShowsWorkGuideChain() {
  return isGuestBrowseActive();
}

/** 둘러보기 시작 — 가이드 dismiss·세션 강제 단계 초기화 */
export function beginGuestBrowse() {
  beginGuestBrowseSession();
  // 게스트('') + 로그인 uid별 dismiss가 섞여 있을 수 있어 함께 비움
  clearAllWorkGuideDismissals('');
  setDevWorkGuideForceStep(null);
  criteriaClickAtMs = 0;
  nextGuideReady = false;
  exportGuideReady = false;
  notifyNextGuideListeners();
  notifyExportGuideListeners();
}

/** 로그인 없이 main에 머무를 수 있는지 */
export function guestBrowseAllowsWorkspaceStay() {
  return (
    isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.stayOnMainWithoutLogin
  );
}

/** 데모 원고 자동 로드 */
export function guestBrowseAllowsDemoPdfAutoLoad() {
  return isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.demoPdfAutoLoad;
}

/** 검수 실행·결과 패널·안내 팝업 */
export function guestBrowseAllowsCheckAndResults() {
  return (
    isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.runCheckAndResultPopup
  );
}

/** 프로젝트 저장·선택 UI 숨김 */
export function guestBrowseHidesProjectSaveUi() {
  return isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.hideProjectSaveUi;
}

/** 둘러보기 — 프로젝트 이름 표시 */
export const GUEST_BROWSE_PROJECT_NAME = '교정냥 모모 이야기';

/** 둘러보기 — 저장 프로젝트 드롭다운 목록 숨김(표시만, 저장소는 유지) */
export function guestBrowseHidesProjectList() {
  return isGuestBrowseActive();
}

/** 둘러보기 — 상단 프로젝트 이름 강제 표시 */
export function guestBrowseProjectDisplayName() {
  if (!isGuestBrowseActive()) return null;
  return GUEST_BROWSE_PROJECT_NAME;
}

/** 「안녕하세요」 등 인사 문구 숨김(가이드 앵커는 유지) */
export function guestBrowseHidesGreetingText() {
  return isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.hideGreetingText;
}

/** 하단 썸네일 미리보기 접기·토글 숨김 */
export function guestBrowseHidesThumbStrip() {
  return isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.hideThumbStrip;
}

/** 1번 말풍선 후 기준 검수 클릭 손 안내 (직접 클릭으로 진행) */
export function guestBrowseAutoRunsCriteriaCheck() {
  return (
    isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.autoRunCriteriaCheck
  );
}

/** 둘러보기 반자동 — 검수 직전 「진행할까요?」 confirm 생략 */
export function guestBrowseSkipsCheckConfirm() {
  return guestBrowseAutoRunsCriteriaCheck();
}

/** 둘러보기 — 검수 결과 다운로드는 안내만(실제 파일 저장 없음) */
export function guestBrowseBlocksResultExport() {
  return guestBrowseAutoRunsCriteriaCheck();
}

/** 기준 검수 시작 — 결과 팝업 확인 전까지 다음 말풍선 잠금 */
export function markGuestBrowseCriteriaClick() {
  nextGuideReady = false;
  notifyNextGuideListeners();
  if (!guestBrowseAutoRunsCriteriaCheck()) return;
  criteriaClickAtMs = Date.now();
}

/** 표기 통일 기준 검수 시작 — 결과 팝업 확인 전까지 저장·다운로드 안내 잠금 */
export function markConsistencyCheckStartedForExportGuide() {
  exportGuideReady = false;
  notifyExportGuideListeners();
}

/** 손 클릭 후 결과 팝업까지 남은 시간 대기 */
export async function waitGuestBrowseResultScreenDelay() {
  if (!guestBrowseAutoRunsCriteriaCheck()) return;
  if (!criteriaClickAtMs) return;
  const dueAt = criteriaClickAtMs + GUEST_BROWSE_TIMING.resultAfterClickMs;
  const waitMs = dueAt - Date.now();
  if (waitMs > 0) await sleep(waitMs);
}

/**
 * 결과 팝업을 띄우고, 확인(닫기) 뒤에 2번 가이드를 연다.
 * @param {(extra?: { showGuideHand?: boolean }) => Promise<void>} showResultAlert
 */
export async function finishGuestBrowseResultThenUnlockNextGuide(
  showResultAlert,
) {
  nextGuideReady = false;
  notifyNextGuideListeners();

  if (!guestBrowseAutoRunsCriteriaCheck()) {
    await showResultAlert();
    nextGuideReady = true;
    notifyNextGuideListeners();
    return;
  }

  await waitGuestBrowseResultScreenDelay();
  await showResultAlert({ showGuideHand: true });
  nextGuideReady = true;
  notifyNextGuideListeners();
}

/**
 * 표기 통일 결과 팝업을 띄우고, 확인(닫기) 뒤에 다운로드 가이드를 연다.
 * @param {(extra?: { showGuideHand?: boolean }) => Promise<void>} showResultAlert
 */
export async function finishGuestBrowseConsistencyResultThenUnlockExportGuide(
  showResultAlert,
) {
  exportGuideReady = false;
  notifyExportGuideListeners();

  if (!guestBrowseAutoRunsCriteriaCheck()) {
    await showResultAlert();
    exportGuideReady = true;
    notifyExportGuideListeners();
    return;
  }

  await showResultAlert({ showGuideHand: true });
  exportGuideReady = true;
  notifyExportGuideListeners();
}

/** 결과 팝업 확인 전 — 다음(2번) 가이드를 아직 열면 안 되는지 */
export function isGuestBrowseNextGuideReady() {
  return nextGuideReady;
}

/** 결과 팝업 확인 전 — 저장·다운로드 가이드를 아직 열면 안 되는지 */
export function isGuestBrowseExportGuideReady() {
  return exportGuideReady;
}

/** @param {() => void} listener */
export function subscribeGuestBrowseNextGuide(listener) {
  nextGuideListeners.add(listener);
  return () => {
    nextGuideListeners.delete(listener);
  };
}

/** @param {() => void} listener */
export function subscribeGuestBrowseExportGuide(listener) {
  exportGuideListeners.add(listener);
  return () => {
    exportGuideListeners.delete(listener);
  };
}

/**
 * 둘러보기 — 표기 통일 등록 칩만 제거 (본·보 선택은 유지)
 * @param {import('./ruleTypes.js').Rule[] | null | undefined} customRules
 */
export function clearGuestBrowseConsistencyChips(customRules) {
  const base = Array.isArray(customRules) ? customRules : [];
  return base.filter(
    (rule) => !GUEST_BROWSE_CONSISTENCY_CHIP_KINDS.has(rule.patternKind ?? ''),
  );
}

/**
 * 둘러보기 — 표기 통일 탭 진입 시 등록 칩 비우고 본·보 전체 선택
 * @param {import('./ruleTypes.js').Rule[] | null | undefined} customRules
 */
export function prepareGuestBrowseConsistencyRules(customRules) {
  const withoutChips = clearGuestBrowseConsistencyChips(customRules);
  return setAllAuxiliaryVerbEntries(
    withoutChips,
    listAuxiliaryVerbEntries(withoutChips),
    true,
  );
}
