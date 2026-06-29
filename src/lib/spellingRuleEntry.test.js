import { describe, expect, it } from 'vitest';
import {
  buildSpellingCheckRuleFromBuiltIn,
  builtInEnabledKey,
  parseSpellingFindsColumn,
  spellingRuleDisplayLabel,
} from './spellingRuleEntry.js';

describe('parseSpellingFindsColumn', () => {
  it('쉼표로 구분한 이형태 2개 이상만 배열로 반환한다', () => {
    expect(parseSpellingFindsColumn('foo,bar', 'foo')).toEqual(['foo', 'bar']);
    expect(parseSpellingFindsColumn('foo', 'foo')).toBeNull();
    expect(parseSpellingFindsColumn('', 'foo')).toBeNull();
  });
});

describe('builtInEnabledKey', () => {
  it('ruleId가 있으면 ruleId를 쓴다', () => {
    expect(builtInEnabledKey({ ruleId: 'foreign-adam', find: '애덤' })).toBe(
      'foreign-adam',
    );
  });

  it('ruleId가 없으면 find를 쓴다', () => {
    expect(builtInEnabledKey({ find: '컨텐츠' })).toBe('컨텐츠');
  });
});

describe('spellingRuleDisplayLabel', () => {
  it('finds가 있으면 · 로 묶어 표시한다', () => {
    expect(
      spellingRuleDisplayLabel({
        find: '애덤',
        replace: '아담',
        finds: ['애덤', '애썸'],
      }),
    ).toBe('애덤·애썸 → 아담');
  });
});

describe('buildSpellingCheckRuleFromBuiltIn', () => {
  it('finds가 없으면 규칙을 그대로 둔다', () => {
    const rule = { find: '컨텐츠', replace: '콘텐츠', enabled: true };
    expect(buildSpellingCheckRuleFromBuiltIn(rule)).toEqual(rule);
  });

  it('finds가 있으면 regex alternation과 spellingRuleId를 넣는다', () => {
    const out = buildSpellingCheckRuleFromBuiltIn({
      find: 'ab',
      replace: 'cd',
      finds: ['ab', 'xy'],
      ruleId: 'test-pair',
      enabled: true,
    });
    expect(out.pattern).toBe('regex');
    expect(out.spellingRuleId).toBe('test-pair');
    expect(out.find.startsWith('(?:')).toBe(true);
    expect(out.find).toContain('|');
  });
});
