import { describe, expect, it } from 'vitest';
import {
  bareunListResponseToKiwiItems,
  bareunSentenceToKiwiShape,
} from './mapToKiwiShape.js';
import { normalizeBareunTag } from './tags.js';
import { isConfirmedAuxiliaryMorph } from '../auxiliaryMorphFilter.js';

describe('bareunMorph tags', () => {
  it('숫자·문자열 태그를 세종 품사로 정규화한다', () => {
    expect(normalizeBareunTag(41)).toBe('VV');
    expect(normalizeBareunTag(42)).toBe('VX');
    expect(normalizeBareunTag('VV')).toBe('VV');
    expect(normalizeBareunTag('NNG')).toBe('NNG');
  });
});

describe('bareunSentenceToKiwiShape', () => {
  it('용언 문장은 isConfirmedAuxiliaryMorph true', () => {
    const shape = bareunSentenceToKiwiShape('살아가는', {
      tokens: [
        {
          morphemes: [
            { text: { content: '살아가', begin_offset: 0, length: 3 }, tag: 41 },
            { text: { content: '는', begin_offset: 3, length: 1 }, tag: 4 },
          ],
        },
      ],
    });
    expect(shape.tokens.map((t) => t.tag)).toEqual(['VV', 'ETM']);
    expect(isConfirmedAuxiliaryMorph(shape)).toBe(true);
  });

  it('명사+조사는 용언 미확인', () => {
    const shape = bareunSentenceToKiwiShape('신라가', {
      tokens: [
        {
          morphemes: [
            { text: { content: '신라', begin_offset: 0, length: 2 }, tag: 'NNP' },
            { text: { content: '가', begin_offset: 2, length: 1 }, tag: 'JKS' },
          ],
        },
      ],
    });
    expect(isConfirmedAuxiliaryMorph(shape)).toBe(false);
  });

  it('List 응답은 입력 순서대로 매핑한다', () => {
    const items = bareunListResponseToKiwiItems(
      ['신라가', '살아가는'],
      {
        sentences: [
          {
            tokens: [
              {
                morphemes: [
                  { text: { content: '신라' }, tag: 'NNP' },
                  { text: { content: '가' }, tag: 'JKS' },
                ],
              },
            ],
          },
          {
            tokens: [
              {
                morphemes: [
                  { text: { content: '살아가' }, tag: 'VV' },
                  { text: { content: '는' }, tag: 'ETM' },
                ],
              },
            ],
          },
        ],
      },
    );
    expect(items).toHaveLength(2);
    expect(isConfirmedAuxiliaryMorph(items[0])).toBe(false);
    expect(isConfirmedAuxiliaryMorph(items[1])).toBe(true);
  });
});
