import { describe, expect, it } from 'vitest';
import {
  attachAuxiliaryReviewHints,
  matchBonBojoStemForCluster,
} from './unifyAuxReview.js';
import { listBonBojoUnifyReviewStems } from './bonBojoRules.js';

describe('listBonBojoUnifyReviewStems', () => {
  it('시트 stems의 띄움·붙임 쌍을 만든다', () => {
    const stems = listBonBojoUnifyReviewStems();
    expect(stems.some((s) => s.spaced === '해 보' && s.glued === '해보')).toBe(
      true,
    );
    expect(stems.every((s) => /\s/.test(s.spaced))).toBe(true);
  });
});

describe('matchBonBojoStemForCluster', () => {
  it('해 보 / 해보 클러스터를 시트 stem에 연결한다', () => {
    const hit = matchBonBojoStemForCluster({
      key: '해보',
      variants: ['해보', '해 보'],
      counts: { 해보: 1, '해 보': 2 },
    });
    expect(hit?.glued).toBe('해보');
    expect(hit?.spaced).toBe('해 보');
  });

  it('만들어 내는처럼 stem이 어간에 붙은 경우도 잡는다', () => {
    const hit = matchBonBojoStemForCluster({
      key: '만들어내는',
      variants: ['만들어내는', '만들어 내는'],
      counts: { 만들어내는: 5, '만들어 내는': 1 },
    });
    expect(hit?.spaced).toBe('어 내');
    expect(hit?.itemId).toBe('verb-naeda');
  });

  it('만들어낸·만들어 낼도 긴 stem을 고른다', () => {
    expect(
      matchBonBojoStemForCluster({
        key: '만들어낸',
        variants: ['만들어 낸', '만들어낸'],
        counts: { '만들어 낸': 0, 만들어낸: 1 },
      })?.spaced,
    ).toBe('어 낸');
    expect(
      matchBonBojoStemForCluster({
        key: '만들어낼',
        variants: ['만들어 낼', '만들어낼'],
        counts: { '만들어 낼': 0, 만들어낼: 1 },
      })?.spaced,
    ).toBe('어 낼');
  });

  it('무관한 클러스터는 null', () => {
    expect(
      matchBonBojoStemForCluster({
        key: '뉴욕타임스',
        variants: ['뉴욕타임스', '뉴욕 타임스'],
        counts: { 뉴욕타임스: 1, '뉴욕 타임스': 3 },
      }),
    ).toBeNull();
  });
});

describe('attachAuxiliaryReviewHints', () => {
  it('해당 stem 후보에 auxReview를 붙인다', () => {
    const out = attachAuxiliaryReviewHints([
      {
        key: '해보',
        variants: ['해보', '해 보'],
        counts: { 해보: 1, '해 보': 2 },
        occurrencesByVariant: {},
        recommendedUnify: '해 보',
        totalCount: 3,
        kind: 'conflict',
      },
      {
        key: '뉴욕타임스',
        variants: ['뉴욕타임스', '뉴욕 타임스'],
        counts: { 뉴욕타임스: 1, '뉴욕 타임스': 3 },
        occurrencesByVariant: {},
        recommendedUnify: '뉴욕 타임스',
        totalCount: 4,
        kind: 'conflict',
      },
    ]);
    expect(out[0].auxReview?.status).toBe('review');
    expect(out[0].auxReview?.stemKey).toBe('해보');
    expect(out[1].auxReview).toBeUndefined();
  });
});
