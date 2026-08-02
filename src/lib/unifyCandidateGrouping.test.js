import { describe, expect, it } from 'vitest';
import {
  groupAndSortClusters,
  groupSortAndFillSatellites,
  sortClusterGroups,
} from './unifyCandidateGrouping.js';

/** @param {string} key @param {string} spaced */
function conflict(key, spaced) {
  return {
    key,
    variants: [key, spaced],
    counts: { [key]: 1, [spaced]: 1 },
    kind: /** @type {const} */ ('conflict'),
    totalCount: 2,
  };
}

describe('groupAndSortClusters — 접두·접미 멤버 수 우선', () => {
  it('뒷말이 더 많이 묶이면 @접미를 고른다', () => {
    const clusters = [
      conflict('공공서비스', '공공 서비스'),
      conflict('미국서비스', '미국 서비스'),
    ];
    const groups = groupAndSortClusters(clusters, { minSeriesMembers: 1 });
    const labels = groups
      .filter((g) => g.type === 'series')
      .map((g) => g.label);
    expect(labels).toContain('@서비스');
    expect(labels).not.toContain('공공@');
    expect(labels).not.toContain('미국@');
  });

  it('앞말이 더 많이 묶이면 접두@를 고른다', () => {
    const clusters = [
      conflict('경제상황', '경제 상황'),
      conflict('경제성장', '경제 성장'),
      conflict('공공서비스', '공공 서비스'),
      conflict('미국서비스', '미국 서비스'),
    ];
    const groups = groupAndSortClusters(clusters, { minSeriesMembers: 1 });
    const series = groups.filter((g) => g.type === 'series');
    expect(series.map((g) => g.label).sort()).toEqual(
      ['@서비스', '경제@'].sort(),
    );
  });

  it('동률이면 접두(어쩌고@)를 우선한다', () => {
    const clusters = [
      conflict('경제상황', '경제 상황'),
      conflict('경제성장', '경제 성장'),
    ];
    // 경제@ (2) vs @상황(1)/@성장(1) — 접두가 더 큼
    const groups = groupAndSortClusters(clusters, { minSeriesMembers: 1 });
    expect(groups.some((g) => g.label === '경제@')).toBe(true);
  });

  it('groupSortAndFillSatellites 경로에서도 @접미가 산다', () => {
    const clusters = [
      conflict('공공서비스', '공공 서비스'),
      conflict('미국서비스', '미국 서비스'),
    ];
    const groups = groupSortAndFillSatellites(clusters, new Map());
    expect(groups.some((g) => g.type === 'series' && g.label === '@서비스')).toBe(
      true,
    );
  });

  it('affix가 단음절이면 가@·@가 계열을 만들지 않는다', () => {
    const clusters = [
      conflict('가시장', '가 시장'),
      conflict('가경제', '가 경제'),
      conflict('시가', '시 가'),
      conflict('증가', '증 가'),
    ];
    const groups = groupAndSortClusters(clusters, { minSeriesMembers: 1 });
    const labels = groups
      .filter((g) => g.type === 'series')
      .map((g) => g.label);
    expect(labels).not.toContain('가@');
    expect(labels).not.toContain('@가');
  });

  it('@을하다·역할을하다 는 목록에 넣지 않는다', () => {
    const clusters = [
      conflict('역할을하다', '역할을 하다'),
      conflict('회사를하다', '회사를 하다'),
      conflict('공공서비스', '공공 서비스'),
      conflict('미국서비스', '미국 서비스'),
    ];
    const groups = groupSortAndFillSatellites(clusters, new Map());
    const keys = groups.flatMap((g) => g.clusters.map((c) => c.key));
    const labels = groups
      .filter((g) => g.type === 'series')
      .map((g) => g.label);
    expect(keys).not.toContain('역할을하다');
    expect(keys).not.toContain('회사를하다');
    expect(labels.some((l) => l.includes('을하다'))).toBe(false);
    expect(labels).toContain('@서비스');
  });

  it('금융@에서 @채움 단음절(금융업·금융학)은 처음부터 넣지 않는다', () => {
    const clusters = [
      conflict('금융시장', '금융 시장'),
      conflict('금융위기', '금융 위기'),
      conflict('금융업', '금융 업'),
      conflict('금융학', '금융 학'),
    ];
    const groups = groupSortAndFillSatellites(clusters, new Map());
    const keys = groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('금융업');
    expect(keys).not.toContain('금융학');
    expect(keys).toEqual(expect.arrayContaining(['금융시장', '금융위기']));
    const series = groups.find((g) => g.type === 'series' && g.affix === '금융');
    expect(series).toBeTruthy();
    expect(series.clusters.map((c) => c.key).sort()).toEqual([
      '금융시장',
      '금융위기',
    ]);
  });

  it('@채움에 숫자(기술 58)가 있으면 처음부터 넣지 않는다', () => {
    const clusters = [
      conflict('기술혁신', '기술 혁신'),
      conflict('기술개발', '기술 개발'),
      conflict('기술58', '기술 58'),
    ];
    const groups = groupSortAndFillSatellites(clusters, new Map());
    const keys = groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('기술58');
    expect(keys).toEqual(expect.arrayContaining(['기술혁신', '기술개발']));
  });
});

describe('sortClusterGroups — 용언 계열 발견 횟수', () => {
  it('용언 구간에서 발견 합계가 큰 계열이 앞이다(@보자 > @나가)', () => {
    const sorted = sortClusterGroups([
      {
        type: 'series',
        affix: '나가',
        affixType: 'suffix',
        label: '@나가',
        dictPos: 'predicate',
        clusters: [
          {
            key: '빠져나가',
            variants: ['빠져나가', '빠져 나가'],
            counts: { 빠져나가: 6, '빠져 나가': 6 },
            totalCount: 12,
          },
        ],
      },
      {
        type: 'series',
        affix: '보자',
        affixType: 'suffix',
        label: '@보자',
        dictPos: 'predicate',
        clusters: [
          {
            key: '살펴보자',
            variants: ['살펴보자', '살펴 보자'],
            counts: { 살펴보자: 134, '살펴 보자': 134 },
            totalCount: 268,
          },
        ],
      },
      {
        type: 'series',
        affix: '들어',
        affixType: 'prefix',
        label: '들어@',
        clusters: [
          {
            key: '들어보다',
            variants: ['들어보다', '들어 보다'],
            counts: { 들어보다: 50, '들어 보다': 53 },
            totalCount: 103,
          },
        ],
      },
    ]);
    const predLabels = sorted
      .filter(
        (g) =>
          g.type === 'series' &&
          (g.dictPos === 'predicate' || g.affix === '들어'),
      )
      .map((g) => g.label);
    expect(predLabels[0]).toBe('@보자');
    expect(predLabels).toEqual(['@보자', '들어@', '@나가']);
  });
});
