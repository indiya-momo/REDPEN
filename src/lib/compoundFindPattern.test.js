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

  it('붙임 — 앞뒤에 글자가 붙어도 부분 문자열로 잡음', () => {
    const [rule] = buildCompoundFindRules('붉은표시');
    expect(rule.requireLeadingBoundary).toBe(false);
    expect(matches(rule, '「붉은표시」를')).toBe(true);
    expect(matches(rule, '다.붉은표시')).toBe(true);
    const gluedRules = buildCompoundFindRules('붉은표시');
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: '되는붉은표시와 「붉은표시」\n', items: [], itemRefs: [] }],
      gluedRules,
    );
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toEqual(['붉은표시', '붉은표시']);
  });

  it('늦은밤 — 꽤늦은밤·늦은밤에 안에서도 잡음', () => {
    const rules = buildCompoundFindRules('늦은밤').map((r) => ({
      ...r,
      enabled: true,
    }));
    const hits = runRuleCheck(
      [{ pageNum: 1, text: '꽤늦은밤 늦은밤에 산책.\n', items: [], itemRefs: [] }],
      rules,
    ).results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toEqual(['늦은밤', '늦은밤']);
  });

  it('아 두 — 담아 두어요 안에서도 잡음', () => {
    const rules = buildCompoundFindRules('아 두').map((r) => ({
      ...r,
      enabled: true,
    }));
    const hits = runRuleCheck(
      [{ pageNum: 1, text: '원고에 담아 두어요.\n', items: [], itemRefs: [] }],
      rules,
    ).results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toContain('아 두');
  });

  it('문자열 찾기(loose) — ZWSP(보이는 줄바꿈 없음)도 매칭', () => {
    const rules = buildCompoundFindRules('담아 두어요').map((r) => ({
      ...r,
      enabled: true,
    }));
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: '원고에 담아\u200B두어요.\n', items: [], itemRefs: [] }],
      rules,
    );
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toContain('담아\u200B두어요');
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
