/** 마이페이지 「나의 프로젝트」 그리드 표시 상한 (저장 쿼터와 무관) */
export const MYPAGE_PROJECT_CARD_DISPLAY_MAX = 2;

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
