import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { enrichAuxiliaryGluedFromSpaced } from './auxiliaryGluedFromSpaced.js';

function gadaRule() {
  const row = buildAuxiliaryVerbFindRules('아 가')[0];
  return {
    ...row,
    enabled: true,
    bonBojoItemId: 'verb-gada',
    label: '(아/어) + 가다',
  };
}

describe('enrichAuxiliaryGluedFromSpaced', () => {
  it('같은 stem 규칙의 붙임 표면을 검사 건으로 보강한다', () => {
    const groups = [
      {
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-gada',
        label: '(아/어) + 가다',
        instances: [
          {
            find: 'f',
            replace: '$0',
            matchedText: '살아 가는',
            suggestedText: '살아 가는',
            pageNum: 1,
            index: 0,
          },
        ],
      },
    ];
    const pages = [
      { pageNum: 1, text: '살아 가는 길' },
      { pageNum: 2, text: '함께 살아가는 사람들' },
    ];
    const next = enrichAuxiliaryGluedFromSpaced(groups, pages, {
      rules: [gadaRule()],
    });
    const texts = next[0].instances.map((i) => i.matchedText);
    expect(texts).toContain('살아 가는');
    expect(texts).toContain('살아가는');
    const glued = next[0].instances.find((i) => i.matchedText === '살아가는');
    expect(glued?.pageNum).toBe(2);
    expect(glued?.suggestedText).toBe('살아가는');
  });

  it('띄움 매치가 없어도 붙임만 있으면 그룹을 만든다', () => {
    const next = enrichAuxiliaryGluedFromSpaced([], [{ pageNum: 2, text: '함께 살아가는 사람들' }], {
      rules: [gadaRule()],
    });
    expect(next).toHaveLength(1);
    expect(next[0].instances.map((i) => i.matchedText)).toEqual(['살아가는']);
  });

  it('다른 글자 안의 짧은 부분일치는 올리지 않는다', () => {
    const next = enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 2, text: '가격은 달러가 기준이다' }],
      { rules: [gadaRule()] },
    );
    expect(next).toHaveLength(0);
  });

  it('이미 가까운 index면 중복 추가하지 않는다', () => {
    const groups = [
      {
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-gada',
        instances: [
          {
            matchedText: '살아가는',
            suggestedText: '살아가는',
            pageNum: 2,
            index: 3,
          },
        ],
      },
    ];
    const pages = [{ pageNum: 2, text: '함께 살아가는 사람들' }];
    const next = enrichAuxiliaryGluedFromSpaced(groups, pages, {
      rules: [gadaRule()],
    });
    expect(next[0].instances).toHaveLength(1);
  });

  it('긴복합 분리 규칙은 붙임 보강에 쓰지 않는다', () => {
    const rule = {
      ...gadaRule(),
      auxSplitLongCompound: true,
    };
    const next = enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 1, text: '살아가는' }],
      { rules: [rule] },
    );
    expect(next).toHaveLength(0);
  });
});
