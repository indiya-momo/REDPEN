import { describe, expect, it } from 'vitest';
import { findPunctSpacingHits } from './punctSpacing.js';

describe('findPunctSpacingHits — 종결·쉼표 뒤 공백', () => {
  it('않네요.반가운 → 않네요. 반가운', () => {
    expect(findPunctSpacingHits('낯설지가 않네요.반가운 얼굴')).toEqual([
      expect.objectContaining({
        matchedText: '.반',
        suggestedText: '. 반',
        kind: 'stop-space',
      }),
    ]);
  });

  it('있었습니다.우리가 · 새겼지요.이', () => {
    expect(findPunctSpacingHits('있었습니다.우리가 깊어지던')).toEqual([
      expect.objectContaining({
        matchedText: '.우',
        suggestedText: '. 우',
      }),
    ]);
    expect(findPunctSpacingHits('새겼지요.이 냉수리')).toEqual([
      expect.objectContaining({
        matchedText: '.이',
        suggestedText: '. 이',
      }),
    ]);
  });

  it('줄바꿈 뒤 한글·이미 띈 종결은 KEEP', () => {
    expect(findPunctSpacingHits('끝입니다.\n다음')).toEqual([]);
    expect(findPunctSpacingHits('끝입니다. 다음')).toEqual([]);
  });

  it('마음,오래 → 마음, 오래', () => {
    expect(findPunctSpacingHits('마음,오래 바라본')).toEqual([
      expect.objectContaining({
        matchedText: ',오',
        suggestedText: ', 오',
        kind: 'comma-space',
      }),
    ]);
  });

  it('1,500은 KEEP', () => {
    expect(findPunctSpacingHits('1,500원')).toEqual([]);
  });
});

describe('findPunctSpacingHits — 따옴표 라고·하고', () => {
  it('"가자." 라고 → "가자."라고', () => {
    expect(findPunctSpacingHits('"가자." 라고 했다')).toEqual([
      expect.objectContaining({
        matchedText: '" 라고',
        suggestedText: '"라고',
        kind: 'quote-rago',
      }),
    ]);
  });

  it('“안녕.” 이라고 → “안녕.”이라고 · 이미 붙인 것은 KEEP', () => {
    expect(findPunctSpacingHits('“안녕.” 이라고 했다')).toEqual([
      expect.objectContaining({
        matchedText: '” 이라고',
        suggestedText: '”이라고',
        kind: 'quote-rago',
      }),
    ]);
    expect(findPunctSpacingHits('“가자.”라고 했다')).toEqual([]);
  });

  it('"가자."하고 → "가자." 하고 · 이미 띈 것은 KEEP', () => {
    expect(findPunctSpacingHits('"가자."하고 나섰다')).toEqual([
      expect.objectContaining({
        matchedText: '"하고',
        suggestedText: '" 하고',
        kind: 'quote-hago',
      }),
    ]);
    expect(findPunctSpacingHits('"가자." 하고 나섰다')).toEqual([]);
  });

  it('하며·하는도 띄움', () => {
    expect(findPunctSpacingHits('‘가자.’하며')).toEqual([
      expect.objectContaining({
        matchedText: '’하며',
        suggestedText: '’ 하며',
        kind: 'quote-hago',
      }),
    ]);
    expect(findPunctSpacingHits('"끝."하는 순간')).toEqual([
      expect.objectContaining({
        matchedText: '"하는',
        suggestedText: '" 하는',
        kind: 'quote-hago',
      }),
    ]);
  });
});

describe('findPunctSpacingHits — 닫는 부호·가운뎃점·단위 점', () => {
  it('《경주멍》 은 → 《경주멍》은', () => {
    expect(findPunctSpacingHits('《경주멍》 은 마음 가는')).toEqual([
      expect.objectContaining({
        matchedText: '》 은',
        suggestedText: '》은',
        kind: 'close-josa',
      }),
    ]);
  });

  it('》 은은히는 조사 뒤 한글이라 KEEP', () => {
    expect(findPunctSpacingHits('《경주멍》 은은히')).toEqual([]);
  });

  it('내함· 사리병 → 내함·사리병 · 양쪽 띄운 가운뎃점은 KEEP', () => {
    expect(findPunctSpacingHits('사리 내함· 사리병')).toEqual([
      expect.objectContaining({
        matchedText: '· ',
        suggestedText: '·',
        kind: 'middot-space',
      }),
    ]);
    expect(findPunctSpacingHits('금 · 은')).toEqual([]);
  });

  it('16.5.cm → 16.5cm · 16.5cm는 KEEP', () => {
    expect(findPunctSpacingHits('높이 16.5.cm')).toEqual([
      expect.objectContaining({
        matchedText: '16.5.cm',
        suggestedText: '16.5cm',
        kind: 'unit-dot',
      }),
    ]);
    expect(findPunctSpacingHits('높이 16.5cm')).toEqual([]);
  });
});

describe('findPunctSpacingHits — 닫는 괄호·이다 · 여는 따옴표', () => {
  it('(상황) 입니다 → (상황)입니다 · 이미 붙인 것은 KEEP', () => {
    expect(findPunctSpacingHits('(상황) 입니다.')).toEqual([
      expect.objectContaining({
        matchedText: ') 입니다',
        suggestedText: ')입니다',
        kind: 'close-josa',
      }),
    ]);
    expect(findPunctSpacingHits('(상황)입니다.')).toEqual([]);
  });

  it(') 다음은 KEEP(이다·조사가 아님)', () => {
    expect(findPunctSpacingHits('(상황) 다음')).toEqual([]);
  });

  it('워진다는‘덕 → 워진다는 ‘덕 · 이미 띄 것은 KEEP', () => {
    expect(findPunctSpacingHits('워진다는‘덕업일신\'')).toEqual([
      expect.objectContaining({
        matchedText: '‘',
        suggestedText: ' ‘',
        kind: 'open-quote-space',
      }),
    ]);
    expect(findPunctSpacingHits('워진다는 ‘덕업일신\'')).toEqual([]);
  });
});
