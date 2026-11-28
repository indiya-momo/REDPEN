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
    expect(parts.manual).toHaveLength(0);
  });

  it('manuscript-search 카테고리는 검색 칸', () => {
    const parts = partitionSpellingResultEntries([
      { source: 'spelling', group: { category: 'manuscript-search', label: '토끼' } },
    ]);
    expect(parts.search).toHaveLength(1);
    expect(parts.builtin).toHaveLength(0);
  });

  it('manual 카테고리는 수정 추가 칸', () => {
    const parts = partitionSpellingResultEntries([
      { source: 'spelling', group: { category: 'manual', label: '직접' } },
    ]);
    expect(parts.manual).toHaveLength(1);
    expect(parts.builtin).toHaveLength(0);
  });

  it('category 없는 spelling은 builtin으로', () => {
    const parts = partitionSpellingResultEntries([
      { source: 'spelling', group: { label: 'x' } },
    ]);
    expect(parts.builtin).toHaveLength(1);
  });

  it('spacing:* 는 띄어쓰기 칸에만 넣는다', () => {
    const parts = partitionSpellingResultEntries([
      {
        source: 'spelling',
        group: { category: 'spacing:numberUnit', label: '수사' },
      },
    ]);
    expect(parts.spacing).toHaveLength(1);
    expect(parts.builtin).toHaveLength(0);
    expect(parts.caution).toHaveLength(0);
    expect(parts.loanword).toHaveLength(0);
  });
});

describe('defaultOpenSpellingCategory', () => {
  it('띄어쓰기만 있으면 띄어쓰기 칸을 펼친다', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [],
        builtin: [],
        loanword: [],
        spacing: [{}],
      }),
    ).toBe('spacing');
  });

  it('검색이 있으면 그 칸을 우선 펼친다', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [{}],
        builtin: [{}],
        loanword: [],
        manual: [{}],
        search: [{}],
      }),
    ).toBe('search');
  });

  it('수정 추가가 있으면 그 칸을 우선 펼친다', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [{}],
        builtin: [{}],
        loanword: [],
        manual: [{}],
      }),
    ).toBe('manual');
  });

  it('수정 추가 없으면 편집자 검토를 펼친다', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [{}],
        builtin: [{}],
        loanword: [],
        manual: [],
      }),
    ).toBe('caution');
  });

  it('편집자 없으면 맞춤법', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [],
        builtin: [{}],
        loanword: [{}],
        manual: [],
      }),
    ).toBe('builtin');
  });

  it('수정 추가만 있으면 그 칸을 연다', () => {
    expect(
      defaultOpenSpellingCategory({
        caution: [],
        builtin: [],
        loanword: [],
        manual: [{}],
      }),
    ).toBe('manual');
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
  it('표기 통일하기를 우선 펼친다', () => {
    expect(
      defaultOpenConsistencyCategory({
        literal: [{}],
        unify: [{}],
        common: [],
        auxiliary: [],
      }),
    ).toBe('unify');
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
