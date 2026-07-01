import { MAX_CRITERIA_PRESETS } from './criteriaPresetLimit.js';

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
 * 그리드 칸을 저장 가능 빈 슬롯 vs 잠금 슬롯으로 나눈다.
 * 일반 계정은 저장 쿼터가 찼으면 빈 칸을 모두 잠금(유료 티저)으로 표시한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} projects
 * @param {{ exempt?: boolean, savedCount?: number, maxSlots?: number }} [options]
 */
export function planMyPageProjectSlots(projects, options = {}) {
  const {
    exempt = false,
    savedCount,
    maxSlots = MAX_CRITERIA_PRESETS,
  } = options;
  const { visibleProjects, visibleEmptySlotCount } =
    planMyPageProjectGrid(projects);
  const count = savedCount ?? projects?.length ?? 0;

  if (exempt) {
    return {
      visibleProjects,
      actionableEmptySlotCount: visibleEmptySlotCount,
      lockedSlotCount: 0,
    };
  }

  const canSaveMore = count < maxSlots;
  const actionableEmptySlotCount = canSaveMore
    ? Math.min(1, visibleEmptySlotCount)
    : 0;
  const lockedSlotCount = visibleEmptySlotCount - actionableEmptySlotCount;

  return {
    visibleProjects,
    actionableEmptySlotCount,
    lockedSlotCount,
  };
}
