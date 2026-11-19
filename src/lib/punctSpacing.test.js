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
