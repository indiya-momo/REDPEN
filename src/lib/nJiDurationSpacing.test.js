import { describe, expect, it } from 'vitest';
import { findNJiDurationSpacingHits } from './nJiDurationSpacing.js';

describe('PR #3 -ㄴ지 기간', () => {
  it('F05 떠난지 오래 → 떠난 지 오래', () => {
    expect(findNJiDurationSpacingHits('떠난지 오래')).toEqual([
      expect.objectContaining({
        matchedText: '떠난지',
        suggestedText: '떠난 지',
      }),
    ]);
  });

  it('F06 온지 3년 됐다 → 온 지', () => {
    expect(findNJiDurationSpacingHits('온지 3년 됐다')).toEqual([
      expect.objectContaining({
        matchedText: '온지',
        suggestedText: '온 지',
      }),
    ]);
  });

  it('어떤지 몰라 KEEP', () => {
    expect(findNJiDurationSpacingHits('어떤지 몰라')).toEqual([]);
  });
});
