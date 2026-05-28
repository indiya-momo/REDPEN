import { describe, expect, it } from 'vitest';
import { compileRuleRegex } from './regexFromFind.js';
import { matches } from '../test/matchText.js';

describe('compileRuleRegex', () => {
  it('matches syllables split by line breaks in extracted text', () => {
    const rule = { find: '빼곱', replace: '빼 곱', enabled: true };
    expect(matches(rule, '빼\n곱')).toBe(true);
    expect(matches(rule, '빼 곱')).toBe(true);
    expect(matches(rule, '빼곱')).toBe(true);
  });

  it('keeps regex rules unchanged', () => {
    const rule = { find: '조선\\s+시대', replace: '$0', enabled: true, pattern: 'regex' };
    const re = compileRuleRegex(rule);
    expect(re?.test('조선시대')).toBe(false);
    expect(re?.test('조선 시대')).toBe(true);
  });
});
