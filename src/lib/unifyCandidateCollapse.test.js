import { describe, expect, it } from 'vitest';
import {
  isNestedSpacingCluster,
  normalizeSpacingClusters,
} from './unifyCandidateCollapse.js';

/** @param {Partial<import('./unifyCandidateDiscover.js').UnifySpacingCluster>} p */
function cluster(p) {
  return {
    key: p.key ?? '',
    variants: p.variants ?? [],
    counts: p.counts ?? {},
    occurrencesByVariant: p.occurrencesByVariant ?? {},
    recommendedUnify: p.recommendedUnify ?? p.variants?.[0] ?? '',
    totalCount: p.totalCount ?? 0,
    kind: /** @type {const} */ ('conflict'),
    ...p,
  };
}

describe('isNestedSpacingCluster', () => {
  const short = cluster({
    key: '개인소득',
    variants: ['개인소득', '개인 소득'],
    counts: { 개인소득: 1, '개인 소득': 1 },
    totalCount: 2,
  });

  it('개인 소득 등이는 개인 소득의 확장', () => {
    const long = cluster({
      key: '개인소득등이',
      variants: ['개인소득등이', '개인 소득 등이'],
    });
    expect(isNestedSpacingCluster(short, long)).toBe(true);
  });

  it('개인 소득세는 어절 수 중첩이 아니다', () => {
    const other = cluster({
      key: '개인소득세',
      variants: ['개인소득세', '개인 소득세'],
    });
    expect(isNestedSpacingCluster(short, other)).toBe(false);
  });
});

