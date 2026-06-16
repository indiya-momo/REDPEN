import { describe, expect, it } from 'vitest';
import {
  CAUTION_RULES,
  cautionFindPattern,
  cautionItemTip,
  normalizeMatchMode,
} from './cautionRules.js';
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

  it('attached-before: 가지는 토큰 끝만 (물가지수 제외, 여름가지 포함)', () => {
    const find = cautionFindPattern('가지', 'attached-before');
    expect(matches(find, '여름가지')).toBe(true);
    expect(matches(find, '산가지')).toBe(true);
    expect(matches(find, '두 가지')).toBe(false);
    expect(matches(find, '물가지수')).toBe(false);
    expect(matches(find, '소비자물가지수')).toBe(false);
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

describe('cautionItemTip', () => {
  it('항목 tip이 있으면 그룹 tip보다 우선', () => {
    const group = { id: 'verb-verb', tip: '그룹 설명' };
    const item = { id: 'verb-verb-neal', tip: '늘이다/늘리다 설명' };
    expect(cautionItemTip(item, group)).toBe('늘이다/늘리다 설명');
  });

  it('항목 tip이 없으면 그룹 tip으로 대체', () => {
    const group = { id: 'g', tip: '그룹만' };
    const item = { id: 'i' };
    expect(cautionItemTip(item, group)).toBe('그룹만');
  });

  it('CAUTION_RULES는 항목별 tip을 갖는다', () => {
    const mat = CAUTION_RULES.find((r) => r.id === 'verb-verbi-mat');
    const neal = CAUTION_RULES.find((r) => r.id === 'verb-verb-neal');
    expect(mat?.tip).toContain('맞추다');
    expect(neal?.tip).toContain('늘이다');
    expect(mat?.tip).not.toBe(neal?.tip);
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
