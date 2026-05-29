/**
 * MainScreen 전용 순수 UI 연산 — React state·훅에 의존하지 않음.
 */

/** @typedef {'spelling' | 'consistency'} WorkTab */
/** @typedef {import('../lib/ruleEngine.js').GroupedResult} GroupedResult */
/** @typedef {{ group: GroupedResult, source: 'spelling' | 'consistency' }} TabEntry */

/**
 * 활성 작업 탭에 맞는 검사 결과 목록을 패널용 엔트리 배열로 만든다.
 * @param {WorkTab} workTab
 * @param {GroupedResult[]} spellingResults
 * @param {GroupedResult[]} consistencyResults
 * @returns {TabEntry[]}
 */
export function buildTabEntries(workTab, spellingResults, consistencyResults) {
  /** @type {TabEntry[]} */
  const entries = [];
  if (workTab === 'spelling') {
    for (const group of spellingResults) {
      entries.push({ group, source: 'spelling' });
    }
  } else {
    for (const group of consistencyResults) {
      entries.push({ group, source: 'consistency' });
    }
  }
  return entries;
}

/**
 * 탭 엔트리 목록의 발견 건수(instances) 합계.
 * @param {TabEntry[]} tabEntries
 * @returns {number}
 */
export function countTabTotalFindings(tabEntries) {
  return tabEntries.reduce((n, { group }) => n + group.instances.length, 0);
}

/**
 * 현재 탭에서 검사가 완료되었는지 여부.
 * @param {WorkTab} workTab
 * @param {boolean} spellingCheckDone
 * @param {boolean} consistencyCheckDone
 * @returns {boolean}
 */
export function isTabCheckDone(workTab, spellingCheckDone, consistencyCheckDone) {
  return workTab === 'spelling' ? spellingCheckDone : consistencyCheckDone;
}

/**
 * PDF 중앙 스테이지 실행 버튼 라벨(검사 중 / 검수 실행).
 * @param {boolean} isProcessing
 * @param {{ phase?: string } | null | undefined} progress
 * @returns {string}
 */
export function getCenterRunLabel(isProcessing, progress) {
  return isProcessing && progress?.phase === 'check' ? '검사 중…' : '검수 실행';
}

/**
 * 맞춤법 탭 레이아웃 루트 className (결과 패널 유무).
 * @param {boolean} tabCheckDone
 * @returns {string}
 */
export function getSpellingTabLayoutClassName(tabCheckDone) {
  return `spelling-tab-layout ${tabCheckDone ? 'spelling-tab-layout--with-results' : 'spelling-tab-layout--rules-only'}`;
}

/**
 * PDF 뷰어 영역 표시 여부.
 * @param {boolean} hasPdf
 * @param {boolean} tabCheckDone
 * @returns {boolean}
 */
export function shouldShowPdfViewer(hasPdf, tabCheckDone) {
  return Boolean(hasPdf) && tabCheckDone;
}

/**
 * 시스템 페이지 번호를 문서 페이지 범위 안으로 고정.
 * @param {number} pageNum
 * @param {number} numPages
 * @returns {number}
 */
export function clampPageNumber(pageNum, numPages) {
  return Math.min(numPages, Math.max(1, pageNum));
}

/**
 * localStorage에 저장된 썸네일 스트립 펼침 상태.
 * @returns {boolean}
 */
export function readThumbStripOpenPreference() {
  try {
    return localStorage.getItem('pdf-proofread-thumb-strip-open') === '1';
  } catch {
    return false;
  }
}

/**
 * 썸네일 스트립 펼침 상태를 localStorage에 기록.
 * @param {boolean} open
 */
export function persistThumbStripOpenPreference(open) {
  try {
    localStorage.setItem('pdf-proofread-thumb-strip-open', open ? '1' : '0');
  } catch {
    /* ignore */
  }
}
