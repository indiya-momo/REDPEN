/** 목업(`mypage-mock`) Library — 슬롯 게이지·끝 칸 기준 */
export const MOCK_LIBRARY_SLOT_MAX = 3;

/** 마이페이지 「나의 프로젝트」 그리드 표시 상한 (저장 쿼터와 무관) */
export const MYPAGE_PROJECT_CARD_DISPLAY_MAX = 4;

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} projects
 */
export function planMyPageProjectGrid(projects) {
  const visibleProjects = [...(projects ?? [])]
    .sort((a, b) => Date.parse(b.savedAt ?? '') - Date.parse(a.savedAt ?? ''))
    .slice(0, MYPAGE_PROJECT_CARD_DISPLAY_MAX);
  const visibleEmptySlotCount = Math.max(
    0,
    MYPAGE_PROJECT_CARD_DISPLAY_MAX - visibleProjects.length,
  );
  return { visibleProjects, visibleEmptySlotCount };
}

/**
 * Library 3슬롯 선반 — index 순서대로 카드 또는 null(빈 칸).
 *
 * @param {readonly unknown[]} cards
 */
export function buildMockLibrarySlots(cards) {
  return Array.from(
    { length: MOCK_LIBRARY_SLOT_MAX },
    (_, index) => cards[index] ?? null,
  );
}

/**
 * 목업과 동일 — 카드 개수 기준 끝 1칸 (빈 슬롯 또는 슬롯 가득 참).
 *
 * @param {number} cardCount
 */
export function planMyPageProjectTrailingSlot(cardCount = 0) {
  return {
    showEmptySlot: cardCount < MOCK_LIBRARY_SLOT_MAX,
    showLockedSlot: cardCount >= MOCK_LIBRARY_SLOT_MAX,
  };
}
