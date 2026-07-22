import { describe, it, expect } from 'vitest';
import {
  LOANWORD_CATEGORY,
  LOANWORD_FEATURE_LABEL,
  isLoanwordSpellingRule,
} from './loanwordCheckRules.js';
import {
  BUILT_IN_QUOTA_RULES,
  LOANWORD_QUOTA_RULES,
  SPELLING_QUOTA_RULES,
} from './builtInRules.js';

describe('외래어 표기법 규칙 분류', () => {
  it('묶음 이름이 자주 틀리는 외래어 표기법이면 loanword로 분류한다', () => {
    expect(
      isLoanwordSpellingRule({
        dividerLabel: '자주 틀리는 외래어 표기법(영어)',
      }),
    ).toBe(true);
    expect(
      isLoanwordSpellingRule({
        dividerLabel: '자주 틀리는 외래어 표기법(그 외)',
      }),
    ).toBe(true);
    expect(
      isLoanwordSpellingRule({ dividerLabel: '표준국어대사전 등재(명사)' }),
    ).toBe(false);
    expect(isLoanwordSpellingRule({})).toBe(false);
  });

  it('구 묶음 이름 외래어 표기법도 호환한다', () => {
    expect(
      isLoanwordSpellingRule({ dividerLabel: '외래어 표기법(영어)' }),
    ).toBe(true);
    expect(
      isLoanwordSpellingRule({ dividerLabel: '외래어 표기법(그 외)' }),
    ).toBe(true);
  });

  it('구분 라벨·카테고리 상수', () => {
    expect(LOANWORD_FEATURE_LABEL).toBe('외래어 표기법');
    expect(LOANWORD_CATEGORY).toBe('loanword');
  });
});

describe('내장 규칙 분리 목록', () => {
  it('외래어 규칙과 맞춤법 규칙을 나눠도 합은 전체와 같다', () => {
    expect(LOANWORD_QUOTA_RULES.length).toBeGreaterThan(0);
    expect(
      LOANWORD_QUOTA_RULES.length + SPELLING_QUOTA_RULES.length,
    ).toBe(BUILT_IN_QUOTA_RULES.length);
  });

  it('외래어 목록에는 외래어 묶음만 들어간다', () => {
    expect(LOANWORD_QUOTA_RULES.every(isLoanwordSpellingRule)).toBe(true);
    expect(SPELLING_QUOTA_RULES.some(isLoanwordSpellingRule)).toBe(false);
  });
});
