import { describe, expect, it } from 'vitest';
import {
  isNestedSpacingCluster,
  normalizeSpacingClusters,
  trimClusterToAffixBoundary,
  trimClusterToCoreSpacingPair,
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

  it('개인 소득세는 별도 경계(둘째 어절 다름)', () => {
    const other = cluster({
      key: '개인소득세',
      variants: ['개인소득세', '개인 소득세'],
    });
    expect(isNestedSpacingCluster(short, other)).toBe(false);
  });
});

describe('trimClusterToAffixBoundary', () => {
  it('경제@ — 경제 다음 한 어절까지만', () => {
    const out = trimClusterToAffixBoundary(
      cluster({
        key: '경제성장모멘텀',
        variants: ['경제성장모멘텀', '경제 성장 모멘텀'],
        counts: { 경제성장모멘텀: 1, '경제 성장 모멘텀': 1 },
        totalCount: 2,
      }),
      '경제',
      'prefix',
    );
    expect(out?.variants).toEqual(['경제성장', '경제 성장']);
  });

  it('@정부 — 정부 앞 한 어절까지만', () => {
    const out = trimClusterToAffixBoundary(
      cluster({
        key: '차기미국정부',
        variants: ['차기미국정부', '차기 미국 정부'],
        counts: { 차기미국정부: 1, '차기 미국 정부': 1 },
        totalCount: 2,
      }),
      '정부',
      'suffix',
    );
    expect(out?.variants).toEqual(['미국정부', '미국 정부']);
  });
});

describe('trimClusterToCoreSpacingPair', () => {
  it('3어절 이상이면 앞 두 어절만 남긴다', () => {
    const out = trimClusterToCoreSpacingPair(
      cluster({
        key: '개인소득등이',
        variants: ['개인소득등이', '개인 소득 등이'],
        counts: { 개인소득등이: 1, '개인 소득 등이': 1 },
        totalCount: 2,
      }),
    );
    expect(out.key).toBe('개인소득');
    expect(out.variants).toEqual(['개인소득', '개인 소득']);
  });

  it('2어절이면 그대로 둔다', () => {
    const input = cluster({
      key: '개인소득세',
      variants: ['개인소득세', '개인 소득세'],
      counts: { 개인소득세: 1, '개인 소득세': 1 },
      totalCount: 2,
    });
    expect(trimClusterToCoreSpacingPair(input)).toEqual(input);
  });
});

describe('normalizeSpacingClusters', () => {
  it('긴 n-gram을 개인 소득 / 개인소득으로 정규화한다', () => {
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
    expect(out[0].variants).toEqual(['개인소득', '개인 소득']);
  });

  it('개인 소득 계열 긴 n-gram을 하나로 합친다', () => {
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

  it('개인 소득세는 개인 소득과 별도로 남긴다', () => {
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

    expect(normalizeSpacingClusters(clusters)).toHaveLength(2);
  });
});
