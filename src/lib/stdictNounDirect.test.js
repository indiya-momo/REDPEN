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

  it('등재 명사 19개는 번호가 있다', () => {
    expect(Object.keys(NOUN_DIRECT_WORD_NO)).toHaveLength(19);
  });
});
