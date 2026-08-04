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
  sortClusterGroups,
  splitPredicateSingles,
  countUnifyListAccordionItems,
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

  it('이중 드로잉 등으로 raw 2회여도 위성 후보로 허용', () => {
    expect(isSeriesSatelliteCandidate('경제침체', 2, '경제', 'prefix')).toBe(
      true,
    );
  });

  it('0회는 거부', () => {
    expect(isSeriesSatelliteCandidate('경제침체', 0, '경제', 'prefix')).toBe(
      false,
    );
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
  it('조사·어간 접미 충돌은 짧은·긴 결합형 모두 목록에서 뺀다', () => {
    const groups = groupSortAndFillSatellites(
      [
        makeCluster({
          key: '역학은',
          variants: ['역학은', '역학 은'],
          counts: { 역학은: 2, '역학 은': 1 },
          totalCount: 3,
        }),
        makeCluster({
          key: '체계에서는',
          variants: ['체계에서는', '체계 에서는'],
          counts: { 체계에서는: 1, '체계 에서는': 1 },
          totalCount: 2,
        }),
        makeCluster({
          key: '활동이며',
          variants: ['활동이며', '활동 이며'],
          counts: { 활동이며: 1, '활동 이며': 1 },
          totalCount: 2,
        }),
        makeCluster({
          key: '세계경제',
          variants: ['세계경제', '세계 경제'],
          counts: { 세계경제: 1, '세계 경제': 1 },
          totalCount: 2,
        }),
      ],
      new Map(),
    );
    const keys = groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('역학은');
    expect(keys).not.toContain('체계에서는');
    expect(keys).not.toContain('활동이며');
    expect(keys).toContain('세계경제');
  });

  it('충돌 2개면 @ 생성 후 1회 위성 편입', () => {
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

  it('세계경제 충돌 1개 + 세계 시장 위성이면 세계@ 유지', () => {
    const conflict = [
      makeCluster({
        key: '세계경제',
        variants: ['세계경제', '세계 경제'],
        counts: { 세계경제: 1, '세계 경제': 1 },
        totalCount: 2,
      }),
    ];
    const rawByKey = new Map([
      [
        '세계시장',
        {
          counts: new Map([['세계 시장', 1]]),
          occurrences: new Map([
            [
              '세계 시장',
              [{ pageNum: 2, index: 0, matchedText: '세계 시장에서' }],
            ],
          ]),
        },
      ],
    ]);

    const groups = groupSortAndFillSatellites(conflict, rawByKey);
    const series = groups.find((g) => g.type === 'series' && g.affix === '세계');
    expect(series).toBeTruthy();
    expect(series.clusters.map((c) => c.key).sort()).toEqual(
      ['세계경제', '세계시장'].sort(),
    );
    const market = series.clusters.find((c) => c.key === '세계시장');
    expect(market?.kind).toBe('single-form');
    expect(market?.variants).toEqual(
      expect.arrayContaining(['세계 시장', '세계시장']),
    );
  });

  it('가치평가 충돌 — 가치평가에 위성은 잡음 반대로 미편입', () => {
    const conflict = [
      makeCluster({
        key: '가치평가',
        variants: ['가치 평가', '가치평가'],
        counts: { '가치 평가': 4, 가치평가: 1 },
        totalCount: 5,
      }),
      makeCluster({
        key: '가치창출',
        variants: ['가치창출', '가치 창출'],
        counts: { 가치창출: 1, '가치 창출': 1 },
        totalCount: 2,
      }),
    ];
    const rawByKey = new Map([
      [
        '가치평가에',
        {
          counts: new Map([['가치평가에', 1]]),
          occurrences: new Map([
            [
              '가치평가에',
              [{ pageNum: 178, index: 0, matchedText: '가치평가에' }],
            ],
          ]),
        },
      ],
    ]);

    const groups = groupSortAndFillSatellites(conflict, rawByKey);
    const series = groups.find((g) => g.type === 'series' && g.affix === '가치');
    expect(series).toBeTruthy();
    // 반대 띄움「가치 평가에」는 평가(평+가)·에 휴리스틱으로 거부 → 위성 미편입
    expect(series.clusters.find((c) => c.key === '가치평가에')).toBeUndefined();
    const hit = series.clusters.find((c) => c.key === '가치평가');
    expect(hit?.kind).toBe('conflict');
    expect(hit?.variants.some((v) => v.includes('에'))).toBe(false);
    expect(hit?.totalCount).toBe(5);
    expect(hit?.counts.가치평가).toBe(1);
  });

  it('경기@ 위성 둔화다·둔화라·부양금·부양책은 최소단위로 합친다', () => {
    const conflict = [
      makeCluster({
        key: '경기침체',
        variants: ['경기침체', '경기 침체'],
        counts: { 경기침체: 1, '경기 침체': 2 },
        totalCount: 3,
      }),
      makeCluster({
        key: '경기과열',
        variants: ['경기과열', '경기 과열'],
        counts: { 경기과열: 1, '경기 과열': 1 },
        totalCount: 2,
      }),
    ];
    const rawByKey = new Map([
      [
        '경기둔화다',
        {
          counts: new Map([['경기 둔화다', 1]]),
          occurrences: new Map(),
        },
      ],
      [
        '경기둔화라',
        {
          counts: new Map([['경기 둔화라', 1]]),
          occurrences: new Map(),
        },
      ],
      [
        '경기부양금',
        {
          counts: new Map([['경기 부양금', 1]]),
          occurrences: new Map(),
        },
      ],
      [
        '경기부양책',
        {
          counts: new Map([['경기부양책', 1]]),
          occurrences: new Map(),
        },
      ],
    ]);

    const groups = groupSortAndFillSatellites(conflict, rawByKey);
    const series = groups.find((g) => g.type === 'series' && g.affix === '경기');
    expect(series).toBeTruthy();
    const keys = series.clusters.map((c) => c.key).sort();
    expect(keys).toEqual(
      expect.arrayContaining(['경기침체', '경기과열', '경기둔화', '경기부양']),
    );
    expect(keys).not.toEqual(expect.arrayContaining(['경기둔화다']));
    expect(keys).not.toEqual(expect.arrayContaining(['경기부양책']));
    expect(series.clusters.filter((c) => c.key === '경기부양')).toHaveLength(1);
    expect(series.clusters.filter((c) => c.key === '경기둔화')).toHaveLength(1);
  });

  it('충돌 1개만 있고 위성 없으면 @를 만들지 않는다', () => {
    const groups = groupSortAndFillSatellites(
      [
        makeCluster({
          key: '세계경제',
          variants: ['세계경제', '세계 경제'],
          counts: { 세계경제: 1, '세계 경제': 1 },
          totalCount: 2,
        }),
      ],
      new Map(),
    );
    expect(groups.some((g) => g.type === 'series')).toBe(false);
    expect(
      groups.some(
        (g) =>
          g.type === 'single' && g.clusters.some((c) => c.key === '세계경제'),
      ),
    ).toBe(true);
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

describe('countUnifyListAccordionItems', () => {
  it('단일·용언은 클러스터 수, 계열은 그룹당 1', () => {
    expect(
      countUnifyListAccordionItems([
        {
          type: 'single',
          clusters: [
            makeCluster({ key: '가나' }),
            makeCluster({ key: '다라' }),
          ],
        },
        {
          type: 'series',
          affix: '경제',
          affixType: 'prefix',
          label: '경제@',
          clusters: [
            makeCluster({ key: '경제성장' }),
            makeCluster({ key: '경제회복' }),
            makeCluster({ key: '경제왕국' }),
          ],
        },
        {
          type: 'predicate',
          clusters: [makeCluster({ key: '살펴보다' })],
        },
      ]),
    ).toBe(4);
  });
});

describe('sortClusterGroups', () => {
  it('단일(발견↓) → ○○@ → @○○ → 용언, 동률이면 가나다', () => {
    const groups = sortClusterGroups([
      {
        type: 'predicate',
        clusters: [
          makeCluster({
            key: '만들어',
            variants: ['만들어', '만들 어'],
            counts: { 만들어: 1, '만들 어': 1 },
            totalCount: 2,
          }),
        ],
      },
      {
        type: 'series',
        affix: '시장',
        affixType: 'suffix',
        label: '@시장',
        clusters: [
          makeCluster({
            key: '세계시장',
            variants: ['세계시장', '세계 시장'],
            totalCount: 20,
          }),
        ],
      },
      {
        type: 'series',
        affix: '금융',
        affixType: 'prefix',
        label: '금융@',
        clusters: [
          makeCluster({
            key: '금융시장',
            variants: ['금융시장', '금융 시장'],
            totalCount: 3,
          }),
        ],
      },
      {
        type: 'series',
        affix: '경제',
        affixType: 'prefix',
        label: '경제@',
        clusters: [
          makeCluster({
            key: '경제성장',
            variants: ['경제성장', '경제 성장'],
            counts: { 경제성장: 1, '경제 성장': 1 },
            totalCount: 2,
          }),
          makeCluster({
            key: '경제회복',
            variants: ['경제회복', '경제 회복'],
            counts: { 경제회복: 5, '경제 회복': 5 },
            totalCount: 10,
          }),
        ],
      },
      {
        type: 'single',
        clusters: [
          makeCluster({
            key: '얽혀있다',
            variants: ['얽혀있다', '얽혀 있다'],
            counts: { 얽혀있다: 1, '얽혀 있다': 1 },
            totalCount: 2,
          }),
          makeCluster({
            key: '가정해보자',
            variants: ['가정해보자', '가정해 보자'],
            counts: { 가정해보자: 1, '가정해 보자': 5 },
            totalCount: 6,
          }),
          makeCluster({
            key: '가나표기',
            variants: ['가나표기', '가나 표기'],
            counts: { 가나표기: 1, '가나 표기': 1 },
            totalCount: 2,
          }),
        ],
      },
    ]);

    expect(groups.map((g) => g.type)).toEqual([
      'single',
      'series',
      'series',
      'series',
      'predicate',
    ]);
    // 단일: 6회 → 2회 동률 가나다(가나·얽혀)
    expect(groups[0].clusters.map((c) => c.key)).toEqual([
      '가정해보자',
      '가나표기',
      '얽혀있다',
    ]);
    // 접두@: 합계 많은 경제@(12) → 금융@(3)
    expect(groups[1].label).toBe('경제@');
    expect(groups[1].clusters.map((c) => c.key)).toEqual([
      '경제회복',
      '경제성장',
    ]);
    expect(groups[2].label).toBe('금융@');
    expect(groups[3].label).toBe('@시장');
    expect(groups[4].clusters.map((c) => c.key)).toEqual(['만들어']);
  });

  it('접두·접미 용언 계열은 명사 계열 뒤로 보낸다', () => {
    const groups = sortClusterGroups([
      {
        type: 'series',
        affix: '만들어',
        affixType: 'prefix',
        label: '만들어@',
        clusters: [
          makeCluster({
            key: '만들어줄',
            variants: ['만들어줄', '만들어 줄'],
            counts: { 만들어줄: 1, '만들어 줄': 1 },
          }),
        ],
      },
      {
        type: 'series',
        affix: '물가',
        affixType: 'prefix',
        label: '물가@',
        clusters: [
          makeCluster({
            key: '물가상승',
            variants: ['물가상승', '물가 상승'],
            counts: { 물가상승: 1, '물가 상승': 1 },
          }),
        ],
      },
      {
        type: 'series',
        affix: '보여',
        affixType: 'suffix',
        label: '@보여',
        clusters: [
          makeCluster({
            key: '잘보여',
            variants: ['잘보여', '잘 보여'],
            counts: { 잘보여: 1, '잘 보여': 1 },
          }),
        ],
      },
      {
        type: 'series',
        affix: '미국',
        affixType: 'prefix',
        label: '미국@',
        clusters: [
          makeCluster({
            key: '미국정부',
            variants: ['미국정부', '미국 정부'],
            counts: { 미국정부: 1, '미국 정부': 1 },
          }),
        ],
      },
      {
        type: 'predicate',
        clusters: [
          makeCluster({
            key: '생각해',
            variants: ['생각해', '생각 해'],
            counts: { 생각해: 1, '생각 해': 1 },
          }),
        ],
      },
    ]);

    expect(
      groups.map((g) =>
        g.type === 'series' ? g.label : g.type === 'predicate' ? '용언' : g.type,
      ),
    ).toEqual(['물가@', '미국@', '용언', '만들어@', '@보여']);
  });

  it('@보다·@내다 계열도 명사 뒤로 보낸다', () => {
    const groups = sortClusterGroups([
      {
        type: 'series',
        affix: '보다',
        affixType: 'suffix',
        label: '@보다',
        clusters: [
          makeCluster({
            key: '살펴보다',
            variants: ['살펴보다', '살펴 보다'],
            counts: { 살펴보다: 1, '살펴 보다': 1 },
          }),
        ],
      },
      {
        type: 'series',
        affix: '내다',
        affixType: 'suffix',
        label: '@내다',
        clusters: [
          makeCluster({
            key: '만들어내다',
            variants: ['만들어내다', '만들어 내다'],
            counts: { 만들어내다: 1, '만들어 내다': 1 },
          }),
        ],
      },
      {
        type: 'series',
        affix: '시장',
        affixType: 'suffix',
        label: '@시장',
        clusters: [
          makeCluster({
            key: '세계시장',
            variants: ['세계시장', '세계 시장'],
            counts: { 세계시장: 1, '세계 시장': 1 },
          }),
        ],
      },
    ]);

    expect(groups.map((g) => g.label)).toEqual(['@시장', '@내다', '@보다']);
  });
});

describe('splitPredicateSingles', () => {
  it('단일에서 용언을 빼 맨 아래로 보낸다', () => {
    const groups = splitPredicateSingles([
      {
        type: 'single',
        clusters: [
          makeCluster({
            key: '만들어',
            variants: ['만들어', '만들 어'],
            counts: { 만들어: 2, '만들 어': 1 },
            totalCount: 3,
          }),
          makeCluster({
            key: '물가',
            variants: ['물가', '물 가'],
            counts: { 물가: 2, '물 가': 1 },
            totalCount: 3,
          }),
          makeCluster({
            key: '생각해',
            variants: ['생각해', '생각 해'],
            counts: { 생각해: 1, '생각 해': 1 },
            totalCount: 2,
          }),
        ],
      },
      {
        type: 'series',
        affix: '세계',
        affixType: 'prefix',
        label: '세계@',
        clusters: [
          makeCluster({
            key: '세계경제',
            variants: ['세계경제', '세계 경제'],
            counts: { 세계경제: 1, '세계 경제': 1 },
          }),
        ],
      },
    ]);

    expect(groups.map((g) => g.type)).toEqual([
      'single',
      'series',
      'predicate',
    ]);
    expect(groups[0].clusters.map((c) => c.key)).toEqual(['물가']);
    expect(groups[2].clusters.map((c) => c.key)).toEqual([
      '만들어',
      '생각해',
    ]);
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

  it('경제학상처럼 반대형이 1음절 띄움이면 위성 거부', () => {
    const acc = {
      counts: new Map([['경제학상', 1]]),
      occurrences: new Map([['경제학상', []]]),
    };
    // Kiwi 없으면 경제 학상(2·2)이 유효해 통과할 수 있음 — 원자 명사 게이트는 Node 테스트에서
    const cluster = buildSingleFormCluster('경제학상', acc, 'prefix', '경제');
    if (cluster) {
      expect(cluster.counts['경제 학상'] ?? 0).toBe(0);
    }
  });

  it('경제학(조사 제거 후)도 경제 학 띄움이 무효면 위성 거부', () => {
    const acc = {
      counts: new Map([['경제학', 1]]),
      occurrences: new Map([['경제학', []]]),
    };
    expect(buildSingleFormCluster('경제학', acc, 'prefix', '경제')).toBeNull();
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
