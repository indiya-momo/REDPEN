import { describe, expect, it } from 'vitest';
import { normalizeRuleSet } from './ruleSetNormalize.js';

describe('normalizeRuleSet project meta', () => {
  it('tags·memo·projectContext를 정규화한다', () => {
    const normalized = normalizeRuleSet({
      id: 'set_1',
      name: '테스트',
      builtInEnabled: {},
      cautionEnabled: {},
      customRules: [],
      tags: [' 문학 ', '문학', '시리즈 1/2'],
      memo: '  메모  ',
      projectContext: {
        pdfFileName: ' 원고.pdf ',
        pdfPageCount: 10,
        lastWorkedAt: '2026-06-22T12:00:00.000Z',
      },
    });

    expect(normalized.tags).toEqual(['문학', '시리즈 1/2']);
    expect(normalized.memo).toBe('메모');
    expect(normalized.projectContext).toEqual({
      pdfFileName: '원고.pdf',
      pdfPageCount: 10,
      lastWorkedAt: '2026-06-22T12:00:00.000Z',
      pdfLinked: true,
    });
  });
});
