import { describe, expect, it } from 'vitest';
import { findRieulKkaBodaSpacingHits } from './rieulKkaBodaSpacing.js';
import { findAdnominalDependentNounHits } from './adnominalDependentNoun.js';

describe('세종 S2-2-10 -ㄹ까 보다', () => {
  it('할까보다 → 할까 보다', () => {
    expect(findRieulKkaBodaSpacingHits('할까보다')).toEqual([
      expect.objectContaining({
        matchedText: '할까보다',
        suggestedText: '할까 보다',
      }),
    ]);
  });

  it('이미 띈 할까 보다 KEEP', () => {
    expect(findRieulKkaBodaSpacingHits('할까 보다')).toEqual([]);
  });
});

describe('PR #3 ㄹ 수 패턴 KEEP (의존명사 수 모듈과 충돌 없음)', () => {
  it.each(['별수 없이', '말수가 적다', '살수차'])('%s', (input) => {
    expect(findAdnominalDependentNounHits(input)).toEqual([]);
  });
});
