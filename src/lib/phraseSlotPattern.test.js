import { describe, expect, it } from 'vitest';
import { buildPhraseSlotFindRules, isPhraseSlotPattern } from './phraseSlotPattern.js';
import { matches } from '../test/matchText.js';

describe('phraseSlotPattern', () => {
  it('@시대는 붙임만, 띄어쓴 조선 시대는 제외', () => {
    expect(isPhraseSlotPattern('@시대')).toBe(true);
    const [rule] = buildPhraseSlotFindRules('@시대');
    expect(matches(rule, '조선시대와 고려시대')).toBe(true);
    expect(matches(rule, '조선 시대와')).toBe(false);
  });

  it('@˅시대는 패턴에 공백이 있을 때만 띄어쓴 형태 매칭', () => {
    const [rule] = buildPhraseSlotFindRules('@ 시대');
    expect(matches(rule, '조선 시대')).toBe(true);
    expect(matches(rule, '조선시대')).toBe(false);
  });
});
