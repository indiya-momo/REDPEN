import { describe, expect, it } from 'vitest';
import { planSaveCriteriaPreset } from './saveCriteriaPresetPlan.js';

/** @param {Partial<import('./ruleSetsStorage.js').RuleSet>} patch */
function set(patch) {
  return {
    id: 'id',
    name: '',
    builtInEnabled: {},
    cautionEnabled: {},
    customRules: [],
    globalExcludePhrases: [],
    ...patch,
  };
}

const baseParams = {
  config: { builtInEnabled: { rule1: true }, customRules: [] },
  savedAt: '2026-07-13T00:00:00.000Z',
  criteriaCheckpoint: 'cp',
  createId: () => 'new-id',
};

describe('planSaveCriteriaPreset', () => {
  it('복사본을 저장할 때 이름이 다른 프로젝트와 겹치면 막는다 (원본 보호)', () => {
    const sets = [
      set({ id: 'orig', name: '편0맞0 (복사)', savedAt: '2026-07-11' }),
      set({ id: 'copy', name: '편0맞0 (복사)(1)', savedAt: '2026-07-11' }),
    ];
    // 복사본(copy)에서 작업 중인데 이름칸이 원본 이름으로 되어 있는 상황
    const result = planSaveCriteriaPreset(sets, {
      ...baseParams,
      sourceId: 'copy',
      name: '편0맞0 (복사)',
    });
    expect(result).toEqual({ ok: false, reason: 'duplicate_name' });
  });

  it('원본은 손대지 않는다 (막힌 뒤 목록 그대로)', () => {
    const orig = set({ id: 'orig', name: 'A', savedAt: '2026-07-11' });
    const copy = set({ id: 'copy', name: 'A(1)', savedAt: '2026-07-11' });
    const sets = [orig, copy];
    const result = planSaveCriteriaPreset(sets, {
      ...baseParams,
      sourceId: 'copy',
      name: 'A',
    });
    expect(result.ok).toBe(false);
    // 입력 배열이 그대로 유지되는지 (아무 것도 덮이지 않음)
    expect(sets[0]).toBe(orig);
    expect(sets[1]).toBe(copy);
  });

  it('같은 프로젝트를 재저장하면 그 프로젝트만 갱신한다', () => {
    const sets = [
      set({ id: 'orig', name: 'A', savedAt: '2026-07-11' }),
      set({ id: 'copy', name: 'A(1)', savedAt: '2026-07-11' }),
    ];
    const result = planSaveCriteriaPreset(sets, {
      ...baseParams,
      sourceId: 'copy',
      name: 'A(1)',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetId).toBe('copy');
    expect(result.next.find((s) => s.id === 'copy').builtInEnabled).toEqual({
      rule1: true,
    });
    expect(result.intent).toEqual({});
  });

  it('새 이름이면 새 프로젝트를 만든다', () => {
    const sets = [set({ id: 'orig', name: 'A', savedAt: '2026-07-11' })];
    const result = planSaveCriteriaPreset(sets, {
      ...baseParams,
      sourceId: 'orig',
      name: '완전히 새 이름',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetId).toBe('new-id');
    expect(result.next).toHaveLength(2);
    expect(result.intent).toEqual({ added: ['new-id'] });
  });

  it('저장 안 된 단일 초안이면 그 자리에 첫 저장한다', () => {
    const sets = [set({ id: 'draft', name: '' })]; // savedAt 없음
    const result = planSaveCriteriaPreset(sets, {
      ...baseParams,
      sourceId: 'draft',
      name: '첫 프로젝트',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetId).toBe('draft');
    expect(result.next).toHaveLength(1);
    expect(result.next[0].name).toBe('첫 프로젝트');
  });

  it('활성 프로젝트가 없으면 not_found', () => {
    const sets = [set({ id: 'a', name: 'A', savedAt: '2026-07-11' })];
    expect(
      planSaveCriteriaPreset(sets, { ...baseParams, sourceId: 'x', name: 'B' }),
    ).toEqual({ ok: false, reason: 'not_found' });
  });

  it('빈 이름은 막는다', () => {
    const sets = [set({ id: 'a', name: 'A', savedAt: '2026-07-11' })];
    expect(
      planSaveCriteriaPreset(sets, { ...baseParams, sourceId: 'a', name: '   ' }),
    ).toEqual({ ok: false, reason: 'empty_name' });
  });
});
