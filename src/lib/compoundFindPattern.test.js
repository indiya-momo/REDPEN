import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { matchAll, matches } from '../test/matchText.js';

describe('compoundFindPattern', () => {
  it('붙임 문자열은 등록 형태 그대로만 매칭', () => {
    const [rule] = buildCompoundFindRules('조선시대');
    expect(rule.find).toBeTruthy();
    expect(matches(rule, '조선시대입니다')).toBe(true);
    expect(matches(rule, '조선 시대입니다')).toBe(false);
  });

  it('띄어쓴 형태는 등록한 공백 패턴만 매칭', () => {
    const [rule] = buildCompoundFindRules('조선 시대');
    expect(matches(rule, '고려 시대와 조선 시대')).toBe(true);
    expect(matches(rule, '조선시대')).toBe(false);
  });
});
