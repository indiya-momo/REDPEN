import { describe, expect, it } from 'vitest';
import {
  buildSparklinePath,
  hasSpellingSplitHistory,
  latestConsistencyFindings,
  sparklinePoints,
} from './workHistorySparkline.js';

describe('workHistorySparkline', () => {
  it('2세션 sparkline path를 만든다', () => {
    const path = buildSparklinePath([10, 20], 168, 56);
    expect(path).toContain('L');
    const points = sparklinePoints([10, 20], 168, 56);
    expect(points).toHaveLength(2);
    // 0 기준: 20이 10보다 위에 있다
    expect(points[1].y).toBeLessThan(points[0].y);
    // x는 양 끝
    expect(points[0].x).toBe(0);
    expect(points[1].x).toBe(168);
  });

  it('동일 값이어도 0 기준으로 아래에 붙지 않는다', () => {
    const points = sparklinePoints([50, 50], 168, 56);
    expect(points[0].y).toBe(points[1].y);
    expect(points[0].y).toBeLessThan(56 / 2);
  });

  it('맞춤법 분리 이력 여부를 판별한다', () => {
    expect(
      hasSpellingSplitHistory([{ at: '2026-07-01T09:00:00.000Z', spelling: 10 }]),
    ).toBe(false);
    expect(
      hasSpellingSplitHistory([
        { at: '2026-07-01T09:00:00.000Z', editorReview: 2, spelling: 10 },
      ]),
    ).toBe(true);
  });

  it('최근 표기 통일 종류별 건수를 읽는다', () => {
    expect(
      latestConsistencyFindings({
        at: '2026-07-05T09:00:00.000Z',
        consistencyFind: 38,
        consistencyUnify: 12,
        consistencyCommonString: 4,
      }),
    ).toEqual({ find: 38, unify: 12, commonString: 4 });
    expect(
      latestConsistencyFindings({
        at: '2026-07-05T09:00:00.000Z',
        consistency: 54,
      }),
    ).toEqual({ find: 54, unify: 0, commonString: 0 });
  });
});
