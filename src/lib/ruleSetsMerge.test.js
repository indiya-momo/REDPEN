import { describe, expect, it } from 'vitest';
import { mergeRuleSetsOnLogin } from './ruleSetsMerge.js';

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

  it('같은 id면 더 최신 savedAt을 유지한다', () => {
    const local = [
      set('a', {
        name: '프로젝트',
        savedAt: '2025-06-02T00:00:00.000Z',
        customRules: [{ id: 'local' }],
      }),
    ];
    const cloud = [
      set('a', {
        name: '프로젝트',
        savedAt: '2025-06-01T00:00:00.000Z',
        customRules: [{ id: 'cloud' }],
      }),
    ];
    const merged = mergeRuleSetsOnLogin(local, cloud);
    expect(merged).toHaveLength(1);
    expect(merged[0].customRules[0].id).toBe('local');
  });

  it('클라우드에 저장 프로젝트가 없고 로컬만 있으면 로컬 저장분을 넣는다', () => {
    const local = [
      set('local-only', {
        name: '게스트 저장',
        savedAt: '2025-05-01T00:00:00.000Z',
      }),
    ];
    const cloud = [set('cloud-draft')];
    const merged = mergeRuleSetsOnLogin(local, cloud);
    expect(merged.find((s) => s.id === 'local-only')?.name).toBe('게스트 저장');
  });
});
