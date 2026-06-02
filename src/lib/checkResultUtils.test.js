import { describe, expect, it } from 'vitest';
import { mergeConsistencyZeroFindGroups } from './checkResultUtils.js';
import { ruleDisplayLabel } from './regexFromFind.js';

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
    expect(merged.map((g) => g.label)).toEqual(['경제', '@시대']);
  });

  it('본용언+보조용언은 사용자 등록 일관성 찾기 뒤에 정렬', () => {
    const auxRule = {
      enabled: true,
      find: 'F-aux',
      replace: '$0',
      pattern: 'regex',
      patternKind: 'auxiliary-verb',
      tailWord: '켜 본',
      label: '(아/어) + 보다',
    };
    const literalRule = {
      enabled: true,
      find: 'F-lit',
      replace: '$0',
      pattern: 'regex',
      patternKind: 'compound-find',
      tailWord: '붉은 표시',
      label: '붉은 표시',
    };
    const merged = mergeConsistencyZeroFindGroups([], [auxRule, literalRule]);
    expect(merged.map((g) => g.label)).toEqual([ruleDisplayLabel(literalRule)]);
  });

  it('페이지 번호와 무관하게 일관성 찾기가 본조보다 앞에 온다', () => {
    const literalRule = {
      enabled: true,
      find: 'F-lit',
      replace: '$0',
      pattern: 'regex',
      patternKind: 'compound-find',
      tailWord: '붉은 표시',
      label: '붉은 표시',
    };
    const auxRule = {
      enabled: true,
      find: 'F-aux',
      replace: '$0',
      pattern: 'regex',
      patternKind: 'auxiliary-verb',
      tailWord: '켜 본',
      label: '(아/어) + 보다',
    };
    const existing = [
      {
        find: 'F-aux',
        replace: '$0',
        label: ruleDisplayLabel(auxRule),
        category: 'consistency',
        patternKind: 'auxiliary-verb',
        instances: [
          {
            find: 'F-aux',
            replace: '$0',
            matchedText: '켜 본',
            suggestedText: '켜 본',
            pageNum: 1,
            index: 0,
          },
        ],
      },
      {
        find: 'F-lit',
        replace: '$0',
        label: ruleDisplayLabel(literalRule),
        category: 'consistency',
        patternKind: 'compound-find',
        instances: [
          {
            find: 'F-lit',
            replace: '$0',
            matchedText: '붉은 표시',
            suggestedText: '붉은 표시',
            pageNum: 99,
            index: 0,
          },
        ],
      },
    ];
    const merged = mergeConsistencyZeroFindGroups(existing, [literalRule, auxRule]);
    expect(merged.map((g) => g.patternKind)).toEqual([
      'compound-find',
      'auxiliary-verb',
    ]);
  });

  it('본용언+보조용언은 발견이 있을 때만 결과에 포함', () => {
    const auxRule = {
      enabled: true,
      find: 'F-aux',
      replace: '$0',
      pattern: 'regex',
      patternKind: 'auxiliary-verb',
      tailWord: '켜 본',
      label: '(아/어) + 보다',
    };
    const existing = [
      {
        find: 'F-aux',
        replace: '$0',
        label: ruleDisplayLabel(auxRule),
        category: 'consistency',
        patternKind: 'auxiliary-verb',
        instances: [
          {
            find: 'F-aux',
            replace: '$0',
            matchedText: '켜 본',
            suggestedText: '켜 본',
            pageNum: 3,
            index: 0,
          },
        ],
      },
    ];
    const merged = mergeConsistencyZeroFindGroups(existing, [auxRule]);
    expect(merged).toHaveLength(1);
    expect(merged[0].instances).toHaveLength(1);
  });

  it('등록(활성 규칙) 순서를 유지한다 — 0건·발견 혼합', () => {
    const rules = [
      {
        enabled: true,
        find: 'F-a',
        replace: '$0',
        pattern: 'regex',
        patternKind: 'compound-find',
        tailWord: '붉은 표시',
        label: '붉은 표시',
      },
      {
        enabled: true,
        find: 'F-b',
        replace: '$0',
        pattern: 'regex',
        patternKind: 'compound-find',
        tailWord: '붉은표시',
        label: '붉은표시',
      },
    ];
    const existing = [
      {
        find: 'F-b',
        replace: '$0',
        label: '붉은표시',
        category: 'consistency',
        instances: [
          {
            find: 'F-b',
            replace: '$0',
            matchedText: '붉은표시',
            suggestedText: '붉은표시',
            pageNum: 9,
            index: 1,
          },
        ],
      },
    ];
    const merged = mergeConsistencyZeroFindGroups(existing, rules);
    expect(merged.map((g) => g.label)).toEqual([
      ruleDisplayLabel(rules[0]),
      ruleDisplayLabel(rules[1]),
    ]);
    expect(merged[0].instances).toHaveLength(0);
    expect(merged[1].instances).toHaveLength(1);
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
