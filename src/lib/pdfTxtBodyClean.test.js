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
    expect(lines.map((line) => line.col)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
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

  it('같은 y에서 가로로 먼 표 칸은 한 줄로 합치지 않는다', () => {
    const font = 10;
    const items = [
      item('만족: 싸게', 100, 400, 60, font),
      item('불만족: 덜 산다', 280, 400, 80, font),
      item('다음줄', 100, 380, 40, font),
    ];
    expect(linesFromPdfItems(items).map((line) => line.text)).toEqual([
      '만족: 싸게',
      '불만족: 덜 산다',
      '다음줄',
    ]);
  });

  it('같은 y에서 칸이 좁게 붙어도 두꺼운 셀은 나눈다', () => {
    const font = 8;
    const items = [
      item('비용 감소와 안정적인', 97, 533, 68, font),
      item('원 자 재 가 격 상 승', 170, 533, 68, font),
      item('기업은 투입 비용의 상', 243, 533, 68, font),
      item('근로자들이 실질 임금', 318, 533, 68, font),
    ];
    expect(linesFromPdfItems(items).map((line) => line.text)).toEqual([
      '비용 감소와 안정적인',
      '원 자 재 가 격 상 승',
      '기업은 투입 비용의 상',
      '근로자들이 실질 임금',
    ]);
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

  it('text fallback synthesizes lineLayout for paragraph fullness', () => {
    const cleaned = cleanPageLinesForTxt([
      {
        pageNum: 1,
        text: '그는 어제 시장에 가서\n사과를 샀다.\n그리고 집에 왔다.',
      },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].lines).toEqual([
      '그는 어제 시장에 가서',
      '사과를 샀다.',
      '그리고 집에 왔다.',
    ]);
    expect(cleaned[0].lineLayout).toHaveLength(3);
    for (const lay of cleaned[0].lineLayout) {
      expect(Number.isFinite(lay.x)).toBe(true);
      expect(Number.isFinite(lay.endX)).toBe(true);
      expect(Number.isFinite(lay.fontH)).toBe(true);
      expect(lay.endX).toBeGreaterThan(lay.x);
    }
  });

});
