import { describe, expect, it } from 'vitest';
import {
  applyCriteriaPresetQuota,
  applyTombstones,
  dedupeSavedRuleSetsByName,
  mergeLocalRuleSetSources,
  mergeRuleSetsOnLogin,
  mergeRuleSetsOnPersist,
  mergeTombstones,
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

  it('둘 다 미저장 초안이면 preferOnTie에 따라 고른다 (기본: 첫 인자)', () => {
    const memory = set('draft', {
      customRules: [{ id: 'new-chip' }, { id: 'old' }],
    });
    const disk = set('draft', {
      customRules: [{ id: 'old' }],
    });
    expect(pickNewerRuleSet(memory, disk).customRules.map((r) => r.id)).toEqual([
      'new-chip',
      'old',
    ]);
    expect(
      pickNewerRuleSet(memory, disk, 'second').customRules.map((r) => r.id),
    ).toEqual(['old']);
  });
});

describe('mergeRuleSetsOnPersist — 미저장 초안', () => {
  it('미저장 초안의 메모리 customRules가 디스크보다 우선한다', () => {
    const disk = [
      set('draft', {
        name: '',
        customRules: [{ id: 'old' }],
      }),
    ];
    const memory = [
      set('draft', {
        name: '',
        customRules: [{ id: 'new-chip' }, { id: 'old' }],
      }),
    ];
    const merged = mergeRuleSetsOnPersist(disk, memory);
    expect(merged).toHaveLength(1);
    expect(merged[0].customRules.map((r) => r.id)).toEqual([
      'new-chip',
      'old',
    ]);
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

  it('이 창에서 방금 복제한 저장 프로젝트를 외부삭제로 오판해 지우지 않는다', () => {
    const savedAt = '2026-06-20T00:00:00.000Z';
    const disk = [
      set('a', { name: 'A', savedAt }),
      set('b', { name: 'B', savedAt }),
    ];
    const memory = [
      set('a', { name: 'A', savedAt }),
      set('b', { name: 'B', savedAt }),
      set('a-copy', { name: 'A(1)', savedAt }),
    ];
    const merged = mergeRuleSetsOnPersist(disk, memory, { added: ['a-copy'] });
    expect(merged.map((row) => row.id).sort()).toEqual(['a', 'a-copy', 'b']);
  });

  it('intent.added 없이 새 저장 프로젝트를 넣으면 외부삭제로 오판해 지운다', () => {
    const savedAt = '2026-06-20T00:00:00.000Z';
    const disk = [
      set('a', { name: '세계경제', savedAt }),
      set('b', { name: '편', savedAt }),
    ];
    const memory = [
      set('a', { name: '세계경제', savedAt }),
      set('b', { name: '편', savedAt }),
      set('street', { name: '스트리트 이코노미', savedAt: '2026-07-12T00:00:00.000Z' }),
    ];
    const wiped = mergeRuleSetsOnPersist(disk, memory);
    expect(wiped.map((row) => row.id).sort()).toEqual(['a', 'b']);

    const kept = mergeRuleSetsOnPersist(disk, memory, { added: ['street'] });
    expect(kept.map((row) => row.id).sort()).toEqual(['a', 'b', 'street']);
    expect(kept.find((row) => row.id === 'street')?.name).toBe(
      '스트리트 이코노미',
    );
  });

  it('이 창에서 방금 삭제한 저장 프로젝트를 디스크에서 되살리지 않는다', () => {
    const savedAt = '2026-06-20T00:00:00.000Z';
    const disk = [
      set('a', { name: 'A', savedAt }),
      set('b', { name: 'B', savedAt }),
    ];
    const memory = [set('a', { name: 'A', savedAt })];
    const merged = mergeRuleSetsOnPersist(disk, memory, { removed: ['b'] });
    expect(merged.map((row) => row.id)).toEqual(['a']);
  });
});

describe('mergeTombstones', () => {
  it('id 기준으로 합치고 같은 id는 삭제시각이 늦은 쪽을 남긴다', () => {
    const a = [{ id: 'x', deletedAt: '2026-06-20T00:00:00.000Z' }];
    const b = [
      { id: 'x', deletedAt: '2026-06-24T00:00:00.000Z' },
      { id: 'y', deletedAt: '2026-06-21T00:00:00.000Z' },
    ];
    const merged = mergeTombstones(a, b);
    expect(merged.find((t) => t.id === 'x')?.deletedAt).toBe(
      '2026-06-24T00:00:00.000Z',
    );
    expect(merged.map((t) => t.id).sort()).toEqual(['x', 'y']);
  });
});

describe('applyTombstones', () => {
  it('툼스톤에 있는 프로젝트는 클라우드에 남아 있어도 목록에서 제거한다', () => {
    const sets = [
      set('a', { name: 'A', savedAt: '2026-06-20T00:00:00.000Z' }),
      set('b', { name: 'B', savedAt: '2026-06-20T00:00:00.000Z' }),
    ];
    const tombstones = [{ id: 'b', deletedAt: '2026-06-22T00:00:00.000Z' }];
    const result = applyTombstones(sets, tombstones);
    expect(result.sets.map((s) => s.id)).toEqual(['a']);
  });

  it('삭제시각 이후 다시 저장(재생성)한 프로젝트는 유지하고 그 툼스톤은 정리한다', () => {
    const sets = [
      set('a', { name: 'A', savedAt: '2026-06-25T00:00:00.000Z' }),
    ];
    const tombstones = [{ id: 'a', deletedAt: '2026-06-22T00:00:00.000Z' }];
    const result = applyTombstones(sets, tombstones);
    expect(result.sets.map((s) => s.id)).toEqual(['a']);
    expect(result.tombstones).toEqual([]);
  });
});

describe('applyCriteriaPresetQuota', () => {
  it('유료 — 저장 프리셋은 최신 3개만 남긴다', () => {
    const sets = [
      set('old', {
        name: 'A',
        savedAt: '2026-06-20T00:00:00.000Z',
      }),
      set('mid', {
        name: 'B',
        savedAt: '2026-06-21T00:00:00.000Z',
      }),
      set('newer', {
        name: 'C',
        savedAt: '2026-06-22T00:00:00.000Z',
      }),
      set('newest', {
        name: 'D',
        savedAt: '2026-06-23T00:00:00.000Z',
      }),
      set('draft', { name: '' }),
    ];
    const next = applyCriteriaPresetQuota(sets, 'user', '', 'paid');
    expect(next.map((s) => s.id)).toEqual(['mid', 'newer', 'newest', 'draft']);
  });

  it('무료 — 저장 프리셋은 최신 1개만 남긴다', () => {
    const sets = [
      set('old', {
        name: 'A',
        savedAt: '2026-06-20T00:00:00.000Z',
      }),
      set('newest', {
        name: 'D',
        savedAt: '2026-06-23T00:00:00.000Z',
      }),
      set('draft', { name: '' }),
    ];
    const next = applyCriteriaPresetQuota(sets, 'user', '', 'free');
    expect(next.map((s) => s.id)).toEqual(['newest', 'draft']);
  });
});
