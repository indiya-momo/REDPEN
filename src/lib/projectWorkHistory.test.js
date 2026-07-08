import { describe, expect, it } from 'vitest';
import {
  appendWorkHistoryEntry,
  buildDisplayWorkHistory,
  mergeWorkHistories,
  normalizeWorkHistory,
} from './projectWorkHistory.js';

describe('normalizeWorkHistory', () => {
  it('손상 항목을 걸러내고 날짜순으로 정렬한다', () => {
    const out = normalizeWorkHistory([
      { date: '2026-07-05', spelling: 12 },
      { date: 'bad-date', spelling: 1 },
      { date: '2026-07-01', consistency: 54.9 },
      null,
      { date: '2026-07-03' },
    ]);
    expect(out).toEqual([
      { date: '2026-07-01', consistency: 54 },
      { date: '2026-07-05', spelling: 12 },
    ]);
  });

  it('같은 날짜는 뒤의 값이 탭별로 덮어쓴다', () => {
    const out = normalizeWorkHistory([
      { date: '2026-07-05', spelling: 12, consistency: 5 },
      { date: '2026-07-05', spelling: 8 },
    ]);
    expect(out).toEqual([{ date: '2026-07-05', spelling: 8, consistency: 5 }]);
  });

  it('유효 항목이 없으면 undefined', () => {
    expect(normalizeWorkHistory(undefined)).toBeUndefined();
    expect(normalizeWorkHistory([])).toBeUndefined();
    expect(normalizeWorkHistory([{ date: '2026-07-05' }])).toBeUndefined();
  });
});

describe('appendWorkHistoryEntry', () => {
  it('검수 1건을 날짜 키로 기입한다', () => {
    const out = appendWorkHistoryEntry(
      [{ date: '2026-07-01', spelling: 20 }],
      { spelling: 12, consistency: 5 },
      '2026-07-05T09:00:00.000Z',
    );
    expect(out).toHaveLength(2);
    expect(out?.[1].spelling).toBe(12);
    expect(out?.[1].consistency).toBe(5);
  });

  it('건수가 없으면 기존 이력을 정리만 한다', () => {
    const out = appendWorkHistoryEntry(
      [{ date: '2026-07-01', spelling: 20 }],
      {},
      '2026-07-05T09:00:00.000Z',
    );
    expect(out).toEqual([{ date: '2026-07-01', spelling: 20 }]);
  });
});

describe('mergeWorkHistories', () => {
  it('날짜 합집합 — 같은 날짜는 primary가 우선한다', () => {
    const out = mergeWorkHistories(
      [{ date: '2026-07-05', spelling: 8 }],
      [
        { date: '2026-07-01', spelling: 20 },
        { date: '2026-07-05', spelling: 99, consistency: 7 },
      ],
    );
    expect(out).toEqual([
      { date: '2026-07-01', spelling: 20 },
      { date: '2026-07-05', spelling: 8, consistency: 7 },
    ]);
  });
});

describe('buildDisplayWorkHistory', () => {
  it('이력이 없으면 마지막 스냅샷 1점으로 대신한다', () => {
    const out = buildDisplayWorkHistory(undefined, {
      lastWorkedAt: '2026-07-05T09:00:00.000Z',
      lastSpellingFindingCount: 408,
      lastConsistencyFindingCount: 54,
    });
    expect(out).toHaveLength(1);
    expect(out?.[0].spelling).toBe(408);
    expect(out?.[0].consistency).toBe(54);
  });

  it('이력이 있으면 이력을 그대로 쓴다', () => {
    const history = [{ date: '2026-07-01', spelling: 20 }];
    expect(buildDisplayWorkHistory(history, undefined)).toEqual(history);
  });
});
