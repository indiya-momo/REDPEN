import { describe, expect, it } from 'vitest';
import {
  NOUN_DIRECT_WORD_NO,
  pickNounCodes,
} from '../../scripts/lib/stdict-link-index-core.mjs';

describe('pickNounCodes', () => {
  it('도중은 길을 가는 중간만 남긴다', () => {
    expect(
      pickNounCodes('도중', [
        { code: 413053 },
        { code: 87940 },
        { code: 413054 },
        { code: 87944 },
      ]),
    ).toEqual([413054]);
  });

  it('고른 번호가 후보에 없으면 후보를 그대로 둔다', () => {
    expect(pickNounCodes('도중', [{ code: 1 }, { code: 2 }])).toEqual([1, 2]);
  });

  it('맵에 없는 말은 후보 전부', () => {
    expect(pickNounCodes('그중', [{ code: 9 }])).toEqual([9]);
    expect(pickNounCodes('그중', [{ code: 9 }, { code: 3 }])).toEqual([3, 9]);
  });

  it('하나로 직결하는 등재 명사는 번호가 있다(번호별 링크로 옮긴 말은 뺀다)', () => {
    expect(Object.keys(NOUN_DIRECT_WORD_NO)).toHaveLength(14);
    for (const w of ['신소리', '애저녁', '경제권', '호박색', '선소리']) {
      expect(NOUN_DIRECT_WORD_NO[w], w).toBeUndefined();
    }
  });

  it('번호별 링크 5개는 후보를 모두 남긴다', () => {
    expect(pickNounCodes('선소리', [{ code: 178012 }, { code: 178008 }, { code: 178010 }])).toEqual([
      178008, 178010, 178012,
    ]);
    expect(pickNounCodes('경제권', [{ code: 21153 }, { code: 21152 }])).toEqual([21152, 21153]);
  });

  it('신소리는 후보를 고르지 않고 둘 다 남긴다', () => {
    expect(pickNounCodes('신소리', [{ code: 453792 }, { code: 209783 }])).toEqual([209783, 453792]);
  });
});
