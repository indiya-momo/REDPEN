import { describe, expect, it } from 'vitest';
import { findOfficialAuxSpacingHits } from './officialAuxSpacing.js';

describe('PR #3 보조용언 FIX', () => {
  it('F10 뛰지말라 → 뛰지 말라', () => {
    expect(findOfficialAuxSpacingHits('뛰지말라')).toEqual([
      expect.objectContaining({
        matchedText: '뛰지말라',
        suggestedText: '뛰지 말라',
      }),
    ]);
  });

  it('F11 해보이 → 해 보이', () => {
    expect(findOfficialAuxSpacingHits('롭기만 해보이')).toEqual([
      expect.objectContaining({
        matchedText: '해보이',
        suggestedText: '해 보이',
      }),
    ]);
  });

  it('F12 …나봐 → …나 봐', () => {
    expect(findOfficialAuxSpacingHits('었나봐')).toEqual([
      expect.objectContaining({
        matchedText: '었나봐',
        suggestedText: '었나 봐',
      }),
    ]);
    expect(findOfficialAuxSpacingHits('그랬나봐')).toEqual([
      expect.objectContaining({
        suggestedText: '그랬나 봐',
      }),
    ]);
  });

  it('F13 어루만져주세요 → 어루만져 주세요', () => {
    expect(findOfficialAuxSpacingHits('어루만져주세요')).toEqual([
      expect.objectContaining({
        suggestedText: '어루만져 주세요',
      }),
    ]);
  });

  it('F14 도와드려보다 → 도와드려 보다', () => {
    expect(findOfficialAuxSpacingHits('도와드려보다')).toEqual([
      expect.objectContaining({
        suggestedText: '도와드려 보다',
      }),
    ]);
  });
});

describe('PR #3 보조용언 KEEP', () => {
  it.each(['먹어 보다', '먹어보다', '도와 드려 보다'])('%s', (input) => {
    expect(findOfficialAuxSpacingHits(input)).toEqual([]);
  });
});
