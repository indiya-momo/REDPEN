import { describe, expect, it } from 'vitest';
import {
  buildMockLibrarySlots,
  formatLibrarySlotGauge,
  MOCK_LIBRARY_SLOT_MAX,
  MYPAGE_PROJECT_CARD_DISPLAY_MAX,
  planMyPageProjectGrid,
  planMyPageProjectSlots,
  planMyPageProjectTrailingSlot,
} from './mypageProjectDisplay.js';

/** @param {string} id @param {string} savedAt */
function project(id, savedAt) {
  return { id, name: id, savedAt };
}

describe('planMyPageProjectGrid', () => {
  it(`저장·빈 슬롯 합쳐 그리드 ${MYPAGE_PROJECT_CARD_DISPLAY_MAX}칸만 노출`, () => {
    expect(planMyPageProjectGrid([])).toEqual({
      visibleProjects: [],
      visibleEmptySlotCount: 4,
    });

    expect(planMyPageProjectGrid([project('a', '2026-06-01')])).toEqual({
      visibleProjects: [project('a', '2026-06-01')],
      visibleEmptySlotCount: 3,
    });

    const many = [
      project('old', '2026-01-01'),
      project('mid', '2026-06-01'),
      project('new', '2026-06-20'),
      project('extra', '2026-06-21'),
      project('fifth', '2026-06-22'),
    ];
    const { visibleProjects, visibleEmptySlotCount } =
      planMyPageProjectGrid(many);
    expect(visibleProjects.map((p) => p.id)).toEqual([
      'fifth',
      'extra',
      'new',
      'mid',
    ]);
    expect(visibleEmptySlotCount).toBe(0);
  });
});

describe('formatLibrarySlotGauge', () => {
  it('라이브러리 슬롯 게이지', () => {
    expect(formatLibrarySlotGauge(0)).toBe('0/3');
    expect(formatLibrarySlotGauge(2)).toBe('2/3');
    expect(formatLibrarySlotGauge(3)).toBe('3/3');
    expect(formatLibrarySlotGauge(5)).toBe('3/3');
  });
});

describe('buildMockLibrarySlots', () => {
  it('3칸 선반 — 카드 없으면 null', () => {
    expect(buildMockLibrarySlots([])).toEqual([null, null, null]);
  });

  it('3칸 선반 — 앞부터 채움', () => {
    expect(buildMockLibrarySlots([{ id: 'a' }, { id: 'b' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
      null,
    ]);
  });
});

describe('planMyPageProjectTrailingSlot', () => {
  it(`목업 — 카드 ${MOCK_LIBRARY_SLOT_MAX}개 미만이면 빈 슬롯`, () => {
    expect(planMyPageProjectTrailingSlot(0)).toEqual({
      showEmptySlot: true,
      showLockedSlot: false,
    });
    expect(planMyPageProjectTrailingSlot(2)).toEqual({
      showEmptySlot: true,
      showLockedSlot: false,
    });
  });

  it(`목업 — 카드 ${MOCK_LIBRARY_SLOT_MAX}개 이상이면 슬롯 가득 참`, () => {
    expect(planMyPageProjectTrailingSlot(3)).toEqual({
      showEmptySlot: false,
      showLockedSlot: true,
    });
  });
});

describe('planMyPageProjectSlots', () => {
  it('저장 0개 → 저장 안내 1칸 + 잠금 3칸', () => {
    expect(planMyPageProjectSlots([])).toEqual({
      visibleProjects: [],
      actionableEmptySlotCount: 1,
      lockedSlotCount: 3,
    });
  });

  it('저장 1개(쿼터 찼음) → 잠금 3칸만', () => {
    expect(
      planMyPageProjectSlots([project('a', '2026-06-01')], { savedCount: 1 }),
    ).toEqual({
      visibleProjects: [project('a', '2026-06-01')],
      actionableEmptySlotCount: 0,
      lockedSlotCount: 3,
    });
  });

  it('관리자 면제 시 빈 칸 모두 저장 안내, 잠금 없음', () => {
    expect(
      planMyPageProjectSlots([project('a', '2026-06-01')], {
        exempt: true,
        savedCount: 1,
      }),
    ).toEqual({
      visibleProjects: [project('a', '2026-06-01')],
      actionableEmptySlotCount: 3,
      lockedSlotCount: 0,
    });
  });
});
