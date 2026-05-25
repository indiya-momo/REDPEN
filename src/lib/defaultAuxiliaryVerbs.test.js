import { describe, expect, it } from 'vitest';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { listAuxiliaryVerbEntries } from './auxiliaryVerbRegister.js';

describe('ensureDefaultAuxiliaryVerbs', () => {
  it('빈 규칙에 보·주·해보 등 기본 보조용언 항목을 추가한다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const tails = listAuxiliaryVerbEntries(rules).map((e) => e.tailWord);
    expect(tails).toContain('보');
    expect(tails).toContain('주');
    expect(tails).toContain('해보');
    expect(tails).toContain('해 보');
  });

  it('이미 등록된 tailWord는 중복 추가하지 않는다', () => {
    const once = ensureDefaultAuxiliaryVerbs([]);
    const twice = ensureDefaultAuxiliaryVerbs(once);
    expect(listAuxiliaryVerbEntries(twice).length).toBe(
      listAuxiliaryVerbEntries(once).length,
    );
  });
});
