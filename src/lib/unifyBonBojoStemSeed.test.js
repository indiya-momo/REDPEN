import { describe, expect, it } from 'vitest';
import {
  BON_BOJO_SEED_KEY_PREFIX,
  bonBojoSeedClusterKey,
  buildBonBojoSeedCluster,
  collectBonBojoStemPairInDocument,
  existingClusterCoversBonBojoStem,
  gluedStemBoundaryRegExp,
  seedBonBojoStemClustersIntoList,
  spacedStemBoundaryRegExp,
} from './unifyBonBojoStemSeed.js';

describe('unifyBonBojoStemSeed boundaries', () => {
  it('붙임 stem은 한글 음절 경계에서만 센다', () => {
    const re = gluedStemBoundaryRegExp('해보');
    expect([...('해보았다'.matchAll(re))].map((m) => m[0])).toEqual([]);
    expect([...('해보 했다'.matchAll(re))].map((m) => m[0])).toEqual(['해보']);
    expect([...('다시해보'.matchAll(re))].map((m) => m[0])).toEqual([]);
    expect([...('해보'.matchAll(re))].map((m) => m[0])).toEqual(['해보']);
  });

  it('띄움 stem도 바깥 한글 경계를 지킨다', () => {
    const re = spacedStemBoundaryRegExp('해 보');
    expect([...('해 보았다'.matchAll(re))].map((m) => m[0])).toEqual([]);
    expect([...('해 보 했다'.matchAll(re))].map((m) => m[0])).toEqual([
      '해 보',
    ]);
  });
});

describe('existingClusterCoversBonBojoStem', () => {
  const stem = { spaced: '해 보', glued: '해보' };

  it('기존 클러스터 variants에 stem이 있으면 커버', () => {
    expect(
      existingClusterCoversBonBojoStem(
        [
          {
            key: '해보',
            variants: ['해보', '해 보'],
            counts: { 해보: 1, '해 보': 1 },
          },
        ],
        stem,
      ),
    ).toBe(true);
  });

  it('긴 표기에 stem이 포함되면 커버(시드 생략)', () => {
    expect(
      existingClusterCoversBonBojoStem(
        [
          {
            key: '만들어내는',
            variants: ['만들어내는', '만들어 내는'],
            counts: { 만들어내는: 2, '만들어 내는': 1 },
          },
        ],
        { spaced: '어 내', glued: '어내' },
      ),
    ).toBe(true);
  });

  it('무관 클러스터만 있으면 커버 아님', () => {
    expect(
      existingClusterCoversBonBojoStem(
        [
          {
            key: '뉴욕타임스',
            variants: ['뉴욕타임스', '뉴욕 타임스'],
            counts: { 뉴욕타임스: 1, '뉴욕 타임스': 1 },
          },
        ],
        stem,
      ),
    ).toBe(false);
  });
});

describe('seedBonBojoStemClustersIntoList', () => {
  it('붙임·띄움이 둘 다 있고 기존 매칭이 없으면 시드한다', () => {
    const pages = [{ pageNum: 1, text: '해 보 했다. 해보 했다.' }];
    const out = seedBonBojoStemClustersIntoList([], pages, { maxSeeds: 5 });
    const hit = out.find((c) => c.key === bonBojoSeedClusterKey('해보'));
    expect(hit).toBeTruthy();
    expect(hit?.kind).toBe('conflict');
    expect(hit?.auxReview?.itemId).toBe('verb-boda1');
    expect(hit?.key.startsWith(BON_BOJO_SEED_KEY_PREFIX)).toBe(true);
    expect(hit?.counts['해보']).toBeGreaterThan(0);
    expect(hit?.counts['해 보']).toBeGreaterThan(0);
  });

  it('기존 클러스터는 그대로 두고 시드하지 않는다', () => {
    const existing = {
      key: '해보',
      variants: ['해보', '해 보'],
      counts: { 해보: 1, '해 보': 2 },
      occurrencesByVariant: {},
      recommendedUnify: '해 보',
      totalCount: 3,
      kind: /** @type {const} */ ('conflict'),
    };
    const pages = [{ pageNum: 1, text: '해 보 했다. 해보 했다.' }];
    const out = seedBonBojoStemClustersIntoList([existing], pages, {
      maxSeeds: 5,
    });
    expect(out[0]).toEqual(existing);
    expect(out.some((c) => c.key === bonBojoSeedClusterKey('해보'))).toBe(
      false,
    );
  });

  it('한쪽만 있으면 시드하지 않는다', () => {
    const pair = collectBonBojoStemPairInDocument(
      [{ pageNum: 1, text: '해보 했다. 해보 또.' }],
      { spaced: '해 보', glued: '해보' },
    );
    expect(pair.gluedCount).toBeGreaterThan(0);
    expect(pair.spacedCount).toBe(0);
    expect(
      buildBonBojoSeedCluster({
        ...pair,
        itemId: 'verb-boda1',
      }),
    ).toBeNull();
  });
});
