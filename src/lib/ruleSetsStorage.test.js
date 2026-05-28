import { describe, expect, it } from 'vitest';
import {
  duplicateRuleSet,
  formatRuleSetSavedDate,
  formatRuleSetSummary,
} from './ruleSetsStorage.js';

describe('formatRuleSetSavedDate', () => {
  it('저장일을 짧은 한국어 날짜로 표시한다', () => {
    expect(formatRuleSetSavedDate('2023-06-18T12:00:00.000Z')).toMatch(
      /^23년 6월 18일$/,
    );
  });
});

describe('formatRuleSetSummary', () => {
  it('저장일과 규칙 건수를 한 줄로 만든다', () => {
    expect(
      formatRuleSetSummary({
        savedAt: '2023-06-18T12:00:00.000Z',
        builtInRuleCount: 10,
        spacingRuleCount: 3,
        consistencyRuleCount: 4,
      }),
    ).toBe(
      '23년 6월 18일 맞춤법 확인 10 · 규칙 제외 0 · 편집자 검토 3 · 일관성 4',
    );
  });

  it('저장 전에는 건수만 표시한다', () => {
    expect(
      formatRuleSetSummary({
        builtInRuleCount: 2,
        spacingRuleCount: 1,
        consistencyRuleCount: 0,
      }),
    ).toBe('맞춤법 확인 2 · 규칙 제외 0 · 편집자 검토 1 · 일관성 0');
  });
});

describe('duplicateRuleSet', () => {
  it('새 id와 복사 이름, 규칙 스냅샷을 만든다', () => {
    const source = {
      id: 'set_a',
      name: '경제서',
      builtInEnabled: { foo: true },
      customRules: [{ find: 'RED PEN', replace: '' }],
      globalExcludePhrases: ['테스트'],
      cautionEnabled: { c1: true },
    };
    const copy = duplicateRuleSet(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('경제서 (복사)');
    expect(copy.builtInEnabled).toBeUndefined();
    expect(copy.customRules).toEqual(source.customRules);
    expect(copy.customRules).not.toBe(source.customRules);
    expect(copy.globalExcludePhrases).toEqual(['테스트']);
    expect(copy.globalExcludePhrases).not.toBe(source.globalExcludePhrases);
  });
});
