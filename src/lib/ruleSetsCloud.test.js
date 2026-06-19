import { describe, expect, it } from 'vitest';
import { resolveCloudActiveSetId } from './ruleSetsCloud.js';

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
