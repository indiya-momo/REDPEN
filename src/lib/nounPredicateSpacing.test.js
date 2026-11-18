import { describe, expect, it } from 'vitest';
import {
  findNounPredicateSpacingHits,
  NOUN_PRED_KEEP_GLUED,
} from './nounPredicateSpacing.js';

describe('PR #3 명사+용언', () => {
  it('F07 곳없이 → 곳 없이 (confirm)', () => {
    expect(findNounPredicateSpacingHits('곳없이')).toEqual([
      expect.objectContaining({
        matchedText: '곳없이',
        suggestedText: '곳 없이',
        kind: 'confirm-split',
      }),
    ]);
  });

  it('F08 기분좋 → 기분 좋 (confirm)', () => {
    expect(findNounPredicateSpacingHits('기분좋다')).toEqual([
      expect.objectContaining({
        matchedText: '기분좋',
        suggestedText: '기분 좋',
        kind: 'confirm-split',
      }),
    ]);
  });

  it('F09 사같은은 보류(제안 없음)', () => {
    expect(findNounPredicateSpacingHits('사같은')).toEqual([]);
  });

  it.each([...NOUN_PRED_KEEP_GLUED])('KEEP %s', (word) => {
    expect(findNounPredicateSpacingHits(word)).toEqual([]);
  });
});

describe('PR #3 사전 attach', () => {
  it('F15 붉은 빛 → 붉은빛 (FIX)', () => {
    expect(findNounPredicateSpacingHits('붉은 빛')).toEqual([
      expect.objectContaining({
        matchedText: '붉은 빛',
        suggestedText: '붉은빛',
        kind: 'fix-attach',
      }),
    ]);
  });

  it('F16 불꽃 같은 → 불꽃같은 (confirm)', () => {
    expect(findNounPredicateSpacingHits('불꽃 같은')).toEqual([
      expect.objectContaining({
        matchedText: '불꽃 같은',
        suggestedText: '불꽃같은',
        kind: 'confirm-attach',
      }),
    ]);
  });
});

describe('세종 S2-2-5 닫힌 붙임', () => {
  it('책임 지다 → 책임지…', () => {
    expect(findNounPredicateSpacingHits('모두 책임 지다')).toEqual([
      expect.objectContaining({
        matchedText: '책임 지',
        suggestedText: '책임지',
        kind: 'sejong-attach',
      }),
    ]);
  });

  it('이미 붙은 책임지다는 KEEP', () => {
    expect(findNounPredicateSpacingHits('책임지다')).toEqual([]);
  });
});
