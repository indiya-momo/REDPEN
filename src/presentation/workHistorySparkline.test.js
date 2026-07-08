import { describe, expect, it } from 'vitest';
import {
  buildSparklinePath,
  hasSpellingSplitHistory,
  latestConsistencyFindings,
  sparklinePoints,
} from './workHistorySparkline.js';

describe('workHistorySparkline', () => {
  it('2세션 sparkline path를 만든다', () => {
    const path = buildSparklinePath([10, 20], 168, 32);
    expect(path).toContain('L');
    expect(sparklinePoints([10, 20], 168, 32)).toHaveLength(2);
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
