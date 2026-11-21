import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  decideAdnominalDependentSplit,
  findAdnominalDependentNounHits,
  looksLikeGluedAdnominalNnb,
} from './adnominalDependentNoun.js';
import { resolveKiwiNodePaths, loadKiwiNode } from './kiwiMorph/loadNode.js';
import { clearKiwiInstance } from './kiwiMorph/runtime.js';
import { analyzeLine } from './kiwiMorph/analyze.js';

describe('decideAdnominalDependentSplit (목 토큰)', () => {
  it('ETM+NNB 수 → 띄어', () => {
    expect(
      decideAdnominalDependentSplit('있을수', {
        tokens: [
          { str: '있', tag: 'VA', position: 0, length: 1 },
          { str: '을', tag: 'ETM', position: 1, length: 1 },
          { str: '수', tag: 'NNB', position: 2, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '있을수',
        suggestedText: '있을 수',
        kind: '수',
      }),
    );
  });

  it('거+JKO(걸) KEEP', () => {
    expect(
      decideAdnominalDependentSplit('끝난걸', {
        tokens: [
          { str: '끝나', tag: 'VV', position: 0, length: 2 },
          { str: 'ᆫ', tag: 'ETM', position: 1, length: 1 },
          { str: '거', tag: 'NNB', position: 2, length: 1 },
          { str: 'ᆯ', tag: 'JKO', position: 2, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('거+걸까 → 띄어', () => {
    expect(
      decideAdnominalDependentSplit('생각한걸까', {
        tokens: [
          { str: '생각', tag: 'NNG', position: 0, length: 2 },
          { str: '하', tag: 'XSV', position: 2, length: 1 },
          { str: 'ᆫ', tag: 'ETM', position: 2, length: 1 },
          { str: '거', tag: 'NNB', position: 3, length: 1 },
          { str: '이', tag: 'VCP', position: 3, length: 1 },
          { str: 'ᆯ까', tag: 'EF', position: 3, length: 2 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '생각한걸까',
        suggestedText: '생각한 걸까',
      }),
    );
  });

  it('바 NNB KEEP', () => {
    expect(
      decideAdnominalDependentSplit('말한바', {
        tokens: [
          { str: '말', tag: 'NNG', position: 0, length: 1 },
          { str: '하', tag: 'XSV', position: 1, length: 1 },
          { str: 'ᆫ', tag: 'ETM', position: 1, length: 1 },
          { str: '바', tag: 'NNB', position: 2, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('kiwi 없으면 findHits 빈 배열', () => {
    expect(findAdnominalDependentNounHits('있을수', { kiwi: null })).toEqual(
      [],
    );
  });

  it('looksLikeGluedAdnominalNnb', () => {
    expect(looksLikeGluedAdnominalNnb('있을수')).toBe(true);
    expect(looksLikeGluedAdnominalNnb('학교')).toBe(false);
  });
});

const kiwiReady = resolveKiwiNodePaths().ready;

describe.skipIf(!kiwiReady)('golden FIX · 실제 Kiwi', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    kiwi = await loadKiwiNode({ register: false });
    expect(kiwi?.ready?.()).toBe(true);
  }, 60_000);

  it('F01 될수 있 → 될 수', () => {
    expect(findAdnominalDependentNounHits('될수 있', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '될수',
        suggestedText: '될 수',
        kind: '수',
      }),
    ]);
  });

  it('F02 봤을거 → 봤을 거', () => {
    expect(findAdnominalDependentNounHits('봤을거', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '봤을거',
        suggestedText: '봤을 거',
        kind: '거',
      }),
    ]);
  });

  it('F03 생각한걸까 → 생각한 걸까', () => {
    expect(findAdnominalDependentNounHits('생각한걸까', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '생각한걸까',
        suggestedText: '생각한 걸까',
        kind: '거',
      }),
    ]);
  });

  it('있는것 · 잊을만큼 · 할만큼', () => {
    expect(findAdnominalDependentNounHits('있는것이다', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '있는것',
        suggestedText: '있는 것',
      }),
    ]);
    expect(
      findAdnominalDependentNounHits('고통을 잊을만큼의 고민', { kiwi }),
    ).toEqual([
      expect.objectContaining({
        matchedText: '잊을만큼',
        suggestedText: '잊을 만큼',
        kind: '만큼',
      }),
    ]);
    expect(findAdnominalDependentNounHits('할만큼', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '할만큼',
        suggestedText: '할 만큼',
      }),
    ]);
  });
});

describe.skipIf(!kiwiReady)('golden KEEP · 실제 Kiwi', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    clearKiwiInstance();
    kiwi = await loadKiwiNode({ register: false });
  }, 60_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it.each([
    ['K01', '할수록'],
    ['K02', '끝난걸'],
    ['K03', '할걸'],
    ['K04', '어떤지 몰라'],
    ['K05', '말한바와 같이'],
    ['K06', '한 걸 알았다'],
    ['K-mag', '그만큼 깊다'],
    ['K-mag2', '이만큼'],
    ['K-noun', '키만큼'],
    ['K-su', '선수'],
    ['K-byeol', '별수 없이'],
    ['K-mal', '말수가 적다'],
    ['K-sal', '살수차'],
    ['K-geot', '그것은 없다'],
  ])('%s %s', (_id, input) => {
    expect(findAdnominalDependentNounHits(input, { kiwi })).toEqual([]);
  });

  it('위엄있·재미있다 — 관형사형+의존명사 아님', () => {
    expect(findAdnominalDependentNounHits('단단하게 위엄있다', { kiwi })).toEqual(
      [],
    );
    expect(findAdnominalDependentNounHits('재미있다', { kiwi })).toEqual([]);
  });

  it('분석 표본: 할수록은 EC', () => {
    const a = analyzeLine('할수록', { kiwi });
    expect(a?.tokens?.some((t) => t.tag === 'EC')).toBe(true);
  });
});
