import { describe, expect, it } from 'vitest';
import {
  extractPdfHeadingLines,
  findTitleInstancesPreferProminentLine,
  getTextItemFontSize,
} from './pdfHeadingExtract.js';

/**
 * @param {number} pageNum
 * @param {{ text: string, size: number }[]} lines
 */
function mockPage(pageNum, lines) {
  let text = '';
  /** @type {import('../../lib/pdfService.js').PageData['items']} */
  const items = [];
  let y = 200;
  for (const row of lines) {
    items.push({
      str: row.text,
      transform: [row.size, 0, 0, row.size, 48, y],
    });
    text += `${row.text}\n`;
    y -= 22;
  }
  return { pageNum, text, items, itemRefs: [] };
}

describe('pdfHeadingExtract', () => {
  it('getTextItemFontSize — transform 행렬에서 크기를 읽는다', () => {
    expect(
      getTextItemFontSize({ str: 'a', transform: [14, 0, 0, 14, 0, 0] }),
    ).toBe(14);
  });

  it('큰 글씨 줄만 제목 후보로 추출한다', () => {
    const pages = [
      mockPage(3, [
        { text: '일반 본문 문단입니다.', size: 10 },
        { text: '제1장 서론', size: 18 },
      ]),
    ];
    const headings = extractPdfHeadingLines(pages);
    expect(headings.map((h) => h.text)).toEqual(['제1장 서론']);
    expect(headings[0].pageNum).toBe(3);
  });

  it('인접한 큰 글씨 줄을 한 제목으로 합친다', () => {
    const pages = [
      mockPage(5, [
        { text: '본문 단락', size: 10 },
        { text: 'PART Ⅰ.', size: 20 },
        { text: '경제는 분위기다', size: 20 },
      ]),
    ];
    const headings = extractPdfHeadingLines(pages);
    expect(headings[0]?.text).toBe('PART Ⅰ. 경제는 분위기다');
  });

  it('같은 제목이 소제목 줄·본문에 있으면 큰 글씨 단독 줄을 고른다', () => {
    let text = '';
    const items = [];
    const itemRefs = [];
    const addLine = (str, size, y) => {
      const start = text.length;
      items.push({ str, transform: [size, 0, 0, size, 48, y] });
      itemRefs.push({ start, end: start + str.length, itemIndex: items.length - 1 });
      text += `${str}\n`;
    };
    addLine('경제순환 모형도', 13, 180);
    addLine('경제순환 모형도(circular flow diagram)는 설명', 10, 150);
    const page = { pageNum: 35, text, items, itemRefs };
    const hits = findTitleInstancesPreferProminentLine(
      [page],
      /경제순환\s*모형도/gu,
      1,
    );
    expect(hits[0]?.index).toBe(0);
    expect(hits[0]?.matchedText).toBe('경제순환 모형도');
  });
});
