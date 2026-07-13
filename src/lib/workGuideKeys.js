import { clearTooltipGuideDismissed } from './tooltipGuideStorage.js';

const TOOLTIP_GUIDE_PREFIX = 'pdf-proofread-tooltip-guide-';

/**
 * 작업 화면 말풍선 storageKey (tooltipGuideStorage 접두사와 결합)
 *
 * **두 경로**
 * - **둘러보기(게스트)**: `beginGuestBrowse` 세션 — 데모 원고·자동 검수 등과 함께
 * - **로그인 회원 온보딩**: uid별 dismiss + `workGuideOnboardingExposure`(하루 1·최대 5회)
 *
 * UI는 `useGuestBrowseWorkGuide` (이름 레거시). 비로그인·비둘러보기에서는 EMPTY.
 *
 * **로그인 온보딩**
 * - **0**: 맞춤법 탭·외래어 (`LOANWORD_INTRO`)
 * - **1**: 검수 기준 (`LEFT_CRITERIA`)
 * - **1b**: PDF 업로드 (`PRE_UPLOAD`) — 옛 0
 * - **업로드 직후**: 기준 검수 안내 (`SPELLING_START_CHECK`)
 * - **2~**: FIRST_RESULT … AUXILIARY → (표기 통일 검수) → RULE_SET_SAVE …
 *
 * **둘러보기** — 별도 문구·순서 (`workGuideMessagesGuest`). 여기 키 주석의 로그인 번호와 다름.
 *
 * 말풍선 위치: UI 앵커 기준 (`TooltipGuide` placement + offset px).
 */

export const WORK_GUIDE_KEYS = {
  /** 1b(회원)·둘러보기 업로드 — 옛 `pdf-upload-first-step` dismiss와 분리(v1) */
  PRE_UPLOAD: 'work-pre-upload-v1',
  /** 로그인 0 — 외래어·맞춤법 탭 소개 */
  LOANWORD_INTRO: 'work-loanword-intro-v1',
  /** 3번 — 순서 교체(2026-06)로 v2 (v1 dismiss는 체인에 반영 안 됨) */
  PDF_OPENED: 'work-pdf-opened-v2',
  LEFT_CRITERIA: 'work-left-criteria-v2',
  /** 둘러보기 1b / 회원 업로드 직후 — 기준 검수 안내 */
  SPELLING_START_CHECK: 'work-spelling-start-check-v1',
  /** 2번 — 순서 교체(2026-06)로 v2 */
  FIRST_RESULT: 'work-first-result-v2',
  CONSISTENCY_INTRO: 'work-consistency-intro-v1',
  /** 통일형 📌 지정 (4번 다음) */
  CONSISTENCY_UNIFY_PIN: 'work-consistency-unify-pin-v1',
  AUXILIARY_VERB_INTRO: 'work-auxiliary-verb-intro-v1',
  /** 로그인 — 표기 통일 기준 검수·다운로드 안내 (저장 안내 직전) */
  CONSISTENCY_START_CHECK: 'work-consistency-start-check-v1',
  RULE_SET_SAVE: 'work-rule-set-save-v1',
  WORK_EXIT: 'work-exit-v1',
  /** 피드백 제출 보너스 감사 말풍선 (온보딩 5회와 별도) */
  FEEDBACK_QUOTA_THANK: 'feedback-quota-thank-v2',
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
 * 로컬 dev — 마지막으로 본 가이드 단계 고정. `?workGuide=10` 이 우선.
 * 0=로그인 외래어(또는 둘러보기 업로드), 1=기준, 10=업로드(1b), 2~9·11=이후.
 * @returns {number | null}
 */
export function getDevWorkGuideForceStep() {
  if (!isLocalDevBrowser()) return null;
  const q = new URLSearchParams(window.location.search).get('workGuide');
  if (q != null && q !== '') {
    const n = Number(q);
    if (Number.isInteger(n) && n >= 0 && n <= 11) return n;
  }
  try {
    const stored = sessionStorage.getItem(DEV_WORK_GUIDE_FORCE_KEY);
    if (stored != null && stored !== '') {
      const n = Number(stored);
      if (Number.isInteger(n) && n >= 0 && n <= 11) return n;
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
    if (!Number.isInteger(step) || step < 0 || step > 11) return;
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
  // uid 인자 없이/게스트로 시작할 때 — `--uid` 접미사 dismiss도 함께 제거
  if (!id) {
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const full = localStorage.key(i);
        if (!full || !full.startsWith(TOOLTIP_GUIDE_PREFIX)) continue;
        const rest = full.slice(TOOLTIP_GUIDE_PREFIX.length);
        const matched = Object.values(WORK_GUIDE_KEYS).some(
          (key) => rest === key || rest.startsWith(`${key}--`),
        );
        if (matched) toRemove.push(full);
      }
      for (const full of toRemove) localStorage.removeItem(full);
    } catch {
      /* private mode */
    }
  }
}
