import { describe, expect, it } from 'vitest';
import {
  cleanPageLinesForTxt,
  cleanPagesForTxt,
  linesFromPdfItems,
} from './pdfTxtBodyClean.js';

/**
 * @param {string} str
 * @param {number} x
 * @param {number} y
 * @param {number} [width]
 * @param {number} [font]
 */
function item(str, x, y, width, font = 11) {
  return {
    str,
    transform: [font, 0, 0, font, x, y],
    width: width ?? str.length * font * 0.48,
  };
}

/** spreadColumnSplit 테스트와 같은 최소 펼침면 (폭 ≥360pt, 가로/세로 ≥1.15) */
function mockSpreadItems() {
  const leftX = 48;
  const rightX = 420;
  const font = 11;
  return [
    item('바로잡아', leftX, 200, 55, font),
    item('바', leftX + 58, 200, 11, font),
    item('하는', rightX, 200, 22, font),
    item('왼쪽윗', leftX, 520, undefined, font),
    item('왼쪽중', leftX, 460, undefined, font),
    item('왼아래 1', leftX, 400, undefined, font),
    item('오른윗', rightX, 520, undefined, font),
    item('오른중', rightX, 460, undefined, font),
    item('오른아래', rightX, 400, undefined, font),
  ];
}

describe('linesFromPdfItems', () => {
  it('펼침면은 왼쪽 줄을 모두 읽은 뒤 오른쪽을 붙인다', () => {
    const lines = linesFromPdfItems(mockSpreadItems());
    expect(lines.map((line) => line.text)).toEqual([
      '왼쪽윗',
      '왼쪽중',
      '왼아래 1',
      '바로잡아바',
      '오른윗',
      '오른중',
      '오른아래',
      '하는',
    ]);
  });

  it('단면은 위→아래, 같은 줄은 왼쪽→오른쪽으로 그대로 둔다', () => {
    const items = [
      item('서문', 72, 700, 28, 14),
      item('첫 문장입니다.', 72, 660, 80, 12),
    ];
    expect(linesFromPdfItems(items).map((line) => line.text)).toEqual([
      '서문',
      '첫 문장입니다.',
    ]);
    expect(cleanPagesForTxt([{ pageNum: 1, items }])[0].text).toBe(
      '서문\n첫 문장입니다.',
    );
  });

  it('펼침면에서도 상단 반복 머리말은 걷어 낸다', () => {
    const mk = (pageNum) => ({
      pageNum,
      items: [
        item('책 제목', 48, 530, 40, 11),
        item('책 제목', 420, 530, 40, 11),
        item(`왼본문 ${pageNum}`, 48, 460, 55, 11),
        item(`오른본문 ${pageNum}`, 420, 460, 55, 11),
        item('왼쪽중', 48, 330, 33, 11),
        item('오른중', 420, 330, 33, 11),
        item(`왼아래 ${pageNum}`, 48, 200, 44, 11),
        item(`오른아래 ${pageNum}`, 420, 200, 55, 11),
      ],
    });
    const cleaned = cleanPageLinesForTxt([mk(1), mk(2), mk(3)]);
    expect(cleaned.map((page) => page.lines)).toEqual([
      ['왼본문 1', '왼쪽중', '왼아래 1', '오른본문 1', '오른중', '오른아래 1'],
      ['왼본문 2', '왼쪽중', '왼아래 2', '오른본문 2', '오른중', '오른아래 2'],
      ['왼본문 3', '왼쪽중', '왼아래 3', '오른본문 3', '오른중', '오른아래 3'],
    ]);
  });
});
