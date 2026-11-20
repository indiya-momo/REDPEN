/**
 * 원고 작업대 도메인 최소 형태.
 *
 * @typedef {Object} TextHit
 * @property {number} pageNum
 * @property {number} start
 * @property {number} end
 * @property {string} matchedText
 * @property {string} [snippet]
 *
 * @typedef {TextHit & {
 *   replace: string,
 *   tip?: string,
 *   source: 'manual',
 * }} ManualFinding
 *
 * @typedef {Object} TextLayerSelection
 * @property {number} startItemIndex
 * @property {number} startOffset
 * @property {number} endItemIndex
 * @property {number} endOffset
 */

export const MANUAL_CATEGORY = 'manual';
export const MANUAL_PATTERN_KIND = 'manual-add';
export const MANUAL_SOURCE = 'manual';
export const MANUAL_BADGE_LABEL = '수정 추가';
export const MANUAL_LIST_LABEL = '수정 리스트';

/** @param {number} count */
export function manualListButtonLabel(count) {
  const n = Number(count) || 0;
  return n > 0 ? `${MANUAL_LIST_LABEL} ${n}` : MANUAL_LIST_LABEL;
}
export const SEARCH_CATEGORY = 'manuscript-search';
export const SEARCH_PATTERN_KIND = 'manuscript-search';
export const SEARCH_BADGE_LABEL = '검색';

/** @param {{ category?: string } | null | undefined} group */
export function isManuscriptSearchGroup(group) {
  return group?.category === SEARCH_CATEGORY;
}
/** 확인 폼 비차단 안내 기준. 현장 보고 후 숫자만 바꿀 것. */
export const MANUAL_LONG_RANGE_HINT_CHARS = 40;
export const MANUAL_PERSIST_NOTICE =
  '직접 추가한 수정은 이 프로젝트에 함께 저장됩니다.';
export const MANUAL_LEAVE_CONFIRM =
  '직접 추가한 수정은 이 프로젝트에 저장되어 있습니다.';
export const MANUAL_SEARCH_EMPTY =
  '찾은 곳이 없습니다. 입력한 글자 그대로만 찾습니다.';
export const MANUAL_SEARCH_HINT = '원고 본문에서 찾습니다.';
export const MANUAL_ADD_HINT =
  '수정할 텍스트를 드래그해';
export const MANUAL_ADD_HINT_REST = '수정할 내용을 입력하세요';
export const MANUAL_ADD_CANCEL_HINT = '취소: 마우스 우클릭';
export const MANUAL_LONG_RANGE_HINT =
  '이 구간이 깁니다. 인디자인에서 다른 수정과 겹치면 한쪽만 남을 수 있습니다.';
export const MANUAL_LEAVE_END_EXTRA = '직접 추가한 수정은 이 프로젝트에 남아 있습니다.';
