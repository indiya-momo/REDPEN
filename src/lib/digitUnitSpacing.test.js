import { describe, expect, it } from 'vitest';
import { findDigitUnitSpacingHits } from './digitUnitSpacing.js';

describe('findDigitUnitSpacingHits — S3-5 digit attach', () => {
  it('4 명 → 4명', () => {
    expect(findDigitUnitSpacingHits('참가자 4 명')).toEqual([
      expect.objectContaining({
        matchedText: '4 명',
        suggestedText: '4명',
        kind: 'digit-attach',
      }),
    ]);
  });

  it('25 킬로미터 → 25킬로미터', () => {
    expect(findDigitUnitSpacingHits('거리 25 킬로미터')).toEqual([
      expect.objectContaining({
        matchedText: '25 킬로미터',
        suggestedText: '25킬로미터',
      }),
    ]);
  });

  it('이미 붙은 4명·25킬로미터는 KEEP', () => {
    expect(findDigitUnitSpacingHits('4명')).toEqual([]);
    expect(findDigitUnitSpacingHits('25킬로미터')).toEqual([]);
    expect(findDigitUnitSpacingHits('1,500원')).toEqual([]);
  });
});

describe('findDigitUnitSpacingHits — S3-5b hangul-number space', () => {
  it('15만명 → 15만 명', () => {
    expect(findDigitUnitSpacingHits('대군 15만명')).toEqual([
      expect.objectContaining({
        matchedText: '15만명',
        suggestedText: '15만 명',
        kind: 'hangul-space',
      }),
    ]);
  });

  it('수천만 원 KEEP · 수천만원이면 띄어 제안', () => {
    expect(findDigitUnitSpacingHits('수천만 원')).toEqual([]);
    expect(findDigitUnitSpacingHits('수천만원이 들었다')).toEqual([
      expect.objectContaining({
        matchedText: '수천만원',
        suggestedText: '수천만 원',
      }),
    ]);
  });

  it('15만 명은 KEEP', () => {
    expect(findDigitUnitSpacingHits('15만 명의 대군')).toEqual([]);
  });
});
