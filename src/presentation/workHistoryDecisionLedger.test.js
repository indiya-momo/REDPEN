import { describe, expect, it } from 'vitest';
import { buildWorkHistoryDecisionLedger } from './workHistoryDecisionLedger.js';

describe('buildWorkHistoryDecisionLedger', () => {
  it('최신 우선·unify만 표시', () => {
    const items = buildWorkHistoryDecisionLedger([
      {
        id: 'old',
        kind: 'unify',
        at: '2026-07-01T00:00:00.000Z',
        pinned: '가',
        variants: ['나'],
      },
      {
        id: 'new',
        kind: 'unify',
        at: '2026-07-10T00:00:00.000Z',
        pinned: '다',
        variants: ['라'],
      },
      {
        id: 'find',
        kind: 'find',
        at: '2026-07-11T00:00:00.000Z',
        query: '찾기',
      },
    ]);
    expect(items.map((row) => row.id)).toEqual(['new', 'old']);
    expect(items[0].pinned).toBe('다');
    expect(items[0].variants).toEqual(['라']);
    expect(items[0].atLabel).toContain('7월');
  });
});
