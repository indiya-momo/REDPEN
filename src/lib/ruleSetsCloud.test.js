import { describe, expect, it } from 'vitest';
import {
  resolveCloudActiveSetId,
  resolveHydratedActiveSetId,
} from './ruleSetsCloud.js';

describe('resolveCloudActiveSetId', () => {
  const sets = [{ id: 'a' }, { id: 'b' }];

  it('저장된 activeSetId가 목록에 있으면 그대로', () => {
    expect(resolveCloudActiveSetId('b', sets)).toBe('b');
  });

  it('없거나 비어 있으면 첫 세트', () => {
    expect(resolveCloudActiveSetId('missing', sets)).toBe('a');
    expect(resolveCloudActiveSetId(null, sets)).toBe('a');
  });

  it('목록이 비어 있으면 null', () => {
    expect(resolveCloudActiveSetId('a', [])).toBeNull();
  });
});

describe('resolveHydratedActiveSetId', () => {
  const sets = [
    { id: 'draft', name: '', savedAt: undefined },
    {
      id: 'saved',
      name: '내 프로젝트',
      savedAt: '2025-06-01T12:00:00.000Z',
    },
  ];

  it('localStorage 활성이 저장 프로젝트면 클라우드 초안보다 우선', () => {
    expect(resolveHydratedActiveSetId(sets, 'saved', 'draft')).toBe('saved');
  });

  it('클라우드만 초안을 가리키면 최근 저장 프로젝트로 복귀', () => {
    expect(resolveHydratedActiveSetId(sets, 'draft', 'draft')).toBe('saved');
  });
});
