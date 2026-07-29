import { describe, it, expect } from 'vitest';
import {
  extractPrefixes,
  extractSuffixes,
  groupClustersBySeries,
  groupClustersBySuffix,
  calcSeriesTrend,
  buildSeriesHints,
  SERIES_PREFIX_MIN_HANGUL,
} from './unifyCandidateSeriesTrend.js';

/** @param {Partial<import('./unifyCandidateDiscover.js').UnifySpacingCluster>} overrides */
function makeCluster(overrides) {
  return {
    key: '',
    variants: [],
    counts: {},
    occurrencesByVariant: {},
    recommendedUnify: '',
    totalCount: 0,
    ...overrides,
  };
}

describe('extractPrefixes', () => {
  it('한글 2~4음절 접두어를 긴 것부터 반환', () => {
    const result = extractPrefixes('경제전망');
    expect(result).toEqual(['경제전', '경제']);
  });

  it('한글 2음절 미만 key는 빈 배열', () => {
    expect(extractPrefixes('경')).toEqual([]);
    expect(extractPrefixes('1234')).toEqual([]);
  });

  it('숫자 포함 key에서 첫 한글 덩어리 기준', () => {
    const result = extractPrefixes('제1차세계대전');
    // 첫 한글 덩어리 = '제' (1음절) → 빈 배열
    expect(result).toEqual([]);
  });

  it('긴 한글에서 최대 4음절까지', () => {
    const result = extractPrefixes('경제성장률분석');
    expect(result).toEqual(['경제성장', '경제성', '경제']);
  });
});

describe('groupClustersBySeries', () => {
  it('같은 접두어 2개 이상이면 series 형성', () => {
    const clusters = [
      makeCluster({ key: '경제전망', variants: ['경제전망', '경제 전망'], counts: { 경제전망: 5, '경제 전망': 2 }, recommendedUnify: '경제전망', totalCount: 7 }),
      makeCluster({ key: '경제성장', variants: ['경제성장', '경제 성장'], counts: { 경제성장: 3, '경제 성장': 6 }, recommendedUnify: '경제 성장', totalCount: 9 }),
    ];
    const result = groupClustersBySeries(clusters);
    expect(result.has('경제')).toBe(true);
    expect(result.get('경제')).toHaveLength(2);
  });

  it('클러스터 1개뿐이면 series 안 됨', () => {
    const clusters = [
      makeCluster({ key: '경제전망', variants: ['경제전망'], counts: { 경제전망: 5 }, recommendedUnify: '경제전망', totalCount: 5 }),
      makeCluster({ key: '사회복지', variants: ['사회복지'], counts: { 사회복지: 3 }, recommendedUnify: '사회복지', totalCount: 3 }),
    ];
    const result = groupClustersBySeries(clusters);
    expect(result.size).toBe(0);
  });
});

describe('calcSeriesTrend', () => {
  it('붙임 다수 → ratio > 0.7', () => {
    const clusters = [
      makeCluster({ counts: { 경제전망: 8, '경제 전망': 2 } }),
      makeCluster({ counts: { 경제성장: 7, '경제 성장': 3 } }),
    ];
    const ratio = calcSeriesTrend(clusters);
    expect(ratio).toBe(15 / 20);
    expect(ratio).toBeGreaterThanOrEqual(0.7);
  });

  it('띄움 다수 → ratio <= 0.3', () => {
    const clusters = [
      makeCluster({ counts: { 경제전망: 1, '경제 전망': 9 } }),
      makeCluster({ counts: { 경제성장: 2, '경제 성장': 8 } }),
    ];
    const ratio = calcSeriesTrend(clusters);
    expect(ratio).toBe(3 / 20);
    expect(ratio).toBeLessThanOrEqual(0.3);
  });

  it('중립(0.3~0.7) → hint 안 생김', () => {
    const clusters = [
      makeCluster({ counts: { 경제전망: 5, '경제 전망': 5 } }),
      makeCluster({ counts: { 경제성장: 5, '경제 성장': 5 } }),
    ];
    const ratio = calcSeriesTrend(clusters);
    expect(ratio).toBe(0.5);
  });
});

