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

describe('findDigitUnitSpacingHits — 제43항 가드·except', () => {
  it('검출 유지: 삼백명·2천년·한개·수백명·삼십분·몇백명이·천년·수천년', () => {
    expect(findDigitUnitSpacingHits('삼백명이 모였다')).toEqual([
      expect.objectContaining({
        matchedText: '삼백명',
        suggestedText: '삼백 명',
      }),
    ]);
    expect(findDigitUnitSpacingHits('2천년')).toEqual([
      expect.objectContaining({
        matchedText: '2천년',
        suggestedText: '2천 년',
      }),
    ]);
    expect(findDigitUnitSpacingHits('한개')).toEqual([
      expect.objectContaining({
        matchedText: '한개',
        suggestedText: '한 개',
      }),
    ]);
    expect(findDigitUnitSpacingHits('수백명')).toEqual([
      expect.objectContaining({
        matchedText: '수백명',
        suggestedText: '수백 명',
      }),
    ]);
    expect(findDigitUnitSpacingHits('삼십분')).toEqual([
      expect.objectContaining({
        matchedText: '삼십분',
        suggestedText: '삼십 분',
      }),
    ]);
    expect(findDigitUnitSpacingHits('몇백명이')).toEqual([
      expect.objectContaining({
        matchedText: '몇백명',
        suggestedText: '몇백 명',
      }),
    ]);
    expect(findDigitUnitSpacingHits('천년의 역사')).toEqual([
      expect.objectContaining({
        matchedText: '천년',
        suggestedText: '천 년',
      }),
    ]);
    expect(findDigitUnitSpacingHits('수천년')).toEqual([
      expect.objectContaining({
        matchedText: '수천년',
        suggestedText: '수천 년',
      }),
    ]);
  });

  it('미검출: 인사도·한쪽·사도·천장·만세·십자가·한개인·두개골·삼월', () => {
    for (const t of [
      '인사도',
      '한쪽',
      '사도',
      '천장',
      '만세',
      '십자가',
      '한개인',
      '두개골',
      '삼월',
    ]) {
      expect(findDigitUnitSpacingHits(t), t).toEqual([]);
    }
  });

  it('except: 천명·만원 등 · 두개는 수량 검출', () => {
    expect(findDigitUnitSpacingHits('천명')).toEqual([]);
    expect(findDigitUnitSpacingHits('만원')).toEqual([]);
    expect(findDigitUnitSpacingHits('만개')).toEqual([]);
    expect(findDigitUnitSpacingHits('두개')).toEqual([
      expect.objectContaining({
        matchedText: '두개',
        suggestedText: '두 개',
      }),
    ]);
  });

  it('이미 띈 천 년·삼백 명은 KEEP', () => {
    expect(findDigitUnitSpacingHits('천 년')).toEqual([]);
    expect(findDigitUnitSpacingHits('삼백 명')).toEqual([]);
  });
});
