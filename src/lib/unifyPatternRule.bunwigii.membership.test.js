import { describe, it, expect } from 'vitest';

/**
 * enterPhase2와 동일한 membership 병합 (패널 로직 미러).
 * enrich가 비어도 find 행을 지우지 않는다.
 */
function mergeEnrichKeepFindMembership(nextGroups, enriched) {
  const byKey = new Map();
  for (const c of enriched) {
    if (c?.key) byKey.set(c.key, c);
  }
  return nextGroups
    .map((g) => ({
      ...g,
      clusters: (g.clusters ?? []).map((c) => {
        const en = c?.key ? byKey.get(c.key) : null;
        if (!en) return c;
        return {
          ...c,
          kind: c.kind === 'conflict' ? 'conflict' : en.kind || c.kind,
          recommendedUnify: c.recommendedUnify || en.recommendedUnify,
          occurrencesByVariant:
            en.occurrencesByVariant ?? c.occurrencesByVariant,
          totalCount: Math.max(c.totalCount || 0, en.totalCount || 0),
          counts: { ...(c.counts ?? {}), ...(en.counts ?? {}) },
          variants: c.variants?.length ? c.variants : en.variants,
        };
      }),
      compliantForms: (g.compliantForms ?? [])
        .map((c) => byKey.get(c.key) ?? c)
        .filter((c) => (c?.totalCount ?? 0) > 0),
    }))
    .filter(
      (g) =>
        (g.clusters?.length ?? 0) > 0 || (g.compliantForms?.length ?? 0) > 0,
    );
}

describe('2차 @ membership = find 권위', () => {
  it('enrich가 null·0건이어도 분위기경제 행 유지', () => {
    const nextGroups = [
      {
        template: '@경제',
        clusters: [
          {
            key: '분위기경제',
            variants: ['분위기경제', '분위기 경제'],
            counts: { '분위기 경제': 10, 분위기경제: 0 },
            totalCount: 10,
            kind: 'conflict',
            recommendedUnify: '분위기경제',
          },
          {
            key: '고전파경제',
            variants: ['고전파경제', '고전파 경제'],
            counts: { '고전파 경제': 6, 고전파경제: 0 },
            totalCount: 6,
            kind: 'conflict',
            recommendedUnify: '고전파경제',
          },
        ],
        compliantForms: [],
      },
    ];

    // enrich가 분위기경제를 반환하지 않음 (구동작이면 목록에서 사라짐)
    const enrichedEmpty = [
      {
        key: '고전파경제',
        variants: ['고전파경제', '고전파 경제'],
        counts: { '고전파 경제': 6 },
        totalCount: 6,
        kind: 'conflict',
      },
    ];

    const byKey = new Map(enrichedEmpty.map((c) => [c.key, c]));
    const oldStyle = nextGroups.map((g) => ({
      ...g,
      clusters: (g.clusters ?? [])
        .map((c) => byKey.get(c.key))
        .filter((c) => (c?.totalCount ?? 0) > 0),
    }));
    const newStyle = mergeEnrichKeepFindMembership(nextGroups, enrichedEmpty);

    expect(
      oldStyle
        .find((g) => g.template === '@경제')
        ?.clusters?.some((c) => c.key === '분위기경제'),
    ).toBe(false);
    expect(
      newStyle
        .find((g) => g.template === '@경제')
        ?.clusters?.some((c) => c.key === '분위기경제'),
    ).toBe(true);
  });
});
