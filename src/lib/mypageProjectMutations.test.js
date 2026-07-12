import { afterEach, describe, expect, it, vi } from 'vitest';
import * as criteriaPresetLimit from './criteriaPresetLimit.js';
import {
  planDeleteProject,
  planDuplicateProject,
  planRenameProject,
} from './mypageProjectMutations.js';

/** @param {Partial<import('./ruleSetsStorage.js').RuleSet>} patch */
function set(patch) {
  return {
    id: 'id',
    name: '',
    builtInEnabled: {},
    customRules: [],
    globalExcludePhrases: [],
    ...patch,
  };
}

describe('planRenameProject', () => {
  it('이름을 바꾼다', () => {
    const sets = [set({ id: 'a', name: 'A', savedAt: '2026-01-01' })];
    const result = planRenameProject(sets, 'a', '  B  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next[0].name).toBe('B');
  });

  it('빈 이름·중복 이름을 거부한다', () => {
    const sets = [
      set({ id: 'a', name: 'A', savedAt: '2026-01-01' }),
      set({ id: 'b', name: 'B', savedAt: '2026-01-02' }),
    ];
    expect(planRenameProject(sets, 'a', '   ')).toEqual({
      ok: false,
      reason: 'empty_name',
    });
    expect(planRenameProject(sets, 'a', 'B')).toEqual({
      ok: false,
      reason: 'duplicate_name',
    });
  });
});

describe('planDuplicateProject', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('복사본을 추가한다', () => {
    vi.spyOn(criteriaPresetLimit, 'canAddCriteriaPreset').mockReturnValue(true);
    const sets = [
      set({
        id: 'a',
        name: '경제서',
        savedAt: '2026-01-01',
        tags: ['웹소설'],
      }),
    ];
    const result = planDuplicateProject(sets, 'a', 'admin', 'admin@test.com');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toHaveLength(2);
    expect(result.next[1].id).not.toBe('a');
    expect(result.next[1].name).toBe('경제서(1)');
    expect(result.next[1].tags).toEqual(['웹소설']);
    expect(result.next[1].savedAt).toBeTruthy();
  });

  it('슬롯이 꽉 차면 거부한다', () => {
    const sets = [
      set({ id: 'a', name: 'A', savedAt: '2026-01-01' }),
      set({ id: 'b', name: 'B', savedAt: '2026-01-02' }),
      set({ id: 'c', name: 'C', savedAt: '2026-01-03' }),
    ];
    const result = planDuplicateProject(sets, 'a');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('slot_limit');
  });
});

describe('planDeleteProject', () => {
  it('저장 프로젝트를 삭제한다', () => {
    const sets = [
      set({ id: 'a', name: 'A', savedAt: '2026-01-01' }),
      set({ id: 'b', name: 'B', savedAt: '2026-01-02' }),
    ];
    const result = planDeleteProject(sets, 'a', 'b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.map((item) => item.id)).toEqual(['a']);
    expect(result.nextActiveId).toBe('a');
  });

  it('마지막 저장 프로젝트 삭제 시 기본 세트를 만든다', () => {
    const sets = [set({ id: 'a', name: 'A', savedAt: '2026-01-01' })];
    const result = planDeleteProject(sets, 'a', 'a');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toHaveLength(1);
    expect(result.next[0].id).not.toBe('a');
    expect(result.next[0].savedAt).toBeFalsy();
    expect(result.nextActiveId).toBe(result.next[0].id);
  });
});
