import { describe, expect, it } from 'vitest';
import {
  buildConsistencyResultSummaryStats,
  buildSpellingResultSummaryStats,
  formatCategoryFindingCount,
  formatConsistencyResultsSummaryLine,
  formatResultsStatCount,
  formatSpellingResultsSummaryLine,
} from './checkResultSummaryFormat.js';

describe('checkResultSummaryFormat', () => {
  it('formatCategoryFindingCount', () => {
    expect(formatCategoryFindingCount(2)).toBe('(2건)');
    expect(formatCategoryFindingCount(0)).toBe('(0건)');
  });

  it('formatResultsStatCount', () => {
    expect(formatResultsStatCount(2)).toBe('2건');
    expect(formatResultsStatCount(0)).toBe('0건');
  });

  it('formatSpellingResultsSummaryLine', () => {
    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 12,
        builtinWithFindings: 2,
        totalFindings: 246,
      }),
    ).toBe('편집자 검토 12건, 맞춤법 2건 전체 발견 246');
  });

  it('formatSpellingResultsSummaryLine — 검수에 넣은 항목만, 0건도 표시', () => {
    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 0,
        builtinWithFindings: 2,
        totalFindings: 5,
        cautionSelected: true,
        builtinSelected: true,
      }),
    ).toBe('편집자 검토 0건, 맞춤법 2건 전체 발견 5');

    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 0,
        builtinWithFindings: 2,
        totalFindings: 5,
        cautionSelected: false,
        builtinSelected: true,
      }),
    ).toBe('맞춤법 2건 전체 발견 5');
  });

  it('formatConsistencyResultsSummaryLine', () => {
    expect(
      formatConsistencyResultsSummaryLine({
        literalWithFindings: 2,
        unifyWithFindings: 1,
        commonStringWithFindings: 0,
        auxiliaryWithFindings: 9,
        totalFindings: 67,
      }),
    ).toBe(
      '여러 개 찾기 2건, 통일형 찾기 1건, 공통 문자열 찾기 0건, 본+보 9건 전체 발견 67',
    );
  });

  it('buildSpellingResultSummaryStats', () => {
    expect(
      buildSpellingResultSummaryStats({
        cautionWithFindings: 0,
        builtinWithFindings: 3,
        cautionSelected: true,
        builtinSelected: false,
      }),
    ).toEqual([{ badge: '편집자 검토', count: 0, tone: 'spelling-caution' }]);
  });

  it('buildConsistencyResultSummaryStats', () => {
    expect(
      buildConsistencyResultSummaryStats({
        literalWithFindings: 1,
        unifyWithFindings: 0,
        commonStringWithFindings: 0,
        auxiliaryWithFindings: 2,
        literalSelected: true,
        unifySelected: false,
        commonStringSelected: false,
        auxiliarySelected: true,
      }),
    ).toEqual([
      { badge: '여러 개 찾기', count: 1, tone: 'consistency-literal' },
      { badge: '본+보', count: 2, tone: 'auxiliary' },
    ]);
  });
});
