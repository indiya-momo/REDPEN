import { describe, expect, it } from 'vitest';
import {
  applyUnifyListReviewMarks,
  buildUnifyListGroups,
  finalizeUnifyListGroups,
} from './unifyFindListPipeline.js';

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

describe('unifyFindListPipeline', () => {
  it('buildUnifyListGroups: raw 없으면 빈 배열', () => {
    expect(
      buildUnifyListGroups(
        [conflict('경제학자', '경제 학자')],
        null,
        [{ pageNum: 1, text: '경제학자' }],
      ),
    ).toEqual([]);
  });

  it('buildUnifyListGroups: 동기 조립이 예외 없이 배열을 반환', () => {
    const clusters = [
      conflict('공공서비스', '공공 서비스'),
      conflict('미국서비스', '미국 서비스'),
    ];
    const rawByKey = new Map(
      clusters.map((c) => [c.key, { counts: c.counts, totalCount: c.totalCount }]),
    );
    const out = buildUnifyListGroups(clusters, rawByKey, [
      { pageNum: 1, text: '공공서비스 공공 서비스 미국서비스 미국 서비스' },
    ]);
    expect(Array.isArray(out)).toBe(true);
  });

  it('applyUnifyListReviewMarks / finalize: 배열을 반환', () => {
    const groups = [
      {
        type: 'single',
        clusters: [conflict('골드만삭스', '골드만 삭스')],
      },
    ];
    expect(Array.isArray(applyUnifyListReviewMarks(groups, {}))).toBe(true);
    expect(
      Array.isArray(
        finalizeUnifyListGroups(groups, [
          { pageNum: 1, text: '골드만삭스 골드만 삭스' },
        ]),
      ),
    ).toBe(true);
  });
});
