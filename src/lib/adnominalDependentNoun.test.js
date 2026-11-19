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

describe('ㄹ 수 KEEP (PR #3 K07–K09)', () => {
  it.each(['별수 없이', '말수가 적다', '살수차'])('%s', (input) => {
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

describe('관형사형+만큼 · 명사+있다', () => {
  it('잊을만큼 → 잊을 만큼', () => {
    expect(findAdnominalDependentNounHits('고통을 잊을만큼의 고민')).toEqual([
      expect.objectContaining({
        matchedText: '잊을만큼',
        suggestedText: '잊을 만큼',
        kind: '만큼',
      }),
    ]);
  });

  it('할만큼 → 할 만큼 · 그만큼·이만큼·이미 띈 잊을 만큼은 KEEP', () => {
    expect(findAdnominalDependentNounHits('할만큼')).toEqual([
      expect.objectContaining({
        matchedText: '할만큼',
        suggestedText: '할 만큼',
      }),
    ]);
    expect(findAdnominalDependentNounHits('그만큼 깊다')).toEqual([]);
    expect(findAdnominalDependentNounHits('이만큼')).toEqual([]);
    expect(findAdnominalDependentNounHits('잊을 만큼')).toEqual([]);
  });

  it('위엄있 → 위엄 있 · 재미있다는 KEEP', () => {
    expect(findAdnominalDependentNounHits('단단하게 위엄있다')).toEqual([
      expect.objectContaining({
        matchedText: '위엄있',
        suggestedText: '위엄 있',
        kind: '있',
      }),
    ]);
    expect(findAdnominalDependentNounHits('재미있다')).toEqual([]);
  });
});
