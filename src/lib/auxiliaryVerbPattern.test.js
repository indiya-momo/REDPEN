import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { matches, matchesRegex } from '../test/matchText.js';

describe('auxiliaryVerbPattern', () => {
  it('단독 보 — 앞말+공백+보+어미', () => {
    const rules = buildAuxiliaryVerbFindRules('보');
    expect(rules.length).toBeGreaterThan(0);
    const rule = rules[0];
    expect(matches(rule, '뚱해 보이는 고양이')).toBe(true);
    expect(matches(rule, '뚱해보이는')).toBe(false);
  });

  it('켜 본 — 띄움만(지켜 본)', () => {
    const rules = buildAuxiliaryVerbFindRules('켜 본');
    expect(rules).toHaveLength(1);
    expect(matches(rules[0], '지켜 본')).toBe(true);
    expect(matches(rules[0], '지켜본')).toBe(false);
  });

  it('해 지 — stem (에서 지켜 오탐 없음)', () => {
    const rules = buildAuxiliaryVerbFindRules('해 지');
    expect(rules.some((r) => matches(r, '먹어 지다'))).toBe(false);
    expect(rules.some((r) => matchesRegex(r, '상상해 지다'))).toBe(true);
    expect(rules.some((r) => matches(r, '책장에서 지켜 본'))).toBe(false);
  });

  it('어 주·어 지 — 주택·지급 명사 오탐 없음', () => {
    const ju = buildAuxiliaryVerbFindRules('어 주')[0];
    const ji = buildAuxiliaryVerbFindRules('어 지')[0];
    expect(matches(ju, '묶어 주택담보증권')).toBe(false);
    expect(matches(ju, '먹어 주고')).toBe(true);
    expect(matches(ju, '알려 주다')).toBe(false);
    expect(matches(ji, '내어 지급하는')).toBe(false);
    expect(matches(ji, '늦어 지는')).toBe(true);
    expect(matches(ji, '먹어 지다')).toBe(true);
  });

  it('해 보·해 가 — 통해+명사(관형어) 오탐 없음', () => {
    const bo = buildAuxiliaryVerbFindRules('해 보')[0];
    const ga = buildAuxiliaryVerbFindRules('해 가')[0];
    expect(matches(bo, '통해 보장받을')).toBe(false);
    expect(matches(bo, '대해 보상받기를')).toBe(false);
    expect(matches(ga, '통해 가치를')).toBe(false);
    expect(matchesRegex(bo, '상상해 보자')).toBe(true);
    expect(matches(ga, '먹어 가')).toBe(false);
    expect(matches(ga, '상상해 가')).toBe(false);
  });

  it('어 내 — 붙임(만들어내) 오탐 없음, 띄움만', () => {
    const rules = buildAuxiliaryVerbFindRules('어 내');
    const rule = { ...rules[0], bonBojoItemId: 'verb-naeda' };
    expect(matches(rule, '만들어내는')).toBe(false);
    expect(matches(rule, '만들어내')).toBe(false);
    expect(matches(rule, '만들어 내는')).toBe(true);
    expect(matches(rule, '만들어 내')).toBe(true);
  });

  it('여 준 — 보여 준다', () => {
    const rules = buildAuxiliaryVerbFindRules('여 준');
    const rule = rules[0];
    expect(matches(rule, '보여 준다.')).toBe(true);
    expect(matches(rule, '이 책을 보여 준다고')).toBe(true);
    expect(matches(rule, '보여준다')).toBe(false);
  });

  it('여 줄 — 보여 줄·줄바꿈·얇은 공백', () => {
    const rules = buildAuxiliaryVerbFindRules('여 줄');
    const rule = rules[0];
    expect(matches(rule, '보여 줄게')).toBe(true);
    expect(matches(rule, '이걸 보여 줄')).toBe(true);
    expect(matches(rule, '보여\n줄게')).toBe(true);
    expect(matches(rule, '보여\u2009줄게')).toBe(true);
    expect(matches(rule, '보여줄게')).toBe(false);
  });

  it('해 왔 — 줄바꿈 허용', () => {
    const rules = buildAuxiliaryVerbFindRules('해 왔');
    const rule = rules[0];
    expect(matchesRegex(rule, '상상해 왔다')).toBe(true);
    expect(matchesRegex(rule, '상상해\n왔다')).toBe(true);
    expect(matches(rule, '상상해 왔다')).toBe(false);
    expect(matchesRegex(rule, '해왔')).toBe(false);
  });

  it('아 하 — 띄움만, 아하루 등 일반어 오탐 없음', () => {
    const rules = buildAuxiliaryVerbFindRules('아 하');
    expect(rules).toHaveLength(1);
    expect(matches(rules[0], '아하루')).toBe(false);
    expect(matches(rules[0], '보라아 하다')).toBe(false);
    expect(matches(rules[0], '보라아하다')).toBe(false);
  });

  it('어 보 — 띄움만(먹어 보)', () => {
    const rules = buildAuxiliaryVerbFindRules('어 보');
    expect(rules.length).toBe(1);
    expect(matches(rules[0], '먹어 보자')).toBe(true);
    expect(matches(rules[0], '먹어보자')).toBe(false);
  });

  it('해 보 — 띄움만', () => {
    const rules = buildAuxiliaryVerbFindRules('해 보');
    expect(rules.length).toBe(1);
    expect(matchesRegex(rules[0], '상상해 보자')).toBe(true);
    expect(matches(rules[0], '상상해 보자')).toBe(false);
    expect(matchesRegex(rules[0], '상상해보자')).toBe(false);
    expect(matchesRegex(rules[0], '통해보장')).toBe(false);
  });

  it('해보 — 해 보와 동일, 띄움만', () => {
    const rules = buildAuxiliaryVerbFindRules('해보');
    expect(rules.length).toBe(1);
    expect(matchesRegex(rules[0], '상상해 보아요')).toBe(true);
    expect(matches(rules[0], '상상해 보아요')).toBe(false);
    expect(matchesRegex(rules[0], '상상해보아요')).toBe(false);
    expect(matchesRegex(rules[0], '해보세요')).toBe(false);
  });
});

