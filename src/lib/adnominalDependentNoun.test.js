import { describe, expect, it } from 'vitest';
import { findAdnominalDependentNounHits } from './adnominalDependentNoun.js';

/** PR #3 골든「관형사형+의존명사」 */
describe('golden FIX', () => {
  it('F01 될수 있 → 될 수', () => {
    expect(findAdnominalDependentNounHits('될수 있')).toEqual([
      expect.objectContaining({
        matchedText: '될수',
        suggestedText: '될 수',
        kind: '수',
      }),
    ]);
  });

  it('F02 봤을거 → 봤을 거', () => {
    expect(findAdnominalDependentNounHits('봤을거')).toEqual([
      expect.objectContaining({
        matchedText: '봤을거',
        suggestedText: '봤을 거',
        kind: '거',
      }),
    ]);
  });

  it('F03 생각한걸까 → 생각한 걸까', () => {
    expect(findAdnominalDependentNounHits('생각한걸까')).toEqual([
      expect.objectContaining({
        matchedText: '생각한걸까',
        suggestedText: '생각한 걸까',
        kind: '걸까',
      }),
    ]);
  });
});

describe('golden KEEP (오탐 금지)', () => {
  it.each([
    ['K01', '할수록'],
    ['K02', '끝난걸'],
    ['K03', '할걸'],
    ['K04', '어떤지 몰라'],
    ['K05', '말한바와 같이'],
    ['K06', '한 걸 알았다'],
  ])('%s %s', (_id, input) => {
    expect(findAdnominalDependentNounHits(input)).toEqual([]);
  });
});

describe('보강 것', () => {
  it('있는것 → 있는 것', () => {
    expect(findAdnominalDependentNounHits('있는것이다')).toEqual([
      expect.objectContaining({
        matchedText: '있는것',
        suggestedText: '있는 것',
      }),
    ]);
  });

  it('그것은 KEEP', () => {
    expect(findAdnominalDependentNounHits('그것은 없다')).toEqual([]);
  });
});
