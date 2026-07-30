import { describe, expect, it, vi } from 'vitest';
import {
  enqueueStdictPosTargets,
  lemmaCandidatesForConjugation,
  parseStdictSearchHits,
  queryStemForCluster,
  runStdictPosReviewOnClusterGroups,
  verdictFromStdictHits,
} from './unifyStdictPos.js';

describe('lemmaCandidatesForConjugation', () => {
  it('해 → 하다, 그 외는 +다', () => {
    expect(lemmaCandidatesForConjugation('가정해')).toEqual(['가정하다']);
    expect(lemmaCandidatesForConjugation('돌아가')).toEqual(['돌아가다']);
    expect(lemmaCandidatesForConjugation('생각해')).toEqual(['생각하다']);
  });
});

describe('queryStemForCluster', () => {
  it('보조용언 카드는 띄움 첫 어절을 쓴다', () => {
    expect(
      queryStemForCluster({
        key: '가정해보자',
        variants: ['가정해 보자', '가정해보자'],
        auxReview: { stemKey: '해보', stemSpaced: '해 보' },
      }),
    ).toBe('가정해');
  });
});

describe('verdictFromStdictHits', () => {
  it('동사·명사를 가른다', () => {
    expect(verdictFromStdictHits([{ word: '공개', pos: '명사' }])).toBe('noun');
    expect(verdictFromStdictHits([{ word: '그러다', pos: '동사' }])).toBe(
      'predicate',
    );
    expect(
      verdictFromStdictHits([
        { word: 'x', pos: '명사' },
        { word: 'x', pos: '동사' },
      ]),
    ).toBe('mixed');
    expect(verdictFromStdictHits([])).toBe('missing');
  });
});

describe('parseStdictSearchHits', () => {
  it('channel.item 품사를 읽는다', () => {
    const hits = parseStdictSearchHits({
      channel: {
        item: {
          word: '공개',
          sense: { pos: '명사', definition: '...' },
        },
      },
    });
    expect(hits).toEqual([{ word: '공개', pos: '명사' }]);
  });
});

describe('enqueueStdictPosTargets', () => {
  it('계열·용언 그룹을 큐에 넣는다', () => {
    const targets = enqueueStdictPosTargets([
      {
        type: 'series',
        affix: '공개',
        affixType: 'prefix',
        label: '공개@',
        clusters: [{ key: '공개시장', variants: ['공개 시장'] }],
      },
      {
        type: 'series',
        affix: '그러다',
        affixType: 'prefix',
        label: '그러다@',
        clusters: [{ key: '그러다보니', variants: ['그러다 보니'] }],
      },
    ]);
    expect(targets.map((t) => t.q).sort()).toEqual(['그러다', '공개'].sort());
    expect(targets.find((t) => t.q === '공개')?.allowLemmaTry).toBe(false);
  });
});

describe('runStdictPosReviewOnClusterGroups', () => {
  it('명사 계열 그러다만 용언 구간으로 옮긴다', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const q = decodeURIComponent(String(url).split('q=')[1] || '');
      const body =
        q === '그러다'
          ? {
              channel: {
                item: { word: '그러다', sense: { pos: '동사' } },
              },
            }
          : {
              channel: {
                item: { word: q, sense: { pos: '명사' } },
              },
            };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
      };
    });

    const groups = [
      {
        type: 'series',
        affix: '공개',
        affixType: 'prefix',
        label: '공개@',
        clusters: [{ key: '공개시장', variants: ['공개시장'] }],
      },
      {
        type: 'series',
        affix: '그러다',
        affixType: 'prefix',
        label: '그러다@',
        clusters: [{ key: '그러다보니', variants: ['그러다보니'] }],
      },
    ];

    const { groups: next, summary } = await runStdictPosReviewOnClusterGroups(
      groups,
      { fetchImpl },
    );
    const geuruda = next.find((g) => g.type === 'series' && g.affix === '그러다');
    const gonggae = next.find((g) => g.type === 'series' && g.affix === '공개');
    expect(geuruda?.dictPos).toBe('predicate');
    expect(gonggae?.dictPos).toBeUndefined();
    expect(summary.movedNounToPredicate.map((x) => x.label)).toEqual([
      '그러다@',
    ]);
    // 정렬: 명사 접두(공개) 먼저, 용언 계열(그러다) 뒤
    expect(next.map((g) => g.affix)).toEqual(['공개', '그러다']);
  });
});
