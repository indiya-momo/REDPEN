/** 현재 페이지 기준 앞뒤로 보여 줄 썸네일 수 (총 5칸, 가운데가 현재 페이지) */
export const THUMB_RADIUS = 2;

/**
 * @param {number} currentPage
 * @param {number} numPages
 * @returns {(number | null)[]}
 */
export function thumbSlotPages(currentPage, numPages) {
  return Array.from({ length: THUMB_RADIUS * 2 + 1 }, (_, i) => {
    const pageNum = currentPage + (i - THUMB_RADIUS);
    if (pageNum < 1 || pageNum > numPages) return null;
    return pageNum;
  });
}
