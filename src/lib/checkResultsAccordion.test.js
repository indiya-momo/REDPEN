import { describe, expect, it } from 'vitest';
import {
  defaultOpenSpellingCategory,
  partitionSpellingResultEntries,
} from './checkResultsAccordion.js';

describe('partitionSpellingResultEntries', () => {
  it('category별로 나눈다', () => {
    const entries = [
      { source: 'spelling', group: { category: 'caution', label: 'a' } },
      { source: 'spelling', group: { category: 'spelling', label: 'b' } },
      { source: 'spelling', group: { category: 'loanword', label: 'c' } },
      { source: 'consistency', group: { category: 'literal', label: 'd' } },
    ];
    const parts = partitionSpellingResultEntries(entries);
    expect(parts.caution).toHaveLength(1);
    expect(parts.builtin).toHaveLength(1);
    expect(parts.loanword).toHaveLength(1);
  });

  it('category 없는 spelling은 builtin으로', () => {
    const parts = partitionSpellingResultEntries([
      { source: 'spelling', group: { label: 'x' } },
    ]);
    expect(parts.builtin).toHaveLength(1);
  });
});

describe('defaultOpenSpellingCategory', () => {
  it('편집자 검토를 우선 펼친다', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [{}],
        builtin: [{}],
        loanword: [],
      }),
    ).toBe('caution');
  });

  it('편집자 없으면 맞춤법', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [],
        builtin: [{}],
        loanword: [{}],
      }),
    ).toBe('builtin');
  });
});
