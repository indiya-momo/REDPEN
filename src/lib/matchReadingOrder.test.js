import { describe, expect, it } from 'vitest';
import {
  buildPageByNum,
  compareInstancesReadingOrder,
  sortInstancesReadingOrder,
} from './matchReadingOrder.js';

/** @param {number} pageNum @param {number} index @param {string} [matchedText] */
function inst(pageNum, index, matchedText = '전세계') {
  return {
    find: '전세계',
    replace: '전 세계',
    matchedText,
    suggestedText: '전 세계',
    pageNum,
    index,
  };
}

describe('compareInstancesReadingOrder', () => {
  it('펼침면에서는 왼쪽 단 위→아래 후 오른쪽 단 순으로 정렬한다', () => {
    const yTop = 520;
    const yMid = 360;
    const yBottom = 200;
    const size = 10;
    const items = [
      { str: '전세계', transform: [size, 0, 0, size, 72, yTop], width: 36 },
      { str: '전세계', transform: [size, 0, 0, size, 72, yBottom], width: 36 },
      { str: '전세계', transform: [size, 0, 0, size, 420, yMid], width: 36 },
    ];
    const text = '전세계\n전세계\n전세계\n';
    const itemRefs = [
      { start: 0, end: 3, itemIndex: 0 },
      { start: 4, end: 7, itemIndex: 2 },
      { start: 8, end: 11, itemIndex: 1 },
    ];
    const page = { pageNum: 40, text, items, itemRefs };
    const pageByNum = buildPageByNum([page]);

    const scrambled = [inst(40, 0), inst(40, 4), inst(40, 8)];
    const sorted = sortInstancesReadingOrder(scrambled, pageByNum);

    expect(sorted.map((i) => i.index)).toEqual([0, 8, 4]);
    expect(
      compareInstancesReadingOrder(inst(40, 8), inst(40, 4), pageByNum),
    ).toBeLessThan(0);
  });

  it('단면 페이지는 위→아래·왼→오른 순으로 정렬한다', () => {
    const size = 10;
    const items = [
      { str: '전세계', transform: [size, 0, 0, size, 48, 300], width: 36 },
      { str: '전세계', transform: [size, 0, 0, size, 48, 180], width: 36 },
    ];
    const text = '전세계\n전세계\n';
    const itemRefs = [
      { start: 0, end: 3, itemIndex: 0 },
      { start: 4, end: 7, itemIndex: 1 },
    ];
    const page = { pageNum: 5, text, items, itemRefs };
    const pageByNum = buildPageByNum([page]);

    const sorted = sortInstancesReadingOrder([inst(5, 4), inst(5, 0)], pageByNum);
    expect(sorted.map((i) => i.index)).toEqual([0, 4]);
  });
});
