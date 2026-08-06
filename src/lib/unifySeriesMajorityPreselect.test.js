import { describe, expect, it } from 'vitest';
import {
  SERIES_MAJORITY_PRESELECT_RATIO,
  buildSeriesMajoritySoftPreselect,
  exclusiveBottomHalfCut,
  pickDominantSpacing,
  sumGroupSpacingFindings,
} from './unifySeriesMajorityPreselect.js';

/** @param {Partial<import('./unifyCandidateDiscover.js').UnifySpacingCluster>} p */
function cluster(p) {
  return {
    key: p.key ?? 'k',
    variants: p.variants ?? [],
    counts: p.counts ?? {},
    occurrencesByVariant: {},
    recommendedUnify: p.recommendedUnify ?? p.variants?.[0] ?? '',
    totalCount: p.totalCount ?? 0,
    kind: 'conflict',
    ...p,
  };
}

describe('exclusiveBottomHalfCut', () => {
  it('짝수 목록 — 가운데 인덱스가 cut, 동률 cut은 미포함', () => {
    // sorted [4,10,12,23] → floor(4/2)=2 → cut=12 → <12 만
    expect(exclusiveBottomHalfCut([23, 4, 12, 10])).toBe(12);
  });

  it('홀수 목록', () => {
    // [4,10,23] → floor(3/2)=1 → cut=10
    expect(exclusiveBottomHalfCut([23, 4, 10])).toBe(10);
  });

  it('전부 동률이면 cut=그 값 → 아무도 < cut 아님', () => {
    expect(exclusiveBottomHalfCut([10, 10, 10, 10])).toBe(10);
  });
});

describe('pickDominantSpacing', () => {
  it('80% 띄움', () => {
    expect(pickDominantSpacing(1, 9)).toBe('spaced');
  });

  it('80% 붙임', () => {
    expect(pickDominantSpacing(8, 2)).toBe('glued');
  });

  it('미달이면 null', () => {
    expect(pickDominantSpacing(3, 7)).toBeNull();
    expect(pickDominantSpacing(4, 6)).toBeNull();
  });

  it('비율 상수', () => {
    expect(SERIES_MAJORITY_PRESELECT_RATIO).toBe(0.8);
  });
});

describe('buildSeriesMajoritySoftPreselect', () => {
  it('하위 절반·80% 계열만 soft, 단독은 제외', () => {
    const lowSpaced = {
      type: 'series',
      affix: '동네',
      affixType: 'prefix',
      clusters: [
        cluster({
          key: '동네주민',
          variants: ['동네주민', '동네 주민'],
          counts: { 동네주민: 1, '동네 주민': 9 },
        }),
      ],
    };
    const highMixed = {
      type: 'series',
      affix: '공무원',
      affixType: 'prefix',
      clusters: [
        cluster({
          key: '공무원시험',
          variants: ['공무원시험', '공무원 시험'],
          counts: { 공무원시험: 4, '공무원 시험': 19 },
        }),
      ],
    };
    const single = {
      type: 'single',
      clusters: [
        cluster({
          key: '골드만삭스',
          variants: ['골드만삭스', '골드만 삭스'],
          counts: { 골드만삭스: 1, '골드만 삭스': 9 },
        }),
      ],
    };
    // totals: 10, 23, 10 → sorted [10,10,23] cut=10 → total<10 없음 → soft 없음
    expect(
      buildSeriesMajoritySoftPreselect([lowSpaced, highMixed, single]).size,
    ).toBe(0);

    const mid = {
      type: 'series',
      affix: '공장',
      affixType: 'prefix',
      clusters: [
        cluster({
          key: '공장장',
          variants: ['공장장', '공장 장'],
          counts: { 공장장: 2, '공장 장': 10 },
        }),
      ],
    };
    // totals 10,23,10,12 → sorted [10,10,12,23] cut=12 → 합<12 만 (10·10)
    // mid 합=12 === cut → 동률 제외. lowSpaced 90% spaced만 soft
    const map = buildSeriesMajoritySoftPreselect([
      lowSpaced,
      highMixed,
      single,
      mid,
    ]);
    expect(map.get('동네주민')).toBe('동네 주민');
    expect(map.has('공장장')).toBe(false);
    expect(map.has('공무원시험')).toBe(false);
    expect(map.has('골드만삭스')).toBe(false);
  });

  it('계열 안 여러 키에 같은 방향 적용', () => {
    const group = {
      type: 'series',
      affix: '동네',
      affixType: 'prefix',
      clusters: [
        cluster({
          key: '동네주민',
          variants: ['동네주민', '동네 주민'],
          counts: { 동네주민: 0, '동네 주민': 5 },
        }),
        cluster({
          key: '동네가게',
          variants: ['동네가게', '동네 가게'],
          counts: { 동네가게: 1, '동네 가게': 4 },
        }),
      ],
    };
    const filler = {
      type: 'series',
      affix: '대량',
      affixType: 'prefix',
      clusters: [
        cluster({
          key: '대량생산',
          variants: ['대량생산', '대량 생산'],
          counts: { 대량생산: 20, '대량 생산': 20 },
        }),
      ],
    };
    // totals 10, 40 → cut=40 → 10<40, 동네 계열 10/10=100% spaced
    const map = buildSeriesMajoritySoftPreselect([group, filler]);
    expect(map.get('동네주민')).toBe('동네 주민');
    expect(map.get('동네가게')).toBe('동네 가게');
  });
});

describe('sumGroupSpacingFindings', () => {
  it('붙임·띄움 합', () => {
    expect(
      sumGroupSpacingFindings([
        cluster({
          counts: { a: 2, 'a b': 3 },
          variants: ['a', 'a b'],
        }),
      ]),
    ).toEqual({ glued: 2, spaced: 3, total: 5 });
  });
});
