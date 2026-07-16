import { afterEach, describe, expect, it } from 'vitest';
import {
  canAddCriteriaPreset,
  countSavedCriteriaPresets,
  enforceMaxCriteriaPresets,
  formatCriteriaPresetLimitMessage,
  getMaxCriteriaPresets,
  MAX_CRITERIA_PRESETS_FREE,
  MAX_CRITERIA_PRESETS_PAID,
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

describe('getMaxCriteriaPresets', () => {
  const prevUids = import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS;

  afterEach(() => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = prevUids;
  });

  it('무료 1 · 유료 3 · 관리자 무제한', () => {
    expect(getMaxCriteriaPresets('u1', '', 'free')).toBe(
      MAX_CRITERIA_PRESETS_FREE,
    );
    expect(getMaxCriteriaPresets('u1', '', 'paid')).toBe(
      MAX_CRITERIA_PRESETS_PAID,
    );
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = 'admin-uid';
    expect(getMaxCriteriaPresets('admin-uid', '', 'free')).toBe(null);
  });
});

describe('canAddCriteriaPreset', () => {
  const prevUids = import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS;

  afterEach(() => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = prevUids;
  });

  it('무료 — 저장 1개면 새 이름 추가 불가', () => {
    const sets = [set('a', 'A', '2026-01-01')];
    expect(canAddCriteriaPreset(sets, '새 기준', 'u1', '', 'free')).toBe(
      false,
    );
    expect(canAddCriteriaPreset(sets, 'A', 'u1', '', 'free')).toBe(true);
  });

  it('유료 — 저장 2개면 추가 가능, 3개면 불가', () => {
    const two = [
      set('a', 'A', '2026-01-01'),
      set('b', 'B', '2026-01-02'),
    ];
    expect(canAddCriteriaPreset(two, 'C', 'u1', '', 'paid')).toBe(true);
    const three = [...two, set('c', 'C', '2026-01-03')];
    expect(canAddCriteriaPreset(three, 'D', 'u1', '', 'paid')).toBe(false);
  });

  it('관리자 uid — 여러 개 추가 가능', () => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = 'admin-uid';
    const sets = [
      set('a', 'A', '2026-01-01'),
      set('b', 'B', '2026-01-02'),
      set('c', 'C', '2026-01-03'),
    ];
    expect(canAddCriteriaPreset(sets, 'D', 'admin-uid', '', 'free')).toBe(
      true,
    );
  });
});

describe('enforceMaxCriteriaPresets', () => {
  it('무료 — 최근 1개만 남김', () => {
    const sets = [
      set('draft', ''),
      set('old', '옛', '2026-01-01'),
      set('newest', '최신', '2026-06-01'),
    ];
    const next = enforceMaxCriteriaPresets(sets, 'user', '', 'free');
    expect(next.map((s) => s.id)).toEqual(['draft', 'newest']);
  });

  it('유료 — 최근 3개만 남김', () => {
    const sets = [
      set('draft', ''),
      set('old', '옛', '2026-01-01'),
      set('mid', '중간', '2026-03-01'),
      set('newer', '더최근', '2026-05-01'),
      set('newest', '최신', '2026-06-01'),
    ];
    const next = enforceMaxCriteriaPresets(sets, 'user', '', 'paid');
    expect(next.map((s) => s.id)).toEqual([
      'draft',
      'mid',
      'newer',
      'newest',
    ]);
  });
});

describe('formatCriteriaPresetLimitMessage', () => {
  it('개수를 문구에 넣는다', () => {
    expect(formatCriteriaPresetLimitMessage(1)).toContain('1개');
    expect(formatCriteriaPresetLimitMessage(3)).toContain('3개');
  });
});
