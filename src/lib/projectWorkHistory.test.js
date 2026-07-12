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

  it('같은 검수 직후 중복 기입만 마지막 세션을 갱신한다', () => {
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

  it('합치기 창을 넘기면 별도 검수 세션으로 쌓인다', () => {
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
  it('기본은 최근 7세션까지 반환한다', () => {
    const history = [
      { at: '2026-07-01T09:00:00.000Z', spelling: 1 },
      { at: '2026-07-02T09:00:00.000Z', spelling: 2 },
      { at: '2026-07-03T09:00:00.000Z', spelling: 3 },
      { at: '2026-07-04T09:00:00.000Z', spelling: 4 },
    ];
    expect(selectRecentWorkSessions(history)).toEqual(history);

    const longHistory = Array.from({ length: 10 }, (_, i) => ({
      at: `2026-07-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`,
      spelling: i + 1,
    }));
    expect(selectRecentWorkSessions(longHistory)?.map((e) => e.spelling)).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});

describe('buildDisplayWorkHistory', () => {
  it('이력이 없으면 projectContext만으로 가짜 점을 만들지 않는다', () => {
    const out = buildDisplayWorkHistory(undefined, {
      lastWorkedAt: '2026-07-05T09:00:00.000Z',
      lastSpellingFindingCount: 408,
      lastConsistencyFindingCount: 54,
      lastBonBojoFindingCount: 9,
    });
    expect(out).toBeUndefined();
  });

  it('이력이 있으면 최근 세션만 쓴다', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      at: `2026-07-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`,
      spelling: 20 + i,
    }));
    const out = buildDisplayWorkHistory(history, undefined);
    expect(out).toHaveLength(7);
    expect(out?.[0].spelling).toBe(23);
    expect(out?.[6].spelling).toBe(29);
  });
});
