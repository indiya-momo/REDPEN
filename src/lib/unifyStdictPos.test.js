import { describe, expect, it, vi } from 'vitest';
import {
  buildStdictQueryList,
  enqueueStdictPosTargets,
  lemmaCandidatesForConjugation,
  parseStdictSearchHits,
  queryStemForCluster,
  runStdictPosReviewOnClusterGroups,
  verdictFromStdictHits,
} from './unifyStdictPos.js';

describe('lemmaCandidatesForConjugation', () => {
  it('활용형 → 사전형', () => {
    expect(lemmaCandidatesForConjugation('가정해')).toEqual(['가정하다']);
    expect(lemmaCandidatesForConjugation('생각해')).toEqual(['생각하다']);
    expect(lemmaCandidatesForConjugation('돌아가')).toEqual(['돌아가다']);
    expect(lemmaCandidatesForConjugation('날아')).toEqual(['날다']);
    expect(lemmaCandidatesForConjugation('들어')).toEqual(['들다']);
    expect(lemmaCandidatesForConjugation('대어')).toEqual(['대다']);
    expect(lemmaCandidatesForConjugation('밀려')).toEqual(['밀리다', '밀다']);
    expect(lemmaCandidatesForConjugation('만들어')).toEqual(['만들다']);
    expect(lemmaCandidatesForConjugation('빠져')).toEqual(['빠지다', '빠다']);
    expect(lemmaCandidatesForConjugation('깨져')).toEqual(['깨지다', '깨다']);
    expect(lemmaCandidatesForConjugation('계산해보자')).toEqual(['계산하다']);
    expect(lemmaCandidatesForConjugation('답해보자')).toEqual(['답하다']);
    expect(lemmaCandidatesForConjugation('계산해')).toEqual(['계산하다']);
  });

  it('이미 다로 끝나면 후보 없음(호출측이 그대로 조회)', () => {
    expect(lemmaCandidatesForConjugation('그러다')).toEqual([]);
  });
});

describe('buildStdictQueryList', () => {
  it('명사는 그대로, 용언은 사전형 우선', () => {
    expect(
      buildStdictQueryList({
        id: 'n',
        q: '공개',
        allowLemmaTry: false,
        kind: 'series',
        label: '공개@',
        ruleKind: 'certain_noun',
      }),
    ).toEqual(['공개']);
    expect(
      buildStdictQueryList({
        id: 'v',
        q: '날아',
        allowLemmaTry: true,
        kind: 'series',
        label: '날아@',
        ruleKind: 'ambiguous',
      }),
    ).toEqual(['날다', '날아']);
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

  it('붙임형 계산해보자·답해보자는 본용언 쪽(…해)만', () => {
    expect(
      queryStemForCluster({
        key: '계산해보자',
        variants: ['계산해보자'],
        auxReview: { stemKey: '해보', stemSpaced: '해 보' },
      }),
    ).toBe('계산해');
    expect(
      queryStemForCluster({
        key: '답해보자',
        variants: ['답해 보자', '답해보자'],
        auxReview: { stemKey: '해보', stemSpaced: '해 보' },
      }),
    ).toBe('답해');
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

  it('품사가 item.pos 에만 있어도 읽는다', () => {
    const hits = parseStdictSearchHits({
      channel: {
        item: {
          word: '그러다',
          pos: '동사',
          sense: { definition: '그리하다의 준말.' },
        },
      },
    });
    expect(hits).toEqual([{ word: '그러다', pos: '동사' }]);
    expect(verdictFromStdictHits(hits)).toBe('predicate');
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

  it('용언은 사전형(날다·대다)으로 조회하고 명사 exact에 안 묶인다', async () => {
    const seen = [];
    const fetchImpl = vi.fn(async (url) => {
      const q = decodeURIComponent(String(url).split('q=')[1] || '');
      seen.push(q);
      /** @type {Record<string, { word: string, pos: string }>} */
      const table = {
        날다: { word: '날다', pos: '동사' },
        대다: { word: '대다', pos: '동사' },
        대어: { word: '대어', pos: '명사' },
        공개: { word: '공개', pos: '명사' },
      };
      const hit = table[q];
      const body = hit
        ? { channel: { item: { word: hit.word, pos: hit.pos, sense: {} } } }
        : { channel: { item: [] } };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
      };
    });

    const { summary } = await runStdictPosReviewOnClusterGroups(
      [
        {
          type: 'series',
          affix: '공개',
          affixType: 'prefix',
          label: '공개@',
          dictPos: 'noun',
          clusters: [{ key: '공개시장', variants: ['공개 시장'] }],
        },
        {
          type: 'series',
          affix: '날아',
          affixType: 'prefix',
          label: '날아@',
          dictPos: 'predicate',
          clusters: [{ key: '날아보', variants: ['날아 보'] }],
        },
        {
          type: 'series',
          affix: '대어',
          affixType: 'prefix',
          label: '대어@',
          dictPos: 'predicate',
          clusters: [{ key: '대어보', variants: ['대어 보'] }],
        },
      ],
      { fetchImpl },
    );

    expect(seen).toContain('날다');
    expect(seen).toContain('대다');
    expect(seen).toContain('공개');
    // 용언 경로는 사전형 히트 시 활용형·명사 exact에 안 묶임
    expect(seen.filter((q) => q === '대어')).toHaveLength(0);
    expect(summary.confirmedPredicate.map((x) => x.label).sort()).toEqual([
      '날아@',
      '대어@',
    ]);
    expect(summary.confirmedNoun.map((x) => x.label)).toEqual(['공개@']);
  });
});
