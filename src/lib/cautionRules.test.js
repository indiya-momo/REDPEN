import { describe, expect, it } from 'vitest';
import { cautionFindPattern, normalizeMatchMode } from './cautionRules.js';
import { runRuleCheck } from './ruleEngine.js';

function matches(pattern, text) {
  return new RegExp(pattern, 'gu').test(text);
}

describe('cautionFindPattern', () => {
  it('attached-before: 붙임만 (오른정도), 띄어 쓴 정도는 제외', () => {
    const find = cautionFindPattern('정도', 'attached-before');
    expect(matches(find, '오른정도')).toBe(true);
    expect(matches(find, '오른 정도')).toBe(false);
  });

  it('spaced-before: 붙여야 하는데 띄어 씀 (앞말 2글자+)', () => {
    const find = cautionFindPattern('만', 'spaced-before');
    expect(matches(find, '그때 만')).toBe(true);
    expect(matches(find, '그때만')).toBe(false);
  });

  it('any-before: 붙임·띄움 모두 잡음', () => {
    const find = cautionFindPattern('정도', 'any-before');
    expect(matches(find, '오른정도')).toBe(true);
    expect(matches(find, '오른 정도')).toBe(true);
  });
});

describe('normalizeMatchMode (시트 별칭)', () => {
  it('ap-any / ap-space / ap-attach / spaced-stem', () => {
    expect(normalizeMatchMode('ap-any')).toBe('any-before');
    expect(normalizeMatchMode('ap-space')).toBe('spaced-before');
    expect(normalizeMatchMode('ap-attach')).toBe('attached-before');
    expect(normalizeMatchMode('spaced-stem')).toBe('spaced-stem');
  });

  it('space-stem은 spaced-stem, space 단독은 ap-space', () => {
    expect(normalizeMatchMode('space-stem')).toBe('spaced-stem');
    expect(normalizeMatchMode('space')).toBe('spaced-before');
  });
});

describe('caution except → excludePhrases', () => {
  it('except 목록과 통째 같으면 하이라이트 제외', () => {
    const find = cautionFindPattern('정도', 'attached-before');
    const rules = [
      {
        find,
        replace: '(검토)',
        enabled: true,
        pattern: 'regex',
        excludePhrases: ['여름정도'],
      },
    ];
    const pages = [{ pageNum: 1, text: '오른정도 여름정도 입니다.' }];
    const { results, errors } = runRuleCheck(pages, rules);
    expect(errors).toEqual([]);
    const texts = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(texts).toContain('오른정도');
    expect(texts).not.toContain('여름정도');
  });
});
