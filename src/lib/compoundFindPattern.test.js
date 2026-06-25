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

  it('띄어쓴·붙임은 runRuleCheck에서도 분리 — 미국 정부 ≠ 미국정부', () => {
    const spaced = buildCompoundFindRules('미국 정부').map((r) => ({
      ...r,
      enabled: true,
    }));
    const glued = buildCompoundFindRules('미국정부').map((r) => ({
      ...r,
      enabled: true,
    }));
    const page = {
      pageNum: 1,
      text: '세계경제와 미국 정부, 미국정부 정책.\n',
      items: [],
      itemRefs: [],
    };
    const spacedHits = runRuleCheck([page], spaced).results.flatMap((g) =>
      g.instances.map((i) => i.matchedText),
    );
    const gluedHits = runRuleCheck([page], glued).results.flatMap((g) =>
      g.instances.map((i) => i.matchedText),
    );
    expect(spacedHits).toEqual(['미국 정부']);
    expect(gluedHits).toEqual(['미국정부']);
  });

  it('문자열 찾기 — ZWSP(보이는 줄바꿈 없음)도 매칭', () => {
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

  it('모모 산문 — 등록 횟수만큼만 집계 (4배 중복 없음)', () => {
    const text = `어느 겨울밤, 너무 많은 붉은 표시를 견디지 못한 사람이 있었습니다.
세상은 그것을 교정이라 부르며 익숙해져야 한다고 말했어요.
하지만 그 사람은 누군가문장을 살펴 주길 소망했어요.
그래서 마르지않은 붉은 잉크로 소환식을 열었어요.
어느 겨울 밤, 회색 털끝에 잉크를 묻힌 고양이가 나타났어요.
사람들은 그 고양이를 '모모'라고 부르게 되었답니다.
모모는 문장을 바꾸는 대신 붉은 표시만 남겼어요.
원고가 끝나면 "모모"는 새벽안개처럼 사라졌어요.
늦은 밤이면 고요한 방에서 작고 붉은 마법진이 빛나요.
오늘도 모모는 늦은밤, 원고에 이야기를 담아 두어요.
새벽 안개 속으로 사라지기 전까지\n`;
    const page = { pageNum: 1, text, items: [], itemRefs: [] };
    const expectCount = (entry, n) => {
      const rules = buildCompoundFindRules(entry).map((r) => ({
        ...r,
        enabled: true,
      }));
      const count = runRuleCheck([page], rules).results.reduce(
        (s, g) => s + g.instances.length,
        0,
      );
      expect(count, entry).toBe(n);
    };
    expectCount('붉은 표시', 2);
    expectCount('붉은표시', 0);
    expectCount('모모', 4);
    expectCount('새벽안개', 1);
    expectCount('새벽 안개', 1);
    expectCount('늦은 밤', 1);
    expectCount('늦은밤', 1);
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
