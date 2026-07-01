import { describe, expect, it } from 'vitest';
import {
  MYPAGE_PROJECT_CARD_DISPLAY_MAX,
  planMyPageProjectGrid,
  planMyPageProjectSlots,
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

describe('planMyPageProjectSlots', () => {
  it('저장 0개 — 저장 안내 1칸 + 잠금 3칸', () => {
    expect(planMyPageProjectSlots([])).toEqual({
      visibleProjects: [],
      actionableEmptySlotCount: 1,
      lockedSlotCount: 3,
    });
  });

  it('저장 1개(쿼터 찼음) — 잠금 3칸만', () => {
    expect(
      planMyPageProjectSlots([project('a', '2026-06-01')], { savedCount: 1 }),
    ).toEqual({
      visibleProjects: [project('a', '2026-06-01')],
      actionableEmptySlotCount: 0,
      lockedSlotCount: 3,
    });
  });

  it('관리자 면제 — 빈 칸 모두 저장 안내, 잠금 없음', () => {
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
