import { describe, expect, it } from 'vitest';
import { mergePrimaryConflictsIntoSecondaryGroups } from './unifyPatternRule.js';

describe('mergePrimaryConflictsIntoSecondaryGroups', () => {
  it('패턴 find에 없어도 1차 분위기 경제를 @경제에 넣는다', () => {
    const groups = [
      {
        type: 'series',
        affixType: 'suffix',
        affix: '경제',
        label: '@경제',
        template: '@경제',
        direction: 'glued',
        clusters: [
          {
            key: '고전파경제',
            variants: ['고전파경제', '고전파 경제'],
            counts: { '고전파 경제': 2, 고전파경제: 0 },
            totalCount: 2,
            kind: 'conflict',
          },
        ],
      },
    ];
    const primary = [
      {
        key: '분위기경제',
        variants: ['분위기경제', '분위기 경제'],
        counts: { '분위기 경제': 10, 분위기경제: 0 },
        totalCount: 10,
        kind: 'conflict',
      },
    ];
    const out = mergePrimaryConflictsIntoSecondaryGroups(groups, primary);
    const keys = out[0].clusters.map((c) => c.key);
    expect(keys).toContain('분위기경제');
    expect(keys).toContain('고전파경제');
  });
});
