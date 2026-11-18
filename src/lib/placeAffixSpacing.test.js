import { describe, expect, it } from 'vitest';
import { findPlaceAffixSpacingHits } from './placeAffixSpacing.js';

describe('세종 S2-3-5·6 지명·접미', () => {
  it('중앙 아시아 → 중앙아시아', () => {
    expect(findPlaceAffixSpacingHits('중앙 아시아')).toEqual([
      expect.objectContaining({
        matchedText: '중앙 아시아',
        suggestedText: '중앙아시아',
      }),
    ]);
  });

  it('한국 인 → 한국인', () => {
    expect(findPlaceAffixSpacingHits('한국 인이다')).toEqual([
      expect.objectContaining({
        suggestedText: '한국인',
      }),
    ]);
  });

  it('이미 붙은 남아메리카 KEEP', () => {
    expect(findPlaceAffixSpacingHits('남아메리카')).toEqual([]);
  });
});
