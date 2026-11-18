import { describe, expect, it } from 'vitest';
import { findDaeumNalSpacingHits } from './daeumNalSpacing.js';

describe('세종 S2-2-45 다음날/다음 날', () => {
  it('그다음날 → 그 다음 날 (confirm)', () => {
    expect(findDaeumNalSpacingHits('그다음날 만났다')).toEqual([
      expect.objectContaining({
        matchedText: '그다음날',
        suggestedText: '그 다음 날',
        kind: 'confirm-다음-날',
      }),
    ]);
  });

  it('생일다음날 → 생일 다음 날', () => {
    expect(findDaeumNalSpacingHits('생일다음날')).toEqual([
      expect.objectContaining({
        suggestedText: '생일 다음 날',
      }),
    ]);
  });

  it('막연 다음날만 있으면 KEEP', () => {
    expect(findDaeumNalSpacingHits('다음날 보자')).toEqual([]);
  });
});
