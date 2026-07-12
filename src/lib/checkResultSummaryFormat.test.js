import { describe, expect, it } from 'vitest';
import {
  buildConsistencyResultSummaryStats,
  buildSpellingResultSummaryStats,
  formatCategoryFindingCount,
  formatConsistencyExcelSummaryLine,
  formatConsistencyResultsSummaryLine,
  formatResultsStatCount,
  formatSpellingExcelSummaryLine,
  formatSpellingResultsSummaryLine,
} from './checkResultSummaryFormat.js';

describe('checkResultSummaryFormat', () => {
  it('formatCategoryFindingCount', () => {
    expect(formatCategoryFindingCount(2)).toBe('(2기준)');
    expect(formatCategoryFindingCount(0)).toBe('(0기준)');
  });

  it('formatResultsStatCount', () => {
    expect(formatResultsStatCount(2)).toBe('2기준');
    expect(formatResultsStatCount(0)).toBe('0기준');
  });

  it('formatSpellingResultsSummaryLine', () => {
    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 12,
        builtinWithFindings: 2,
        totalFindings: 246,
      }),
    ).toBe('편집자 검토 필요 12기준, 맞춤법 규칙 2기준 전체 발견 246');
  });

  it('formatSpellingResultsSummaryLine — 검수에 넣은 항목만, 0기준도 표시', () => {
    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 0,
        builtinWithFindings: 2,
        totalFindings: 5,
        cautionSelected: true,
        builtinSelected: true,
      }),
    ).toBe('편집자 검토 필요 0기준, 맞춤법 규칙 2기준 전체 발견 5');

    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 0,
        builtinWithFindings: 2,
        totalFindings: 5,
        cautionSelected: false,
        builtinSelected: true,
      }),
    ).toBe('맞춤법 규칙 2기준 전체 발견 5');
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
      '여러 개 찾기 2기준, 통일형 만들기 1기준, 공통 문자열 찾기 0기준, 본용언+보조용언 9기준 전체 발견 67',
    );
  });

  it('buildSpellingResultSummaryStats', () => {
    expect(
      buildSpellingResultSummaryStats({
        cautionWithFindings: 0,
        builtinWithFindings: 3,
        editorReviewFindings: 0,
        spellingFindings: 12,
        cautionSelected: true,
        builtinSelected: false,
      }),
    ).toEqual([
      {
        badge: '편집자 검토 필요',
        count: 0,
        findingsCount: 0,
        tone: 'spelling-caution',
      },
    ]);
  });

  it('buildConsistencyResultSummaryStats', () => {
    expect(
      buildConsistencyResultSummaryStats({
        literalWithFindings: 1,
        unifyWithFindings: 0,
        commonStringWithFindings: 0,
        auxiliaryWithFindings: 2,
        literalFindings: 4,
        unifyFindings: 0,
        commonStringFindings: 0,
        auxiliaryFindings: 9,
        literalSelected: true,
        unifySelected: false,
        commonStringSelected: false,
        auxiliarySelected: true,
      }),
    ).toEqual([
      {
        badge: '여러 개 찾기',
        count: 1,
        findingsCount: 4,
        tone: 'consistency-literal',
      },
      { badge: '본용언+보조용언', count: 2, findingsCount: 9, tone: 'auxiliary' },
    ]);
  });

  it('formatSpellingExcelSummaryLine', () => {
    expect(
      formatSpellingExcelSummaryLine({
        cautionCriteriaCount: 21,
        cautionFindingsCount: 100,
        builtinCriteriaCount: 5,
        builtinFindingsCount: 308,
        totalFindings: 408,
      }),
    ).toBe(
      '편집자 검토 필요 21기준 100발견 · 맞춤법 규칙 5기준 308발견 · 전체 발견 408',
    );
  });

  it('formatConsistencyExcelSummaryLine', () => {
    expect(
      formatConsistencyExcelSummaryLine({
        literalCriteriaCount: 1,
        literalFindingsCount: 4,
        unifyCriteriaCount: 2,
        unifyFindingsCount: 0,
        commonStringCriteriaCount: 1,
        commonStringFindingsCount: 3,
        auxiliaryCriteriaCount: 9,
        auxiliaryFindingsCount: 12,
        totalFindings: 19,
      }),
    ).toBe(
      '여러 개 찾기 1기준 4발견 · 통일형 만들기 2기준 0발견 · 공통 문자열 찾기 1기준 3발견 · 본용언+보조용언 9기준 12발견 · 전체 발견 19',
    );
  });
});
