import { describe, expect, it } from 'vitest';
import {
  SERIES_MAJORITY_PRESELECT_RATIO,
  buildSeriesMajoritySoftPreselect,
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
  it('80% 압도 계열만 soft, 단독·미달은 제외', () => {
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
    const highSpaced = {
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
    const mixed = {
      type: 'series',
      affix: '공장',
      affixType: 'prefix',
      clusters: [
        cluster({
          key: '공장장',
          variants: ['공장장', '공장 장'],
          counts: { 공장장: 3, '공장 장': 7 },
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

    const map = buildSeriesMajoritySoftPreselect([
      lowSpaced,
      highSpaced,
      mixed,
      single,
    ]);
    expect(map.get('동네주민')).toBe('동네 주민');
    expect(map.get('공무원시험')).toBe('공무원 시험');
    expect(map.has('공장장')).toBe(false);
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
    const map = buildSeriesMajoritySoftPreselect([group]);
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
