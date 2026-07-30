import { describe, expect, it } from 'vitest';
import {
  groupAndSortClusters,
  groupSortAndFillSatellites,
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
});
