import { afterEach, describe, expect, it } from 'vitest';
import {
  canAddCriteriaPreset,
  countSavedCriteriaPresets,
  enforceMaxCriteriaPresets,
  MAX_CRITERIA_PRESETS,
} from './criteriaPresetLimit.js';

/** @param {string} id @param {string} name @param {string} [savedAt] */
function set(id, name, savedAt) {
  return {
    id,
    name,
    savedAt,
    builtInEnabled: {},
    cautionEnabled: {},
    customRules: [],
  };
}

describe('countSavedCriteriaPresets', () => {
  it('savedAt 있는 세트만 센다', () => {
    expect(
      countSavedCriteriaPresets([
        set('a', 'A', '2026-01-01'),
        set('b', ''),
        set('c', 'C', '2026-01-02'),
      ]),
    ).toBe(2);
  });
});

describe('canAddCriteriaPreset', () => {
  const prevUids = import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS;

  afterEach(() => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = prevUids;
  });

  it('일반 계정 — 저장 1개면 새 이름 추가 불가', () => {
    const sets = [set('a', '기존', '2026-01-01')];
    expect(canAddCriteriaPreset(sets, '새 기준', 'u1', '')).toBe(false);
    expect(canAddCriteriaPreset(sets, '기존', 'u1', '')).toBe(true);
  });

  it('관리자 uid — 여러 개 추가 가능', () => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = 'admin-uid';
    const sets = [
      set('a', 'A', '2026-01-01'),
      set('b', 'B', '2026-01-02'),
    ];
    expect(canAddCriteriaPreset(sets, 'C', 'admin-uid', '')).toBe(true);
  });
});

describe('enforceMaxCriteriaPresets', () => {
  it(`비관리자 — 저장 프리셋 ${MAX_CRITERIA_PRESETS}개만 남김`, () => {
    const sets = [
      set('draft', ''),
      set('old', '옛', '2026-01-01'),
      set('new', '최신', '2026-06-01'),
    ];
    const next = enforceMaxCriteriaPresets(sets, 'user', '');
    expect(next.map((s) => s.id)).toEqual(['draft', 'new']);
  });
});
