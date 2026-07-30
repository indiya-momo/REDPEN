import { describe, expect, it } from 'vitest';
import {
  enqueuePredicateSlmTargets,
  predicateSeriesTargetId,
} from './enqueue.js';
import {
  shouldDropAsNonPredicate,
  shouldMarkPredicateNeedsReview,
  parsePredicateSlmFromText,
} from './parse.js';
import { runPredicateSlmReviewOnClusterGroups } from './filter.js';
import { noopPredicateRunner } from './runner/noopRunner.js';

describe('parsePredicateSlm', () => {
  it('JSON에서 isPredicate를 읽는다', () => {
    const r = parsePredicateSlmFromText(
      '{"id":"개의","isPredicate":false,"confidence":"high"}',
      '개의',
    );
    expect(r?.isPredicate).toBe(false);
    expect(shouldDropAsNonPredicate(r)).toBe(true);
  });

  it('실패·low는 삭제하지 않고 검토 필요로 본다', () => {
    expect(
      shouldMarkPredicateNeedsReview({
        id: 'x',
        isPredicate: true,
        confidence: 'low',
        failed: true,
      }),
    ).toBe(true);
    expect(
      shouldDropAsNonPredicate({
        id: 'x',
        isPredicate: false,
        confidence: 'medium',
      }),
    ).toBe(false);
  });
});

describe('enqueuePredicateSlmTargets', () => {
  it('용언 계열·predicate 단일을 넣고 auxReview·명사 계열은 뺀다', () => {
    const { forSlm } = enqueuePredicateSlmTargets([
      {
        type: 'series',
        affixType: 'prefix',
        affix: '문화',
        label: '문화@',
        clusters: [{ key: '문화경제', variants: ['문화 경제'], counts: {} }],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '만들어',
        label: '만들어@',
        clusters: [{ key: '만들어내다', variants: ['만들어 내다'], counts: {} }],
      },
      {
        type: 'predicate',
        clusters: [
          {
            key: '가정해보',
            variants: ['가정해 보'],
            counts: {},
            auxReview: { status: 'review', stemSpaced: '가정해 보' },
          },
          { key: '돌아가', variants: ['돌아 가'], counts: {} },
        ],
      },
    ]);
    expect(forSlm.map((r) => r.id)).toEqual([
      'series:prefix:만들어',
      '돌아가',
    ]);
  });

  it('cap 초과분은 cappedOut으로 분리한다', () => {
    const groups = [
      {
        type: 'predicate',
        clusters: Array.from({ length: 12 }, (_, i) => ({
          key: `만들어${i}`,
          variants: [`만들어 ${i}`],
          counts: {},
        })),
      },
    ];
    // looksLikePredicateKey('만들어0') — ends with digit stripped? hangul only — 만들어 + digit removed → 만들어
    // hangulKey removes non-hangul so key 만들어0 → 만들어, looksLike true
    const { forSlm, cappedOut } = enqueuePredicateSlmTargets(groups, {
      cap: 10,
    });
    expect(forSlm).toHaveLength(10);
    expect(cappedOut).toHaveLength(2);
  });
});

describe('runPredicateSlmReviewOnClusterGroups', () => {
  it('non_predicate면 계열을 목록에서 제거한다', async () => {
    const groups = [
      {
        type: 'series',
        affixType: 'prefix',
        affix: '만들어',
        label: '만들어@',
        clusters: [
          {
            key: '만들어내',
            variants: ['만들어 내'],
            counts: { '만들어 내': 1 },
            totalCount: 1,
          },
        ],
      },
      {
        type: 'single',
        clusters: [
          {
            key: '세계경제',
            variants: ['세계 경제', '세계경제'],
            counts: { '세계 경제': 1, 세계경제: 1 },
            totalCount: 2,
          },
        ],
      },
    ];
    const result = await runPredicateSlmReviewOnClusterGroups(groups, {
      runner: noopPredicateRunner,
      runnerOpts: { mode: 'non_predicate' },
    });
    expect(result.groups.map((g) => g.type)).toEqual(['single']);
    expect(result.summary.dropped.map((d) => d.label)).toEqual(['만들어']);
    expect(result.drop.seriesIds).toEqual([
      predicateSeriesTargetId(groups[0]),
    ]);
  });

  it('fail면 삭제하지 않고 검토 필요를 붙인다', async () => {
    const groups = [
      {
        type: 'predicate',
        clusters: [
          {
            key: '돌아가',
            variants: ['돌아 가'],
            counts: { '돌아 가': 1 },
            totalCount: 1,
          },
        ],
      },
    ];
    const result = await runPredicateSlmReviewOnClusterGroups(groups, {
      runner: noopPredicateRunner,
      runnerOpts: { mode: 'fail' },
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].clusters[0].predicateReview?.status).toBe(
      'needs_review',
    );
    expect(result.summary.needsReview).toHaveLength(1);
  });
});
