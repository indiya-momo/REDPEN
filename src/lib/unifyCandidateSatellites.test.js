import { describe, it, expect } from 'vitest';
import {
  deriveOppositeVariant,
  buildSingleFormCluster,
  fillSeriesSatellites,
  isSeriesSatelliteCandidate,
} from './unifyCandidateSatellites.js';
import {
  groupAndSortClusters,
  groupSortAndFillSatellites,
  isRealSpacingConflict,
} from './unifyCandidateGrouping.js';

/** @param {Partial<import('./unifyCandidateDiscover.js').UnifySpacingCluster>} overrides */
function makeCluster(overrides) {
  return {
    key: '미국정부',
    variants: ['미국정부', '미국 정부'],
    counts: { 미국정부: 2, '미국 정부': 5 },
    occurrencesByVariant: {},
    recommendedUnify: '미국 정부',
    totalCount: 7,
    kind: 'conflict',
    ...overrides,
  };
}

describe('isSeriesSatelliteCandidate', () => {
  it('개인 사정처럼 affix 옆 한 어절 1회는 허용', () => {
    expect(
      isSeriesSatelliteCandidate('개인 사정', 1, '개인', 'prefix'),
    ).toBe(true);
  });

  it('위성만으로 쓸 구분하지는 붙임 1회면 허용', () => {
    expect(
      isSeriesSatelliteCandidate('구분하지', 1, '구분', 'prefix'),
    ).toBe(true);
  });
});

describe('isRealSpacingConflict', () => {
  it('붙임·띄움이 둘 다 있으면 true', () => {
    expect(
      isRealSpacingConflict(
        makeCluster({
          counts: { 개인소득: 1, '개인 소득': 2 },
          totalCount: 3,
        }),
      ),
    ).toBe(true);
  });

  it('한쪽만 있으면 false', () => {
    expect(
      isRealSpacingConflict(
        makeCluster({
          counts: { '개인 사정': 1, 개인사정: 0 },
          totalCount: 1,
          kind: 'single-form',
        }),
      ),
    ).toBe(false);
  });
});

describe('groupSortAndFillSatellites', () => {
  it('1) 실제 쌍 2개 이상으로만 @ 생성 2) 그다음 1회 위성 편입', () => {
    const conflict = [
      makeCluster({
        key: '개인소득',
        variants: ['개인소득', '개인 소득'],
        counts: { 개인소득: 1, '개인 소득': 2 },
        totalCount: 3,
      }),
      makeCluster({
        key: '개인정보',
        variants: ['개인정보', '개인 정보'],
        counts: { 개인정보: 1, '개인 정보': 1 },
        totalCount: 2,
      }),
    ];
    const rawByKey = new Map([
      [
        '개인사정',
        {
          counts: new Map([['개인 사정', 1]]),
          occurrences: new Map([
            ['개인 사정', [{ pageNum: 1, index: 0, matchedText: '개인 사정' }]],
          ]),
        },
      ],
      [
        '구분하지',
        {
          counts: new Map([['구분하지', 1]]),
          occurrences: new Map(),
        },
      ],
      [
        '구분해서',
        {
          counts: new Map([['구분해서', 1]]),
          occurrences: new Map(),
        },
      ],
    ]);

    const groups = groupSortAndFillSatellites(conflict, rawByKey);
    const personal = groups.find(
      (g) => g.type === 'series' && g.affix === '개인',
    );
    expect(personal).toBeTruthy();
    expect(personal.clusters.filter(isRealSpacingConflict)).toHaveLength(2);
    const sat = personal.clusters.find((c) => c.key === '개인사정');
    expect(sat?.kind).toBe('single-form');
    expect(sat?.counts['개인 사정']).toBe(1);
    expect(sat?.counts.개인사정).toBe(0);

    expect(
      groups.some((g) => g.type === 'series' && g.affix === '구분'),
    ).toBe(false);
  });

  it('실제 쌍 없이 위성만으로는 @를 만들지 않는다', () => {
    const groups = groupSortAndFillSatellites(
      [],
      new Map([
        [
          '구분하지',
          { counts: new Map([['구분하지', 1]]), occurrences: new Map() },
        ],
        [
          '구분해서',
          { counts: new Map([['구분해서', 1]]), occurrences: new Map() },
        ],
      ]),
    );
    expect(groups.some((g) => g.type === 'series')).toBe(false);
  });
});

describe('buildSingleFormCluster', () => {
  it('띄움 1회 개인 사정 → 붙임 예상형', () => {
    const acc = {
      counts: new Map([['개인 사정', 1]]),
      occurrences: new Map([['개인 사정', []]]),
    };
    const cluster = buildSingleFormCluster('개인사정', acc, 'prefix', '개인');
    expect(cluster?.variants).toEqual(['개인 사정', '개인사정']);
    expect(cluster?.counts.개인사정).toBe(0);
  });
});

describe('fillSeriesSatellites', () => {
  it('기존 @정부에 영국정부 위성 편입', () => {
    const conflict = [
      makeCluster({
        key: '미국정부',
        variants: ['미국정부', '미국 정부'],
        counts: { 미국정부: 2, '미국 정부': 5 },
        totalCount: 7,
      }),
      makeCluster({
        key: '한국정부',
        variants: ['한국정부', '한국 정부'],
        counts: { 한국정부: 1, '한국 정부': 3 },
        totalCount: 4,
      }),
    ];
    const rawByKey = new Map([
      [
        '영국정부',
        {
          counts: new Map([['영국정부', 1]]),
          occurrences: new Map(),
        },
      ],
    ]);
    const groups = groupAndSortClusters(conflict);
    fillSeriesSatellites(groups, conflict, rawByKey);
    const gov = groups.find((g) => g.type === 'series' && g.affix === '정부');
    expect(gov?.clusters.some((c) => c.key === '영국정부')).toBe(true);
  });
});

describe('deriveOppositeVariant', () => {
  it('prefix: 붙임 → 띄움', () => {
    expect(deriveOppositeVariant('개인사정', '개인사정', 'prefix', '개인')).toBe(
      '개인 사정',
    );
  });
});
