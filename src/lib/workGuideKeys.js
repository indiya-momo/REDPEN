import { clearTooltipGuideDismissed } from './tooltipGuideStorage.js';

/**
 * 작업 화면 말풍선 storageKey (tooltipGuideStorage 접두사와 결합)
 *
 * 통칭 **1~7번 말풍선** = PDF 업로드·추출 이후 체인 (맞춤법·일관성·종료).
 * - **1번**: 검수 기준 선택·목록 (`LEFT_CRITERIA`)
 * - **2번**: 검수 결과 안내 (`FIRST_RESULT`)
 * - **3번**: 파일 - 원고 페이지 맞추기 (`PDF_OPENED`)
 * - **4번**: 일관성 탭 안내 (`CONSISTENCY_INTRO`) — 우측 상단 인사 영역
 * - **5번**: 본용언+보조용언 표기 (`AUXILIARY_VERB_INTRO`) — 4번 가로·박스 상단 높이
 * - **6번**: 기준 저장 안내 (`RULE_SET_SAVE`) — 우측 인사말 영역
 * - **7번**: 작업 종료·로그아웃 안내 (`WORK_EXIT`) — 로그아웃 버튼 아래·오른쪽 정렬
 *
 * 업로드 전 「처음 할 일은 이거다냥」(`PRE_UPLOAD`)은 1~7 체인에 포함하지 않음.
 *
 * 말풍선 위치: UI 앵커 기준 (`TooltipGuide` placement + offset px). 뷰포트 x,y 숫자는
 * 브라우저 창 기준이라 인디야 작업면만의 2880×1454 좌표와 1:1로 안 맞음.
 * - **1번** 앵커: 기준 이름 옆 `>` · **3번** 앵커: 파일 - 원고 페이지 맞추기
 */

export const WORK_GUIDE_KEYS = {
  PRE_UPLOAD: 'pdf-upload-first-step',
  /** 3번 — 순서 교체(2026-06)로 v2 (v1 dismiss는 체인에 반영 안 됨) */
  PDF_OPENED: 'work-pdf-opened-v2',
  LEFT_CRITERIA: 'work-left-criteria-v1',
  /** 2번 — 순서 교체(2026-06)로 v2 */
  FIRST_RESULT: 'work-first-result-v2',
  CONSISTENCY_INTRO: 'work-consistency-intro-v1',
  AUXILIARY_VERB_INTRO: 'work-auxiliary-verb-intro-v1',
  RULE_SET_SAVE: 'work-rule-set-save-v1',
  WORK_EXIT: 'work-exit-v1',
  /** 피드백 제출 보너스 감사 말풍선 (온보딩 5회와 별도) */
  FEEDBACK_QUOTA_THANK: 'feedback-quota-thank-v1',
};

/**
 * 말풍선 pin — 확인해도 숨김·체인 dismiss 안 함 (UI 튜닝용).
 * `VITE_WORK_GUIDE_PIN_ALL=true`, URL `?workGuidePin=1` 로만 켬. 기본은 OFF.
 */
export function isWorkGuidePinned() {
  if (import.meta.env.VITE_WORK_GUIDE_PIN_ALL === 'true') return true;
  if (import.meta.env.VITE_WORK_GUIDE_PIN_ALL === 'false') return false;
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search);
    if (q.get('workGuidePin') === '1') return true;
    if (q.get('workGuidePin') === '0') return false;
  }
  return false;
}

/**
 * @param {string} uid
 * @param {string} key
 */
export function workGuideStorageKey(uid, key) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  return id ? `${key}--${id}` : key;
}

const DEV_WORK_GUIDE_FORCE_KEY = 'indiya-dev-work-guide-force';

/** @returns {boolean} */
function isLocalDevBrowser() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * 로컬 dev — 마지막으로 본 1~7번(0=업로드 전) 고정. `?workGuide=7` 이 우선.
 * @returns {number | null}
 */
export function getDevWorkGuideForceStep() {
  if (!isLocalDevBrowser()) return null;
  const q = new URLSearchParams(window.location.search).get('workGuide');
  if (q != null && q !== '') {
    const n = Number(q);
    if (Number.isInteger(n) && n >= 0 && n <= 7) return n;
  }
  try {
    const stored = sessionStorage.getItem(DEV_WORK_GUIDE_FORCE_KEY);
    if (stored != null && stored !== '') {
      const n = Number(stored);
      if (Number.isInteger(n) && n >= 0 && n <= 7) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {number | null} step */
export function setDevWorkGuideForceStep(step) {
  if (!isLocalDevBrowser()) return;
  try {
    if (step == null) {
      sessionStorage.removeItem(DEV_WORK_GUIDE_FORCE_KEY);
      return;
    }
    sessionStorage.setItem(DEV_WORK_GUIDE_FORCE_KEY, String(step));
  } catch {
    /* ignore */
  }
}

/** 작업 화면 진입 시 말풍선을 처음부터 다시 보이게 할 때 호출 */
export function clearAllWorkGuideDismissals(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  for (const key of Object.values(WORK_GUIDE_KEYS)) {
    clearTooltipGuideDismissed(workGuideStorageKey(id, key));
  }
}
