import { describe, expect, it } from 'vitest';
import { attachJosaReviewHints, classifyJosaReviewTier } from './unifyJosaReview.js';
import {
  JOSA_SLM_BATCH_CAP,
  partitionJosaSlmQueue,
  sortClustersForJosaSlmBatch,
  filterJosaReviewBySlm,
  mergeReviewedClustersIntoGroups,
  noopRunner,
  shouldPromoteJosaReview,
  normalizeSlmReviewResult,
} from './unifyJosaReviewSlm/index.js';

describe('classifyJosaReviewTier', () => {
  it('high·low·risky를 구분한다', () => {
    expect(classifyJosaReviewTier('이며')).toBe('high');
    expect(classifyJosaReviewTier('하도록')).toBe('high');
    expect(classifyJosaReviewTier('에서')).toBe('low');
    expect(classifyJosaReviewTier('은')).toBe('risky');
    expect(classifyJosaReviewTier('은', { stemMismatch: true })).toBe('risky');
  });
});

describe('sortClustersForJosaSlmBatch', () => {
  it('totalCount 내림차순, 동점이면 key 가나다', () => {
    const sorted = sortClustersForJosaSlmBatch([
      { key: '가나', totalCount: 1 },
      { key: '다라', totalCount: 3 },
      { key: '나다', totalCount: 3 },
    ]);
    expect(sorted.map((c) => c.key)).toEqual(['나다', '다라', '가나']);
  });
});

describe('partitionJosaSlmQueue', () => {
  const mk = (key, tier, extra = {}) => ({
    key,
    totalCount: extra.totalCount ?? 1,
    josaReviewCandidate: {
      stemKey: 'stem',
      stemSpaced: 'stem',
      suffix: '은',
      tier,
      peerKeys: [],
    },
    ...extra,
  });

  it('auxReview는 SLM 파티션에서 제외한다', () => {
    const clusters = [
      mk('해보', 'risky', {
        auxReview: { status: 'review', stemKey: '해보' },
      }),
      mk('역학은', 'risky'),
    ];
    const part = partitionJosaSlmQueue(clusters);
    expect(part.excludedAux.map((c) => c.key)).toEqual(['해보']);
    expect(part.riskyForSlm.map((q) => q.cluster.key)).toEqual(['역학은']);
  });

  it('high·low는 risky 큐에 넣지 않는다', () => {
    const part = partitionJosaSlmQueue([
      mk('활동이며', 'high', { totalCount: 5 }),
      mk('경제정책에서', 'low', { totalCount: 10 }),
      mk('역학은', 'risky', { totalCount: 2 }),
    ]);
    expect(part.high.map((c) => c.key)).toEqual(['활동이며']);
    expect(part.low.map((c) => c.key)).toEqual(['경제정책에서']);
    expect(part.riskyForSlm.map((q) => q.cluster.key)).toEqual(['역학은']);
  });

  it('risky는 cap 초과분을 riskyDropped로 분리한다', () => {
    const risky = Array.from({ length: JOSA_SLM_BATCH_CAP + 3 }, (_, i) =>
      mk(`키${String(i).padStart(2, '0')}`, 'risky', { totalCount: 100 - i }),
    );
    const part = partitionJosaSlmQueue(risky);
    expect(part.riskyForSlm).toHaveLength(JOSA_SLM_BATCH_CAP);
    expect(part.riskyDropped).toHaveLength(3);
    expect(part.riskyForSlm[0].cluster.key).toBe('키00');
    expect(part.riskyDropped[0].key).toBe('키50');
  });

  it('attachJosaReviewHints 결과를 tier별로 파티션한다', () => {
    const mkCluster = (key, spaced, glued) => ({
      key,
      variants: [glued, spaced],
      counts: { [glued]: 1, [spaced]: 1 },
      occurrencesByVariant: {},
      recommendedUnify: glued,
      totalCount: 2,
      kind: 'conflict',
    });
    const hinted = attachJosaReviewHints([
      mkCluster('활동이며', '활동 이며', '활동이며'),
      mkCluster('경제정책에서', '경제 정책에서', '경제정책에서'),
      mkCluster('역학은', '역학 은', '역학은'),
    ]);
    const part = partitionJosaSlmQueue(hinted);
    expect(part.high[0]?.josaReviewCandidate?.tier).toBe('high');
    expect(part.low[0]?.josaReviewCandidate?.tier).toBe('low');
    expect(part.riskyForSlm[0]?.cluster.josaReviewCandidate?.tier).toBe('risky');
    expect(part.riskyForSlm[0]?.cluster.josaReview).toBeDefined();
  });
});

