import { describe, expect, it } from 'vitest';
import { buildProjectCardViewModelFromRuleSet } from './ruleSetProjectCard.js';

function makeSet(overrides = {}) {
  return {
    id: 'set_test',
    name: '1111',
    builtInEnabled: {},
    cautionEnabled: {},
    customRules: [],
    globalExcludePhrases: [],
    savedAt: '2026-06-22T12:00:00',
    ...overrides,
  };
}

describe('buildProjectCardViewModelFromRuleSet', () => {
  it('로컬 RuleSet을 Library 카드 ViewModel로 변환한다', () => {
    const card = buildProjectCardViewModelFromRuleSet(
      makeSet({
        customRules: [
          {
            patternKind: 'compound-find',
            tailWord: '그러나',
            enabled: true,
            consistencyLiteralEntry: true,
          },
          {
            patternKind: 'phrase-slot-find',
            tailWord: '@시대',
            enabled: true,
          },
        ],
        globalExcludePhrases: ['소녀시대'],
      }),
      { isActive: true },
    );

    expect(card.title).toBe('1111');
    expect(card.isActive).toBe(true);
    expect(card.savedDate).toBe('26년 6월 22일');
    expect(card.counts.find).toBe(1);
    expect(card.counts.commonString).toBe(1);
    expect(card.chipPreview.consistency).toEqual(
      expect.arrayContaining([
        { label: '그러나', active: true },
        { label: '@시대', active: true },
      ]),
    );
    expect(card.headline).toContain('일관성 2건');
    expect(card.headline).toContain('검수 제외 1개');
  });

  it('활성 항목이 없으면 기본 headline을 쓴다', () => {
    const card = buildProjectCardViewModelFromRuleSet(makeSet());
    expect(card.headline).toBe('맞춤법·표기 통일 기준을 설정하세요');
    expect(card.counts.find).toBe(0);
  });

  it('tags·projectContext를 ViewModel에 매핑한다', () => {
    const card = buildProjectCardViewModelFromRuleSet(
      makeSet({
        tags: [' 문학 ', '문학', '시리즈 1/3'],
        memo: '테스트 메모',
        projectContext: {
          pdfPageCount: 88,
          lastWorkedAt: '2026-06-23T09:00:00.000Z',
          proofRevision: '3교',
          formatLabel: '신국판',
        },
      }),
    );

    expect(card.tags).toEqual(['문학', '시리즈 1/3']);
    expect(card.memo).toBe('테스트 메모');
    expect(card.lastWork).toEqual({
      date: '26.06.23',
      manuscriptPages: 88,
    });
    expect(card.createdDate).toBe('26.06.22');
    expect(card.proofRevision).toBe('3교');
    expect(card.formatLabel).toBe('신국판');
  });
});
