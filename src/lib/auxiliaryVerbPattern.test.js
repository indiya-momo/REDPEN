import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { matches } from '../test/matchText.js';

describe('auxiliaryVerbPattern', () => {
  it('단독 보 — 앞말+공백+보+어미', () => {
    const rules = buildAuxiliaryVerbFindRules('보');
    expect(rules.length).toBeGreaterThan(0);
    const rule = rules[0];
    expect(matches(rule, '뚱해 보이는 고양이')).toBe(true);
    expect(matches(rule, '뚱해보이는')).toBe(false);
  });

  it('켜 본 — stem 그대로, 앞말 없음·있음 (bon-bojo)', () => {
    const rules = buildAuxiliaryVerbFindRules('켜 본');
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    expect(matches(rule, '켜 본')).toBe(true);
    expect(matches(rule, '지켜 본')).toBe(true);
    expect(matches(rule, '지켜 본다')).toBe(true);
    expect(matches(rule, '스위치를 켜 본다')).toBe(true);
    expect(matches(rule, '책장에서 지켜 본')).toBe(true);
    expect(matches(rule, '켜본')).toBe(false);
    expect(matches(rule, '책장에서 지켜')).toBe(false);
  });

  it('해 지 — stem (에서 지켜 오탐 없음)', () => {
    const rules = buildAuxiliaryVerbFindRules('해 지');
    expect(rules.some((r) => matches(r, '먹어 지다'))).toBe(false);
    expect(rules.some((r) => matches(r, '뚱해 지다'))).toBe(true);
    expect(rules.some((r) => matches(r, '책장에서 지켜 본'))).toBe(false);
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
    expect(matches(rule, '상상해 왔다')).toBe(true);
    expect(matches(rule, '상상해\n왔다')).toBe(true);
    expect(matches(rule, '해왔')).toBe(false);
  });

  it('해보 — 붙임(해보+어미)과 띄움(*해+보+어미)', () => {
    const rules = buildAuxiliaryVerbFindRules('해보');
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.some((r) => matches(r, '해보세요'))).toBe(true);
    expect(rules.some((r) => matches(r, '상상해 보아요'))).toBe(true);
    expect(rules.some((r) => matches(r, '먹어 보자'))).toBe(false);
    expect(rules.some((r) => matches(r, '상상해보아요'))).toBe(false);
  });
});
