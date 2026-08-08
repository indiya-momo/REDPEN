import { describe, expect, it } from 'vitest';
import { runUnifyListPhase2Filters } from './unifyNoisePhase2.js';

describe('runUnifyListPhase2Filters', () => {
  it('DocSuffix로 로그램 지출을 걸러내고 groups를 반환한다', async () => {
    const groups = [
      {
        type: 'single',
        clusters: [
          {
            key: '로그램지출',
            variants: ['로그램지출', '로그램 지출'],
            counts: { 로그램지출: 1, '로그램 지출': 1 },
            kind: 'conflict',
            totalCount: 2,
          },
          {
            key: '경제성장',
            variants: ['경제성장', '경제 성장'],
            counts: { 경제성장: 1, '경제 성장': 1 },
            kind: 'conflict',
            totalCount: 2,
          },
        ],
      },
    ];
    const pageTexts = [
      {
        pageNum: 1,
        textLayout: '로그램 지출',
        text: '프로그램지출 로그램 지출',
      },
    ];
    const out = await runUnifyListPhase2Filters(groups, pageTexts);
    expect(out.docSuffix.dropped).toBeGreaterThanOrEqual(1);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('로그램지출');
    expect(keys).toContain('경제성장');
  });
});
