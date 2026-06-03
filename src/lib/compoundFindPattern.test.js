import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { runRuleCheck } from './ruleEngine.js';
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

  it('붙임 — 따옴표·마침표 뒤도 잡음 (앞 공백만 요구하지 않음)', () => {
    const [rule] = buildCompoundFindRules('붉은표시');
    expect(rule.requireLeadingBoundary).toBe(true);
    expect(matches(rule, '「붉은표시」를')).toBe(true);
    expect(matches(rule, '다.붉은표시')).toBe(true);
    const gluedRules = buildCompoundFindRules('붉은표시');
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: '되는붉은표시와 「붉은표시」' }],
      gluedRules,
    );
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toEqual(['붉은표시']);
  });

  it('띄움·붙임은 서로 다른 패턴', () => {
    const [spaced] = buildCompoundFindRules('붉은 표시');
    const [glued] = buildCompoundFindRules('붉은표시');
    expect(matches(spaced, '붉은 표시')).toBe(true);
    expect(matches(spaced, '붉은표시')).toBe(false);
    expect(matches(glued, '붉은표시')).toBe(true);
    expect(matches(glued, '붉은 표시')).toBe(false);
  });
});
