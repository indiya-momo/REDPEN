import { describe, expect, it } from 'vitest';
import { mergeConsistencyZeroFindGroups } from './checkResultUtils.js';

describe('mergeConsistencyZeroFindGroups', () => {
  it('adds empty groups for enabled compound-find and phrase-slot rules', () => {
    const rules = [
      {
        enabled: true,
        find: '(?<=^|[^\\p{L}\\p{N}])경제',
        replace: '$0',
        pattern: 'regex',
        patternKind: 'compound-find',
        tailWord: '경제',
        label: '경제',
      },
      {
        enabled: true,
        find: '(?<=^|[^\\p{L}\\p{N}])@시대',
        replace: '$0',
        pattern: 'regex',
        patternKind: 'phrase-slot-find',
        tailWord: '@시대',
        label: '@시대',
      },
      {
        enabled: true,
        find: 'verb',
        replace: '$0',
        pattern: 'regex',
        patternKind: 'auxiliary-verb',
        tailWord: '하다',
      },
    ];

    const merged = mergeConsistencyZeroFindGroups([], rules);
    expect(merged).toHaveLength(2);
    expect(merged.every((g) => g.instances.length === 0)).toBe(true);
    expect(merged.map((g) => g.label).sort()).toEqual(['@시대', '경제']);
  });

  it('does not duplicate groups that already have matches', () => {
    const rules = [
      {
        enabled: true,
        find: 'F1',
        replace: '$0',
        pattern: 'regex',
        patternKind: 'compound-find',
        tailWord: '경제',
        label: '경제',
      },
    ];
    const existing = [
      {
        find: 'F1',
        replace: '$0',
        label: '경제',
        category: 'consistency',
        instances: [
          {
            find: 'F1',
            replace: '$0',
            matchedText: '경제',
            suggestedText: '경제',
            pageNum: 2,
            index: 10,
          },
        ],
      },
    ];

    const merged = mergeConsistencyZeroFindGroups(existing, rules);
    expect(merged).toHaveLength(1);
    expect(merged[0].instances).toHaveLength(1);
  });
});
