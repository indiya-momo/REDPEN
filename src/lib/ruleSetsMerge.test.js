import { describe, expect, it } from 'vitest';
import {
  applyCriteriaPresetQuota,
  dedupeSavedRuleSetsByName,
  mergeLocalRuleSetSources,
  mergeRuleSetsOnLogin,
  mergeRuleSetsOnPersist,
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

  it('savedAt이 더 최신이어도 비어 있는 태그는 다른 쪽에서 보존한다', () => {
    const older = set('a', {
      savedAt: '2026-06-20T00:00:00.000Z',
      tags: ['문학'],
    });
    const newer = set('a', {
      savedAt: '2026-06-24T00:00:00.000Z',
      customRules: [{ id: 'new' }],
    });
    expect(pickNewerRuleSet(older, newer).tags).toEqual(['문학']);
    expect(pickNewerRuleSet(older, newer).customRules[0].id).toBe('new');
  });

  it('metaUpdatedAt이 더 최신이면 빈 태그도 그대로 적용한다', () => {
    const withTags = set('a', {
      savedAt: '2026-06-20T00:00:00.000Z',
      tags: ['문학'],
      metaUpdatedAt: '2026-06-21T00:00:00.000Z',
    });
    const cleared = set('a', {
      savedAt: '2026-06-24T00:00:00.000Z',
      tags: [],
      metaUpdatedAt: '2026-06-25T00:00:00.000Z',
    });
    expect(pickNewerRuleSet(withTags, cleared).tags).toEqual([]);
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

  it('savedAt 동률이면 메모리 편집을 살린다', () => {
    const disk = [
      set('a', {
        name: '1111',
        savedAt: '2026-06-22T00:00:00.000Z',
        customRules: [{ id: 'disk' }],
        builtInEnabled: { foo: true },
      }),
    ];
    const memory = [
      set('a', {
        name: '1111',
        savedAt: '2026-06-22T00:00:00.000Z',
        customRules: [{ id: 'memory' }],
        builtInEnabled: { foo: false },
      }),
    ];
    const merged = mergeLocalRuleSetSources(disk, memory);
    expect(merged[0].customRules[0].id).toBe('memory');
    expect(merged[0].builtInEnabled).toEqual({ foo: false });
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

describe('mergeRuleSetsOnPersist', () => {
  it('디스크에만 있는 태그를 같은 savedAt 메모리에 보존한다', () => {
    const savedAt = '2026-06-20T00:00:00.000Z';
    const disk = [
      set('a', { name: 'A', savedAt, tags: ['문학'] }),
      set('b', { name: 'B', savedAt }),
    ];
    const memory = [
      set('a', { name: 'A', savedAt }),
      set('b', { name: 'B', savedAt }),
    ];
    const merged = mergeRuleSetsOnPersist(disk, memory);
    expect(merged.find((row) => row.id === 'a')?.tags).toEqual(['문학']);
  });

  it('다른 창에서 삭제한 저장 프로젝트를 메모리 autosave가 되살리지 않는다', () => {
    const savedAt = '2026-06-20T00:00:00.000Z';
    const disk = [set('a', { name: 'A', savedAt, tags: ['문학'] })];
    const memory = [
      set('a', { name: 'A', savedAt }),
      set('b', { name: 'B', savedAt }),
    ];
    const merged = mergeRuleSetsOnPersist(disk, memory);
    expect(merged.map((row) => row.id)).toEqual(['a']);
    expect(merged[0].tags).toEqual(['문학']);
  });

  it('savedAt 동률이면 메모리 customRules를 유지한다', () => {
    const savedAt = '2026-06-20T00:00:00.000Z';
    const disk = [
      set('a', {
        name: 'A',
        savedAt,
        customRules: [{ id: 'disk' }],
      }),
    ];
    const memory = [
      set('a', {
        name: 'A',
        savedAt,
        customRules: [{ id: 'memory' }],
      }),
    ];
    const merged = mergeRuleSetsOnPersist(disk, memory);
    expect(merged[0].customRules[0].id).toBe('memory');
  });

  it('메모리에만 있는 초안은 유지한다', () => {
    const disk = [set('a', { name: 'A', savedAt: '2026-06-20T00:00:00.000Z' })];
    const memory = [set('a', { name: 'A' }), set('draft', { name: '' })];
    const merged = mergeRuleSetsOnPersist(disk, memory);
    expect(merged.map((row) => row.id).sort()).toEqual(['a', 'draft']);
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
