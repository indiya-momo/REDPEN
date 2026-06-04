import { clearTooltipGuideDismissed } from './tooltipGuideStorage.js';

/**
 * 작업 화면 말풍선 storageKey (tooltipGuideStorage 접두사와 결합)
 *
 * 통칭 **1~7번 말풍선** = PDF 업로드·추출 이후 체인 (맞춤법·일관성·종료).
 * - **1번**: 인쇄 쪽 보정 — PDF·원고 페이지 맞추기 (`PDF_OPENED`)
 * - **2번**: 검수 기준 선택·목록 (`LEFT_CRITERIA`)
 * - **3번**: 검수 결과 안내 (`FIRST_RESULT`)
 * - **4번**: 일관성 탭 안내 (`CONSISTENCY_INTRO`) — 우측 상단 인사 영역
 * - **5번**: 본용언+보조용언 표기 (`AUXILIARY_VERB_INTRO`) — 4번 가로·박스 상단 높이
 * - **6번**: 기준 저장 안내 (`RULE_SET_SAVE`) — 우측 인사말 영역
 * - **7번**: 작업 종료·로그아웃 안내 (`WORK_EXIT`) — 로그아웃 버튼 아래
 *
 * 업로드 전 「처음 할 일은 이거다냥」(`PRE_UPLOAD`)은 1~7 체인에 포함하지 않음.
 *
 * 말풍선 위치: UI 앵커 기준 (`TooltipGuide` placement + offset px). 뷰포트 x,y 숫자는
 * 브라우저 창 기준이라 인디야 작업면만의 2880×1454 좌표와 1:1로 안 맞음.
 * - **2번** 앵커: 좌패널 기준 이름 옆 `>` (`panel-left__criteria-picker-toggle`)
 */

export const WORK_GUIDE_KEYS = {
  PRE_UPLOAD: 'pdf-upload-first-step',
  PDF_OPENED: 'work-pdf-opened-v1',
  LEFT_CRITERIA: 'work-left-criteria-v1',
  FIRST_RESULT: 'work-first-result-v1',
  CONSISTENCY_INTRO: 'work-consistency-intro-v1',
  AUXILIARY_VERB_INTRO: 'work-auxiliary-verb-intro-v1',
  RULE_SET_SAVE: 'work-rule-set-save-v1',
  WORK_EXIT: 'work-exit-v1',
};

/**
 * `pinAll` 플래그만 켜는 개발용 옵션(표시 순서는 1→7 동일).
 * 기본 꺼짐. 켜려면 `VITE_WORK_GUIDE_PIN_ALL=true` 또는 URL `?workGuidePin=1`
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

/** 작업 화면 진입 시 말풍선을 처음부터 다시 보이게 할 때 호출 */
export function clearAllWorkGuideDismissals(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  for (const key of Object.values(WORK_GUIDE_KEYS)) {
    clearTooltipGuideDismissed(workGuideStorageKey(id, key));
  }
}
