import { describe, expect, it } from 'vitest';
import { findNBaDependentNounHits } from './nBaDependentNoun.js';

describe('세종 S2-2-40 -ㄴ바', () => {
  it('어찌할바를 → 어찌할 바를', () => {
    expect(findNBaDependentNounHits('어찌할바를 모르겠다')).toEqual([
      expect.objectContaining({
        matchedText: '어찌할바',
        suggestedText: '어찌할 바',
      }),
    ]);
  });

  it('K05 말한바와 같이 KEEP', () => {
    expect(findNBaDependentNounHits('말한바와 같이')).toEqual([]);
  });

  it('일인바 KEEP', () => {
    expect(findNBaDependentNounHits('내가 한 일인바 책임진다')).toEqual([]);
  });

  it('아르바이트 알바는 스킵', () => {
    expect(findNBaDependentNounHits('알바를 구한다')).toEqual([]);
  });
});
