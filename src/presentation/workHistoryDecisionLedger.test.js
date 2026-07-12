import { describe, expect, it } from 'vitest';
import { buildWorkHistoryDecisionLedger } from './workHistoryDecisionLedger.js';

describe('buildWorkHistoryDecisionLedger', () => {
  it('최신 우선·find/unify/commonString 표시', () => {
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
        at: '2026-07-11T12:30:00.000Z',
        query: '찾기',
      },
      {
        id: 'slot',
        kind: 'commonString',
        at: '2026-07-09T08:00:00.000Z',
        pattern: '@시대',
      },
    ]);
    expect(items.map((row) => row.id)).toEqual(['find', 'new', 'slot', 'old']);
    expect(items[0]).toMatchObject({ kind: 'find', query: '찾기' });
    expect(items[0].atLabel).toMatch(/7월/);
    expect(items[0].atLabel).toMatch(/\d{2}:\d{2}/);
    expect(items[1]).toMatchObject({ kind: 'unify', pinned: '다', variants: ['라'] });
    expect(items[2]).toMatchObject({ kind: 'commonString', pattern: '@시대' });
  });
});
