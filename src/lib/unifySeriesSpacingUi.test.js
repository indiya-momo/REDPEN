import { describe, expect, it } from 'vitest';
import {
  mergeUnifyChosenMaps,
  resolveSeriesChosenSpacing,
  sumClusterSpacingFindings,
} from './unifySeriesSpacingUi.js';

/** @param {Partial<import('./unifyCandidateDiscover.js').UnifySpacingCluster>} p */
function cluster(p) {
  return {
    key: p.key ?? 'k',
    variants: p.variants ?? [],
    counts: p.counts ?? {},
    occurrencesByVariant: {},
    recommendedUnify: p.recommendedUnify ?? '',
    totalCount: p.totalCount ?? 0,
    kind: 'conflict',
    ...p,
  };
}

describe('mergeUnifyChosenMaps', () => {
  it('soft 위에 확정이 이긴다', () => {
    const soft = new Map([
      ['a', '아 이'],
      ['b', '비 이'],
    ]);
    const reg = new Map([['a', '아이']]);
    const m = mergeUnifyChosenMaps(reg, soft);
    expect(m.get('a')).toBe('아이');
    expect(m.get('b')).toBe('비 이');
  });
});

describe('resolveSeriesChosenSpacing', () => {
  const group = {
    clusters: [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }, { key: 'e' }],
  };

  it('예외 1건이 있어도 soft 다수 방향을 유지', () => {
    const pre = new Map([
      ['a', '아 이'],
      ['b', '비 이'],
      ['c', '씨 이'],
      ['d', '디 이'],
      ['e', '이 이'],
    ]);
    const reg = new Map([['a', '아이']]);
    expect(resolveSeriesChosenSpacing(group, reg, pre)).toBe('spaced');
  });

  it('첫 키가 예외여도 다수결', () => {
    const pre = new Map([
      ['a', '아 이'],
      ['b', '비 이'],
    ]);
    const reg = new Map([['a', '아이']]);
    expect(
      resolveSeriesChosenSpacing(
        { clusters: [{ key: 'a' }, { key: 'b' }] },
        reg,
        pre,
      ),
    ).toBe('spaced');
  });

  it('확정만 동률이면 null', () => {
    expect(
      resolveSeriesChosenSpacing(
        { clusters: [{ key: 'a' }, { key: 'b' }] },
        new Map([
          ['a', '아이'],
          ['b', '비 이'],
        ]),
        new Map(),
      ),
    ).toBeNull();
  });
});

describe('sumClusterSpacingFindings', () => {
  const dongne = [
    cluster({
      key: '동네사람',
      variants: ['동네사람', '동네 사람'],
      counts: { 동네사람: 1, '동네 사람': 3 },
    }),
    cluster({
      key: '동네슈퍼마켓',
      variants: ['동네슈퍼마켓', '동네 슈퍼마켓'],
      counts: { 동네슈퍼마켓: 0, '동네 슈퍼마켓': 3 },
    }),
    cluster({
      key: '동네뒷길',
      variants: ['동네뒷길', '동네 뒷길'],
      counts: { 동네뒷길: 0, '동네 뒷길': 1 },
    }),
  ];

  const single = [
    cluster({
      key: '뒈져버려라',
      variants: ['뒈져 버려라', '뒈져버려라'],
      counts: { '뒈져 버려라': 2, 뒈져버려라: 1 },
    }),
  ];

  it('미선택이면 원고 그대로', () => {
    expect(sumClusterSpacingFindings(single)).toEqual({ glued: 1, spaced: 2 });
  });

  it('일괄 붙여쓰기 → 전체가 붙임', () => {
    expect(
      sumClusterSpacingFindings(single, {
        registeredVariants: new Map([['뒈져버려라', '뒈져버려라']]),
      }),
    ).toEqual({ glued: 3, spaced: 0 });
  });

  it('일괄 띄어쓰기 → 전체가 띄움', () => {
    expect(
      sumClusterSpacingFindings(single, {
        registeredVariants: new Map([['뒈져버려라', '뒈져 버려라']]),
      }),
    ).toEqual({ glued: 0, spaced: 3 });
  });

  it('soft만이면 전체 발견(확정 전)', () => {
    expect(
      sumClusterSpacingFindings(dongne, {
        seriesSpacing: 'spaced',
        registeredVariants: new Map(),
      }),
    ).toEqual({ glued: 1, spaced: 7 });
  });

  it('예외 1건만 확정 → 그 클러스터만 선택 방향으로', () => {
    expect(
      sumClusterSpacingFindings(dongne, {
        seriesSpacing: 'spaced',
        registeredVariants: new Map([['동네사람', '동네사람']]),
      }),
    ).toEqual({ glued: 4, spaced: 4 });
  });

  it('계열 전체를 띄움으로 확정하면 띄움만', () => {
    expect(
      sumClusterSpacingFindings(dongne, {
        registeredVariants: new Map([
          ['동네사람', '동네 사람'],
          ['동네슈퍼마켓', '동네 슈퍼마켓'],
          ['동네뒷길', '동네 뒷길'],
        ]),
      }),
    ).toEqual({ glued: 0, spaced: 8 });
  });

  it('PDF 숨김 키 제외', () => {
    expect(
      sumClusterSpacingFindings(dongne, {
        hiddenPdfKeys: new Set(['동네사람']),
      }),
    ).toEqual({ glued: 0, spaced: 4 });
  });
});
