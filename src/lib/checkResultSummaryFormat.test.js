import { describe, expect, it } from 'vitest';
import {
  formatCategoryFindingCount,
  formatConsistencyResultsSummaryLine,
  formatSpellingResultsSummaryLine,
  formatTotalFindingsToken,
} from './checkResultSummaryFormat.js';

describe('checkResultSummaryFormat', () => {
  it('formatCategoryFindingCount', () => {
    expect(formatCategoryFindingCount(2)).toBe('(2건)');
    expect(formatCategoryFindingCount(0)).toBe('(0건)');
  });

  it('formatSpellingResultsSummaryLine', () => {
    expect(
      formatSpellingResultsSummaryLine({
        cautionWithFindings: 12,
        builtinWithFindings: 2,
        totalFindings: 246,
      }),
    ).toBe(
      '편집자 검토 필요(12건), 맞춤법 규칙(2건) 전체 발견 [246]',
    );
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
      '일관성 찾기(2건), 통일형 찾기(1건), 공통 문자열 찾기(0건)\n' +
        '본용언(-아/어) + 보조용언 표기(9건) 전체 발견 [67]',
    );
  });

  it('formatTotalFindingsToken', () => {
    expect(formatTotalFindingsToken(120)).toBe('[120]');
  });
});
