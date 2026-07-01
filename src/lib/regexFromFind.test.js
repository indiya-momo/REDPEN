import { describe, expect, it } from 'vitest';
import { compileRuleRegex } from './regexFromFind.js';
import { matches } from '../test/matchText.js';

describe('compileRuleRegex', () => {
  it('find에 띄어쓰기 없음 — 붙여 쓴 형태만 (PDF 줄바꿈은 허용)', () => {
    const rule = { find: '전세계', replace: '전 세계', enabled: true };
    expect(matches(rule, '전세계')).toBe(true);
    expect(matches(rule, '전\n세계')).toBe(true);
    expect(matches(rule, '전 세계')).toBe(false);
  });

  it('find에 띄어쓰기 있음 — 띄어 쓴 형태만', () => {
    const rule = { find: '먹고 사', replace: '먹고사', enabled: true };
    expect(matches(rule, '먹고 사')).toBe(true);
    expect(matches(rule, '먹고사')).toBe(false);
    expect(matches(rule, '먹 고 사')).toBe(true);
  });

  it('matches syllables split by line breaks in extracted text', () => {
    const rule = { find: '빼곱', replace: '빼 곱', enabled: true };
    expect(matches(rule, '빼\n곱')).toBe(true);
    expect(matches(rule, '빼 곱')).toBe(false);
    expect(matches(rule, '빼곱')).toBe(true);
  });

  it('keeps regex rules unchanged', () => {
    const rule = { find: '조선\\s+시대', replace: '$0', enabled: true, pattern: 'regex' };
    const re = compileRuleRegex(rule);
    expect(re?.test('조선시대')).toBe(false);
    expect(re?.test('조선 시대')).toBe(true);
  });

  it('find에 괄호·한자 — 이스케이프가 글자 단위로 유지된다', () => {
    for (const find of ['육월(六月)', '희노애락(喜怒哀樂)']) {
      expect(compileRuleRegex({ find, replace: 'x', enabled: true })).not.toBeNull();
    }
    expect(matches({ find: '육월(六月)', replace: '유월', enabled: true }, '육월(六月)')).toBe(
      true,
    );
    expect(
      matches({ find: '희노애락(喜怒哀樂)', replace: '희로애락', enabled: true }, '희노애락(喜怒哀樂)'),
    ).toBe(true);
  });
});
