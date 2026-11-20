import { describe, expect, it } from 'vitest';
import { searchManuscriptText } from './manuscriptTextIndex.js';
import { searchManuscript } from './searchManuscript.js';

const pages = [
  { pageNum: 1, text: '경주멍은 본문이다', visualText: '경주멍은 본문이다' },
  { pageNum: 2, text: '본문 뒤에 경주멍이 또 있다', visualText: '본문 뒤에 경주멍이 또 있다' },
];

describe('searchManuscriptText', () => {
  it('알려진 문구 hit 수·오프셋', () => {
    const hits = searchManuscriptText(pages, '경주멍');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      pageNum: 1,
      start: 0,
      end: 3,
      matchedText: '경주멍',
    });
    expect(hits[1]).toMatchObject({
      pageNum: 2,
      start: 6,
      end: 9,
      matchedText: '경주멍',
    });
    expect(hits[0].snippet).toContain('경주멍');
    expect(pages[0].text).toBe(pages[0].visualText);
    expect(pages[0].text.slice(hits[0].start, hits[0].end)).toBe(hits[0].matchedText);
  });

  it('빈 질의는 0건', () => {
    expect(searchManuscriptText(pages, '')).toEqual([]);
    expect(searchManuscript(pages, '   ')).toEqual([]);
  });
});