describe('normalizeSpacingClusters', () => {
  it('긴 n-gram만 있으면 어절을 자르지 않는다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '개인소득등이',
        variants: ['개인소득등이', '개인 소득 등이'],
        counts: { 개인소득등이: 1, '개인 소득 등이': 1 },
        totalCount: 2,
        recommendedUnify: '개인소득등이',
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].variants).toEqual(['개인소득등이', '개인 소득 등이']);
  });

  it('개인 소득 계열 긴 n-gram을 짧은 단위로 합친다', () => {
    const clusters = [
      cluster({
        key: '개인소득',
        variants: ['개인소득', '개인 소득'],
        counts: { 개인소득: 1, '개인 소득': 1 },
        totalCount: 2,
        recommendedUnify: '개인소득',
      }),
      cluster({
        key: '개인소득등이',
        variants: ['개인소득등이', '개인 소득 등이'],
        counts: { 개인소득등이: 1, '개인 소득 등이': 1 },
        totalCount: 2,
        recommendedUnify: '개인소득등이',
      }),
      cluster({
        key: '개인소득등이주저앉았',
        variants: ['개인소득등이주저앉았', '개인 소득 등이 주저앉았'],
        counts: {
          개인소득등이주저앉았: 1,
          '개인 소득 등이 주저앉았': 1,
        },
        totalCount: 2,
        recommendedUnify: '개인소득등이주저앉았',
      }),
    ];

    const out = normalizeSpacingClusters(clusters);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('개인소득');
    expect(out[0].counts['개인 소득']).toBe(3);
    expect(out[0].counts.개인소득).toBe(3);
    expect(out[0].totalCount).toBe(6);
  });

  it('둘째 어절 공통 접두면 작은 단위로 합친다(소득·소득세 → 소득)', () => {
    const clusters = [
      cluster({
        key: '개인소득',
        variants: ['개인소득', '개인 소득'],
        counts: { 개인소득: 1, '개인 소득': 1 },
        totalCount: 2,
      }),
      cluster({
        key: '개인소득세',
        variants: ['개인소득세', '개인 소득세'],
        counts: { 개인소득세: 1, '개인 소득세': 1 },
        totalCount: 2,
      }),
    ];

    const out = normalizeSpacingClusters(clusters);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('개인소득');
    expect(out[0].totalCount).toBe(4);
  });

  it('경제 회복력·회복세법은 경제 회복으로 합친다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '경제회복력',
        variants: ['경제회복력', '경제 회복력'],
        counts: { 경제회복력: 1, '경제 회복력': 1 },
        totalCount: 2,
      }),
      cluster({
        key: '경제회복세법',
        variants: ['경제회복세법', '경제 회복세법'],
        counts: { 경제회복세법: 1, '경제 회복세법': 1 },
        totalCount: 2,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('경제회복');
    expect(out[0].variants).toEqual(
      expect.arrayContaining(['경제회복', '경제 회복']),
    );
    expect(out[0].totalCount).toBe(4);
  });

  it('경제 이론들·이론이다는 경제 이론으로 합친다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '경제이론들',
        variants: ['경제이론들', '경제 이론들'],
        counts: { 경제이론들: 1, '경제 이론들': 1 },
        totalCount: 2,
      }),
      cluster({
        key: '경제이론이다',
        variants: ['경제이론이다', '경제 이론이다'],
        counts: { 경제이론이다: 1, '경제 이론이다': 1 },
        totalCount: 2,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('경제이론');
    expect(out[0].variants).toEqual(
      expect.arrayContaining(['경제이론', '경제 이론']),
    );
  });

  it('형제 없이 혼자면 둘째 어절을 자르지 않는다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '경제회복력',
        variants: ['경제회복력', '경제 회복력'],
        counts: { 경제회복력: 1, '경제 회복력': 1 },
        totalCount: 2,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('경제회복력');
  });

  it('@시장 — 3어절 단독은 자르지 않는다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '차기준은시장',
        variants: ['차기준은시장', '차기 준은 시장'],
        counts: { 차기준은시장: 1, '차기 준은 시장': 1 },
        totalCount: 2,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].variants).toEqual(
      expect.arrayContaining(['차기준은시장', '차기 준은 시장']),
    );
  });

  it('경기 둔화다·둔화라는 경기 둔화로 합친다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '경기둔화다',
        variants: ['경기 둔화다', '경기둔화다'],
        counts: { '경기 둔화다': 1, 경기둔화다: 0 },
        totalCount: 1,
        kind: 'single-form',
      }),
      cluster({
        key: '경기둔화라',
        variants: ['경기 둔화라', '경기둔화라'],
        counts: { '경기 둔화라': 1, 경기둔화라: 0 },
        totalCount: 1,
        kind: 'single-form',
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('경기둔화');
    expect(out[0].variants).toEqual(
      expect.arrayContaining(['경기 둔화', '경기둔화']),
    );
  });

  it('경기 부양금·부양책은 경기 부양으로 합친다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '경기부양금',
        variants: ['경기 부양금', '경기부양금'],
        counts: { '경기 부양금': 1, 경기부양금: 0 },
        totalCount: 1,
        kind: 'single-form',
      }),
      cluster({
        key: '경기부양책',
        variants: ['경기 부양책', '경기부양책'],
        counts: { 경기부양책: 1, '경기 부양책': 0 },
        totalCount: 1,
        kind: 'single-form',
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('경기부양');
    expect(out[0].variants).toEqual(
      expect.arrayContaining(['경기 부양', '경기부양']),
    );
  });

  it('짧은 단위가 있으면 긴 키(조사 등)를 흡수한다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '가치평가',
        variants: ['가치평가', '가치 평가'],
        counts: { 가치평가: 1, '가치 평가': 4 },
        totalCount: 5,
      }),
      cluster({
        key: '가치평가에',
        variants: ['가치평가에', '가치 평가에'],
        counts: { 가치평가에: 1, '가치 평가에': 1 },
        totalCount: 2,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('가치평가');
    expect(out[0].variants).toEqual(
      expect.arrayContaining(['가치평가', '가치 평가']),
    );
    expect(out[0].variants.some((v) => v.includes('에'))).toBe(false);
    expect(out[0].totalCount).toBe(7);
  });

  it('가짜 짧은 키(가치평)로는 흡수하지 않는다', () => {
    const out = normalizeSpacingClusters([
      cluster({
        key: '가치평',
        variants: ['가치평', '가치 평'],
        counts: { 가치평: 1, '가치 평': 1 },
        totalCount: 2,
      }),
      cluster({
        key: '가치평가',
        variants: ['가치평가', '가치 평가'],
        counts: { 가치평가: 1, '가치 평가': 1 },
        totalCount: 2,
      }),
    ]);
    expect(out.find((c) => c.key === '가치평가')).toBeTruthy();
    expect(out.find((c) => c.key === '가치평')).toBeTruthy();
  });
});
