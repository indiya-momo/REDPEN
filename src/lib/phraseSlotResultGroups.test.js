import { describe, expect, it } from 'vitest';
import { groupPhraseSlotInstancesByFill } from './phraseSlotResultGroups.js';

/** @param {number} pageNum @param {string} matchedText */
function inst(pageNum, matchedText) {
  return { pageNum, index: 0, matchedText, suggestedText: matchedText };
}

describe('groupPhraseSlotInstancesByFill', () => {
  it('표기별로 묶고 건수 내림차순으로 정렬한다', () => {
    const groups = groupPhraseSlotInstancesByFill([
      inst(3, '조선시대'),
      inst(5, '조선시대'),
      inst(2, '고려시대'),
      inst(8, '조선시대'),
      inst(10, '고려시대'),
    ]);
    expect(groups.map((g) => [g.text, g.count, g.firstPage])).toEqual([
      ['조선시대', 3, 3],
      ['고려시대', 2, 2],
    ]);
  });

  it('건수가 같으면 첫 등장 페이지 순이다', () => {
    const groups = groupPhraseSlotInstancesByFill([
      inst(10, '신라시대'),
      inst(11, '신라시대'),
      inst(7, '조선 시대'),
      inst(14, '조선 시대'),
    ]);
    expect(groups.map((g) => g.text)).toEqual(['조선 시대', '신라시대']);
    expect(groups.every((g) => g.count === 2)).toBe(true);
  });

  it('띄어쓰기만 다른 표기는 따로 둔다', () => {
    const groups = groupPhraseSlotInstancesByFill([
      inst(1, '조선시대'),
      inst(2, '조선 시대'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.text).sort()).toEqual([
      '조선 시대',
      '조선시대',
    ]);
  });

  it('빈 matchedText는 건너뛴다', () => {
    expect(
      groupPhraseSlotInstancesByFill([
        inst(1, ''),
        { pageNum: 2, index: 0, matchedText: null },
      ]),
    ).toEqual([]);
  });

  it('앞뒤 공백·PDF � 는 같은 표기로 묶고 표시 키에서 뺀다', () => {
    const groups = groupPhraseSlotInstancesByFill([
      inst(1, ' 실물경제'),
      inst(2, '\uFFFD실물경제'),
      inst(3, '실물경제'),
      inst(4, '\uFFFD\uFFFD경제'),
    ]);
    expect(groups.map((g) => [g.text, g.count])).toEqual([
      ['실물경제', 3],
      ['경제', 1],
    ]);
  });
});
