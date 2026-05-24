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

  it('해보 — 붙임(해보+어미)과 띄움(*해+보+어미)', () => {
    const rules = buildAuxiliaryVerbFindRules('해보');
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.some((r) => matches(r, '해보세요'))).toBe(true);
    expect(rules.some((r) => matches(r, '상상해 보아요'))).toBe(true);
    expect(rules.some((r) => matches(r, '먹어 보자'))).toBe(false);
    expect(rules.some((r) => matches(r, '상상해보아요'))).toBe(false);
  });
});
