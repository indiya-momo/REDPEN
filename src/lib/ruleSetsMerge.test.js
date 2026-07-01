import { describe, expect, it } from 'vitest';
import {
  applyCriteriaPresetQuota,
  dedupeSavedRuleSetsByName,
  mergeLocalRuleSetSources,
  mergeRuleSetsOnLogin,
  pickNewerRuleSet,
} from './ruleSetsMerge.js';

/** @param {string} id @param {Partial<import('./ruleSetsStorage.js').RuleSet>} extra */
function set(id, extra = {}) {
  return {
    id,
    name: '',
    builtInEnabled: {},
    cautionEnabled: {},
    customRules: [],
    ...extra,
  };
}

describe('pickNewerRuleSet', () => {
  it('savedAt이 더 최신인 쪽을 고른다', () => {
    const older = set('a', {
      savedAt: '2026-06-22T00:00:00.000Z',
      customRules: [{ id: 'old' }],
    });
    const newer = set('a', {
      savedAt: '2026-06-24T00:00:00.000Z',
      customRules: [{ id: 'new' }],
    });
    expect(pickNewerRuleSet(older, newer).customRules[0].id).toBe('new');
    expect(pickNewerRuleSet(newer, older).customRules[0].id).toBe('new');
  });
});

describe('mergeLocalRuleSetSources', () => {
  it('디스크보다 메모리에 최신 savedAt이 있으면 메모리를 살린다', () => {
    const disk = [
      set('a', {
        name: '1111',
        savedAt: '2026-06-22T00:00:00.000Z',
        customRules: [{ id: 'disk' }],
      }),
    ];
    const memory = [
      set('a', {
        name: '1111',
        savedAt: '2026-06-24T00:00:00.000Z',
        customRules: [{ id: 'memory' }],
      }),
    ];
    const merged = mergeLocalRuleSetSources(disk, memory);
    expect(merged).toHaveLength(1);
    expect(merged[0].savedAt).toBe('2026-06-24T00:00:00.000Z');
    expect(merged[0].customRules[0].id).toBe('memory');
  });
});

describe('mergeRuleSetsOnLogin', () => {
  it('클라우드가 비어 있으면 로컬을 그대로 쓴다', () => {
    const local = [set('a', { name: '내 프로젝트', savedAt: '2025-01-02T00:00:00.000Z' })];
    expect(mergeRuleSetsOnLogin(local, [])).toEqual(local);
  });

  it('로컬에만 있는 저장 프로젝트를 클라우드 초안과 합친다', () => {
    const local = [
      set('saved', {
        name: '내 프로젝트',
        savedAt: '2025-06-01T12:00:00.000Z',
      }),
    ];
    const cloud = [set('draft', { name: '' })];
    const merged = mergeRuleSetsOnLogin(local, cloud);
    expect(merged).toHaveLength(2);
    expect(merged.some((s) => s.id === 'saved' && s.savedAt)).toBe(true);
    expect(merged.some((s) => s.id === 'draft')).toBe(true);
  });

  it('같은 id면 savedAt이 더 최신인 쪽을 쓴다', () => {
    const local = [
      set('a', {
        name: '내 프로젝트',
        savedAt: '2026-06-24T00:00:00.000Z',
        customRules: [{ id: 'local' }],
      }),
    ];
    const cloud = [
      set('a', {
        name: '내 프로젝트',
        savedAt: '2026-06-22T00:00:00.000Z',
        customRules: [{ id: 'cloud' }],
      }),
    ];
    const merged = mergeRuleSetsOnLogin(local, cloud);
    expect(merged).toHaveLength(1);
    expect(merged[0].customRules[0].id).toBe('local');
    expect(merged[0].savedAt).toBe('2026-06-24T00:00:00.000Z');
  });

  it('클라우드 savedAt이 더 최신이면 클라우드를 쓴다', () => {
    const local = [
      set('a', {
        name: '내 프로젝트',
        savedAt: '2026-06-22T00:00:00.000Z',
        customRules: [{ id: 'local' }],
      }),
    ];
    const cloud = [
      set('a', {
        name: '내 프로젝트',
        savedAt: '2026-06-24T00:00:00.000Z',
        customRules: [{ id: 'cloud' }],
      }),
    ];
    const merged = mergeRuleSetsOnLogin(local, cloud);
    expect(merged[0].customRules[0].id).toBe('cloud');
  });

  it('로컬 초안은 클라oud 규칙으로 갱신된다', () => {
    const local = [set('a', { builtInEnabled: { foo: false } })];
    const cloud = [set('a', { builtInEnabled: { foo: true } })];
    const merged = mergeRuleSetsOnLogin(local, cloud);
    expect(merged[0].builtInEnabled).toEqual({ foo: true });
  });
});

describe('dedupeSavedRuleSetsByName', () => {
  it('같은 이름의 옛 프로젝트 id는 제거한다', () => {
    const sets = [
      set('old', {
        name: '1111',
        savedAt: '2026-06-22T00:00:00.000Z',
      }),
      set('new', {
        name: '1111',
        savedAt: '2026-06-24T00:00:00.000Z',
      }),
      set('draft', { name: '' }),
    ];
    const next = dedupeSavedRuleSetsByName(sets);
    expect(next.map((s) => s.id)).toEqual(['new', 'draft']);
  });
});

describe('applyCriteriaPresetQuota', () => {
  it('비관리자 — 저장 프리셋은 최신 1개만 남긴다', () => {
    const sets = [
      set('old', {
        name: 'A',
        savedAt: '2026-06-22T00:00:00.000Z',
      }),
      set('new', {
        name: 'B',
        savedAt: '2026-06-23T00:00:00.000Z',
      }),
      set('draft', { name: '' }),
    ];
    const next = applyCriteriaPresetQuota(sets, 'user', '');
    expect(next.map((s) => s.id)).toEqual(['new', 'draft']);
  });
});