describe('buildSeriesHints', () => {
  it('경제 계열 — 붙임 우세인데 다수형이 띄움인 클러스터에 hint', () => {
    const clusters = [
      makeCluster({
        key: '경제전망',
        variants: ['경제전망', '경제 전망'],
        counts: { 경제전망: 15, '경제 전망': 2 },
        recommendedUnify: '경제전망',
        totalCount: 17,
      }),
      makeCluster({
        key: '경제성장',
        variants: ['경제성장', '경제 성장'],
        counts: { 경제성장: 4, '경제 성장': 5 },
        recommendedUnify: '경제 성장',
        totalCount: 9,
      }),
    ];
    const hints = buildSeriesHints(clusters);
    // 경제전망은 다수형=붙임이고 계열도 붙임 → hint 없음
    expect(hints.has('경제전망')).toBe(false);
    // 경제성장은 다수형=띄움인데 계열은 붙임 → hint 있음
    expect(hints.has('경제성장')).toBe(true);
    const hint = hints.get('경제성장');
    expect(hint.trend).toBe('glued');
    expect(hint.suggestion).toBe('경제성장');
    expect(hint.reason).toContain('경제');
    expect(hint.reason).toContain('붙임');
  });

  it('중립 계열이면 hint 없음', () => {
    const clusters = [
      makeCluster({
        key: '사회복지',
        variants: ['사회복지', '사회 복지'],
        counts: { 사회복지: 5, '사회 복지': 5 },
        recommendedUnify: '사회복지',
        totalCount: 10,
      }),
      makeCluster({
        key: '사회보장',
        variants: ['사회보장', '사회 보장'],
        counts: { 사회보장: 5, '사회 보장': 5 },
        recommendedUnify: '사회보장',
        totalCount: 10,
      }),
    ];
    const hints = buildSeriesHints(clusters);
    expect(hints.size).toBe(0);
  });

  it('접두어 2음절 미만 key만 있으면 series 없음', () => {
    const clusters = [
      makeCluster({ key: '강물', variants: ['강물'], counts: { 강물: 5 }, recommendedUnify: '강물', totalCount: 5 }),
      makeCluster({ key: '강변', variants: ['강변'], counts: { 강변: 3 }, recommendedUnify: '강변', totalCount: 3 }),
    ];
    const hints = buildSeriesHints(clusters);
    expect(hints.size).toBe(0);
  });

  it('공통 접미사(suffix) 계열도 hint 생성', () => {
    // 캐나다정부, 미국정부, 한국정부 → 「○○정부」계열
    const clusters = [
      makeCluster({
        key: '미국정부',
        variants: ['미국정부', '미국 정부'],
        counts: { 미국정부: 15, '미국 정부': 1 },
        recommendedUnify: '미국정부',
        totalCount: 16,
      }),
      makeCluster({
        key: '영국정부',
        variants: ['영국정부', '영국 정부'],
        counts: { 영국정부: 14, '영국 정부': 2 },
        recommendedUnify: '영국정부',
        totalCount: 16,
      }),
      makeCluster({
        key: '한국정부',
        variants: ['한국정부', '한국 정부'],
        counts: { 한국정부: 3, '한국 정부': 8 },
        recommendedUnify: '한국 정부',
        totalCount: 11,
      }),
    ];
    const hints = buildSeriesHints(clusters);
    // 한국정부 클러스터는 다수형이 띄움이지만 계열은 붙임 → hint
    expect(hints.has('한국정부')).toBe(true);
    const hint = hints.get('한국정부');
    expect(hint.trend).toBe('glued');
    expect(hint.suggestion).toBe('한국정부');
    expect(hint.reason).toContain('정부');
  });
});
