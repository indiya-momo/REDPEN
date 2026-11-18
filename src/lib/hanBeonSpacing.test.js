import { describe, expect, it } from 'vitest';
import { findHanBeonSpacingHits } from './hanBeonSpacing.js';

describe('세종 S2-2-2e 한 번/한번', () => {
  it('단한번 → 단 한 번', () => {
    expect(findHanBeonSpacingHits('단한번도')).toEqual([
      expect.objectContaining({
        matchedText: '단한번도',
        suggestedText: '단 한 번도',
      }),
    ]);
  });

  it('한번도 없 → 한 번도 없', () => {
    expect(findHanBeonSpacingHits('한번도 없었다')).toEqual([
      expect.objectContaining({
        matchedText: '한번도 없',
        suggestedText: '한 번도 없',
      }),
    ]);
  });

  it('막연 한번 해는 KEEP', () => {
    expect(findHanBeonSpacingHits('그거 한번 해볼래')).toEqual([]);
  });
});
