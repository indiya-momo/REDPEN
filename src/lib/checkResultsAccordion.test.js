import { describe, expect, it } from 'vitest';
import {
  countGroupsWithVisibleFindings,
  defaultOpenConsistencyCategory,
  defaultOpenSpellingCategory,
  partitionConsistencyResultEntries,
  partitionSpellingResultEntries,
  sumVisibleFindings,
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

describe('partitionConsistencyResultEntries', () => {
  const unifyRules = [
    {
      find: '세계경제',
      replace: '세계˅경제',
      enabled: true,
      patternKind: 'compound-find',
      tailWord: '세계경제',
      consistencyUnifyEntry: true,
    },
  ];

  it('patternKind·unify로 나눈다', () => {
    const entries = [
      {
        source: 'consistency',
        group: {
          label: '세계경제',
          patternKind: 'compound-find',
          tailWord: '세계경제',
          instances: [1],
        },
      },
      {
        source: 'consistency',
        group: {
          label: '붉은표시',
          patternKind: 'compound-find',
          tailWord: '붉은표시',
          instances: [1],
        },
      },
      {
        source: 'consistency',
        group: {
          label: '@정부',
          patternKind: 'phrase-slot-find',
          instances: [1],
        },
      },
      {
        source: 'consistency',
        group: {
          label: '본+가다',
          patternKind: 'auxiliary-verb',
          instances: [1],
        },
      },
      {
        source: 'spelling',
        group: { category: 'caution', instances: [1] },
      },
    ];
    const parts = partitionConsistencyResultEntries(entries, unifyRules);
    expect(parts.unify).toHaveLength(1);
    expect(parts.literal).toHaveLength(1);
    expect(parts.common).toHaveLength(1);
    expect(parts.auxiliary).toHaveLength(1);
  });
});

describe('defaultOpenConsistencyCategory', () => {
  it('여러 항목 찾기를 우선 펼친다', () => {
    expect(
      defaultOpenConsistencyCategory({
        literal: [{}],
        unify: [{}],
        common: [],
        auxiliary: [],
      }),
    ).toBe('literal');
  });

  it('없으면 다음 칸', () => {
    expect(
      defaultOpenConsistencyCategory({
        literal: [],
        unify: [],
        common: [{}],
        auxiliary: [{}],
      }),
    ).toBe('common');
  });
});

describe('sumVisibleFindings / countGroupsWithVisibleFindings', () => {
  const entries = [
    {
      source: 'spelling',
      group: { label: 'a', instances: [1, 2, 3] },
    },
    {
      source: 'spelling',
      group: { label: 'b', instances: [1, 2] },
    },
  ];

  it('visibleInstanceCount 없으면 전체 합', () => {
    expect(sumVisibleFindings(entries)).toBe(5);
    expect(countGroupsWithVisibleFindings(entries)).toBe(2);
  });

  it('표시 건수에 맞춰 합·기준 수를 줄인다', () => {
    const visibleInstanceCount = (_source, group) =>
      group.label === 'a' ? 0 : 2;
    expect(sumVisibleFindings(entries, visibleInstanceCount)).toBe(2);
    expect(
      countGroupsWithVisibleFindings(entries, visibleInstanceCount),
    ).toBe(1);
  });
});
