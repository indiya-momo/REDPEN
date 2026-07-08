import { describe, expect, it } from 'vitest';
import {
  appendWorkHistoryEntry,
  buildDisplayWorkHistory,
  mergeWorkHistories,
  normalizeWorkHistory,
  selectRecentWorkSessions,
  SESSION_COALESCE_MS,
} from './projectWorkHistory.js';

describe('normalizeWorkHistory', () => {
  it('손상 항목을 걸러내고 시각순으로 정렬한다', () => {
    const out = normalizeWorkHistory([
      { at: '2026-07-05T10:00:00.000Z', spelling: 12 },
      { date: 'bad-date', spelling: 1 },
      { date: '2026-07-01', consistency: 54.9 },
      null,
      { date: '2026-07-03' },
    ]);
    expect(out).toEqual([
      { at: '2026-07-01T12:00:00.000Z', consistency: 54 },
      { at: '2026-07-05T10:00:00.000Z', spelling: 12 },
    ]);
  });

  it('legacy date는 같은 날짜를 탭별 병합해 1세션으로 승격한다', () => {
    const out = normalizeWorkHistory([
      { date: '2026-07-05', spelling: 12, consistency: 5 },
      { date: '2026-07-05', spelling: 8 },
    ]);
    expect(out).toEqual([
      { at: '2026-07-05T12:00:00.000Z', spelling: 8, consistency: 5 },
    ]);
  });

  it('유효 항목이 없으면 undefined', () => {
    expect(normalizeWorkHistory(undefined)).toBeUndefined();
    expect(normalizeWorkHistory([])).toBeUndefined();
    expect(normalizeWorkHistory([{ date: '2026-07-05' }])).toBeUndefined();
  });
});

describe('appendWorkHistoryEntry', () => {
  it('검수 1건을 at 키로 기입한다', () => {
    const out = appendWorkHistoryEntry(
      [{ at: '2026-07-01T09:00:00.000Z', spelling: 20 }],
      {
        editorReview: 2,
        spelling: 12,
        consistencyFind: 38,
        consistencyUnify: 12,
        consistencyCommonString: 4,
        bonBojo: 9,
      },
      '2026-07-05T09:00:00.000Z',
    );
    expect(out).toHaveLength(2);
    expect(out?.[1]).toEqual({
      at: '2026-07-05T09:00:00.000Z',
      editorReview: 2,
      spelling: 12,
      consistencyFind: 38,
      consistencyUnify: 12,
      consistencyCommonString: 4,
      bonBojo: 9,
    });
  });

  it('90초 이내 재기록은 마지막 세션을 갱신한다', () => {
    const first = appendWorkHistoryEntry(
      [],
      { spelling: 12 },
      '2026-07-05T09:00:00.000Z',
    );
    const out = appendWorkHistoryEntry(
      first,
      { spelling: 8, consistency: 3 },
      new Date(Date.parse('2026-07-05T09:00:00.000Z') + SESSION_COALESCE_MS - 1).toISOString(),
    );
    expect(out).toHaveLength(1);
    expect(out?.[0].spelling).toBe(8);
    expect(out?.[0].consistency).toBe(3);
  });

  it('90초 넘게 간격이면 별도 세션으로 쌓인다', () => {
    const first = appendWorkHistoryEntry(
      [],
      { spelling: 12 },
      '2026-07-05T09:00:00.000Z',
    );
    const out = appendWorkHistoryEntry(
      first,
      { spelling: 8 },
      new Date(Date.parse('2026-07-05T09:00:00.000Z') + SESSION_COALESCE_MS + 1).toISOString(),
    );
    expect(out).toHaveLength(2);
  });

  it('건수가 없으면 기존 이력을 정리만 한다', () => {
    const out = appendWorkHistoryEntry(
      [{ at: '2026-07-01T09:00:00.000Z', spelling: 20 }],
      {},
      '2026-07-05T09:00:00.000Z',
    );
    expect(out).toEqual([{ at: '2026-07-01T09:00:00.000Z', spelling: 20 }]);
  });
});

describe('mergeWorkHistories', () => {
  it('시각 합집합 — 같은 at은 primary가 우선한다', () => {
    const out = mergeWorkHistories(
      [{ at: '2026-07-05T10:00:00.000Z', spelling: 8 }],
      [
        { at: '2026-07-01T09:00:00.000Z', spelling: 20 },
        { at: '2026-07-05T10:00:00.000Z', spelling: 99, consistency: 7 },
      ],
    );
    expect(out).toEqual([
      { at: '2026-07-01T09:00:00.000Z', spelling: 20 },
      { at: '2026-07-05T10:00:00.000Z', spelling: 8, consistency: 7 },
    ]);
  });
});

describe('selectRecentWorkSessions', () => {
  it('최근 3세션만 반환한다', () => {
    const history = [
      { at: '2026-07-01T09:00:00.000Z', spelling: 1 },
      { at: '2026-07-02T09:00:00.000Z', spelling: 2 },
      { at: '2026-07-03T09:00:00.000Z', spelling: 3 },
      { at: '2026-07-04T09:00:00.000Z', spelling: 4 },
    ];
    expect(selectRecentWorkSessions(history)).toEqual([
      { at: '2026-07-02T09:00:00.000Z', spelling: 2 },
      { at: '2026-07-03T09:00:00.000Z', spelling: 3 },
      { at: '2026-07-04T09:00:00.000Z', spelling: 4 },
    ]);
  });
});

describe('buildDisplayWorkHistory', () => {
  it('이력이 없으면 마지막 스냅샷 1점으로 대신한다', () => {
    const out = buildDisplayWorkHistory(undefined, {
      lastWorkedAt: '2026-07-05T09:00:00.000Z',
      lastSpellingFindingCount: 408,
      lastConsistencyFindingCount: 54,
      lastBonBojoFindingCount: 9,
    });
    expect(out).toHaveLength(1);
    expect(out?.[0].spelling).toBe(408);
    expect(out?.[0].consistency).toBe(54);
    expect(out?.[0].bonBojo).toBe(9);
  });

  it('이력이 있으면 최근 3세션만 쓴다', () => {
    const history = [
      { at: '2026-07-01T09:00:00.000Z', spelling: 20 },
      { at: '2026-07-02T09:00:00.000Z', spelling: 21 },
      { at: '2026-07-03T09:00:00.000Z', spelling: 22 },
      { at: '2026-07-04T09:00:00.000Z', spelling: 23 },
    ];
    expect(buildDisplayWorkHistory(history, undefined)).toEqual([
      { at: '2026-07-02T09:00:00.000Z', spelling: 21 },
      { at: '2026-07-03T09:00:00.000Z', spelling: 22 },
      { at: '2026-07-04T09:00:00.000Z', spelling: 23 },
    ]);
  });
});