describe('shouldPromoteJosaReview', () => {
  it('high + josa_or_suffix + isBoundary 만 승격', () => {
    expect(
      shouldPromoteJosaReview({
        id: 'a',
        isBoundary: true,
        kind: 'josa_or_suffix',
        confidence: 'high',
      }),
    ).toBe(true);
    expect(
      shouldPromoteJosaReview({
        id: 'a',
        isBoundary: true,
        kind: 'josa_or_suffix',
        confidence: 'medium',
      }),
    ).toBe(false);
    expect(
      shouldPromoteJosaReview({
        id: 'a',
        isBoundary: false,
        kind: 'compound_word',
        confidence: 'high',
      }),
    ).toBe(false);
  });
});

describe('normalizeSlmReviewResult', () => {
  it('유효한 JSON만 통과', () => {
    expect(
      normalizeSlmReviewResult({
        id: '역학은',
        isBoundary: true,
        kind: 'josa_or_suffix',
        confidence: 'high',
      })?.id,
    ).toBe('역학은');
    expect(normalizeSlmReviewResult({ id: 'x', kind: 'nope', confidence: 'high' })).toBeNull();
  });
});

describe('mergeReviewedClustersIntoGroups', () => {
  it('reviewedByKey로 클러스터를 덮어쓴다', () => {
    const base = [
      {
        type: /** @type {const} */ ('single'),
        clusters: [{ key: 'a' }],
      },
    ];
    const reviewed = new Map([
      [
        'a',
        {
          key: 'a',
          josaReview: {
            status: /** @type {const} */ ('review'),
            stemKey: 'x',
            peerKeys: [],
          },
        },
      ],
    ]);
    const out = mergeReviewedClustersIntoGroups(base, reviewed);
    expect(out[0].clusters[0].josaReview?.status).toBe('review');
  });
});

describe('filterJosaReviewBySlm', () => {
  const mk = (key, tier, extra = {}) => ({
    key,
    variants: [key, ` ${key}`],
    counts: { [key]: 1 },
    totalCount: extra.totalCount ?? 1,
    josaReviewCandidate: {
      stemKey: 'stem',
      stemSpaced: 'stem',
      suffix: tier === 'high' ? '이며' : '은',
      tier,
      peerKeys: [],
    },
    josaReview: {
      stemKey: 'stem',
      peerKeys: [],
      status: 'review',
    },
    ...extra,
  });

  it('high·low는 SLM 없이 josaReview 유지', async () => {
    const out = await filterJosaReviewBySlm([
      mk('활동이며', 'high'),
      mk('경제에서', 'low', { josaReviewCandidate: { stemKey: '경제', stemSpaced: '경제', suffix: '에서', tier: 'low', peerKeys: [] } }),
    ]);
    expect(out[0].josaReview?.status).toBe('review');
    expect(out[1].josaReview?.status).toBe('review');
  });

  it('risky + noop approve → josaReview 승격', async () => {
    const out = await filterJosaReviewBySlm([mk('역학은', 'risky')], {
      runner: noopRunner,
    });
    expect(out[0].josaReview?.status).toBe('review');
  });

  it('risky + noop reject → josaReview 제거', async () => {
    const out = await filterJosaReviewBySlm([mk('역학은', 'risky')], {
      runner: noopRunner,
      runnerOpts: { mode: 'reject' },
    });
    expect(out[0].josaReview).toBeUndefined();
  });

  it('risky cap 초과분은 josaReview 제거', async () => {
    const risky = Array.from({ length: JOSA_SLM_BATCH_CAP + 1 }, (_, i) =>
      mk(`키${i}`, 'risky', { totalCount: 100 - i }),
    );
    const out = await filterJosaReviewBySlm(risky, { runner: noopRunner });
    expect(out[0].josaReview?.status).toBe('review');
    expect(out[JOSA_SLM_BATCH_CAP].josaReview).toBeUndefined();
  });
});
