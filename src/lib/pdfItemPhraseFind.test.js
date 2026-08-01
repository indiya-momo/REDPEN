import { describe, expect, it } from 'vitest';
import {
  dedupePhraseHits,
  findPhraseHitsInPdfItems,
  isCorroboratedGlyphHit,
  sortPhraseHitsReadingOrder,
} from './pdfItemPhraseFind.js';

/** @param {string} str @param {number} x @param {number} y @param {number} [w] */
function item(str, x, y, w = Math.max(str.length * 8, 1)) {
  const fs = 10;
  return { str, transform: [fs, 0, 0, fs, x, y], width: w, height: fs };
}

describe('isCorroboratedGlyphHit', () => {
  const fat = ['항아리바위로유명한명지계곡', '삼악산으로탐사를'];

  it('본문에 이어지는 글자가 있으면 지도 글리프 런을 채택한다', () => {
    expect(isCorroboratedGlyphHit('명지계곡', '명지', fat)).toBe(true);
  });

  it('페이지 본문에 없는 접합(명지산)은 거부한다', () => {
    expect(isCorroboratedGlyphHit('명지산', '명지', fat)).toBe(false);
  });

  it('본문에 있는 전체 needle(명지계곡)과 이중 드로잉을 채택한다', () => {
    expect(isCorroboratedGlyphHit('명지계곡', '명지계곡', fat)).toBe(true);
    expect(isCorroboratedGlyphHit('명지계곡명지계곡', '명지계곡', fat)).toBe(
      true,
    );
  });
});

describe('findPhraseHitsInPdfItems', () => {
  it('본문 in-item + 입증된 제목 글리프만 남기고 명지산 오탐을 제거한다', () => {
    const items = [
      item('명', 698, 1157, 0.2),
      item('지', 698, 1158, 0.2),
      item('계', 698, 1156, 0.2),
      item('곡', 698, 1157, 0.2),
      item('명', 698, 1157, 0.2), // 이중 드로잉
      item('지', 698, 1158, 0.2),
      item('계', 698, 1156, 0.2),
      item('곡', 698, 1157, 0.2),
      item('명', 712, 1167, 0.1), // 오탐 글리프
      item('지', 712, 1168, 0.1),
      item('산', 712, 1169, 7),
      item('항아리 바위로 유명한 명지 계곡', 744, 1004, 130),
      item('항아리 바위가 있는 명지 계곡과', 705, 1004, 200),
      item('벌써 명지 계곡에 도착', 491, 1004, 200),
      item('여기가 명지 계곡이라고', 471, 1004, 200),
      item('‘명지 계곡이 훼손', 432, 836, 120),
      item('널려 있는 명지 계곡', 390, 1170, 80),
    ];

    const hits = findPhraseHitsInPdfItems(items, '명지');
    expect(hits).toHaveLength(7);
    expect(hits.every((h) => !String(h.run ?? h.snippet).includes('명지산') || h.kind === 'in-item')).toBe(
      true,
    );
    expect(hits.filter((h) => h.kind === 'glyph-run')).toHaveLength(1);
    expect(hits.filter((h) => h.kind === 'in-item')).toHaveLength(6);
  });

  it('soft-wrap으로 갈라진 「명|지 계곡」을 찾는다', () => {
    const items = [
      item(
        '암반이 강 바닥을 이루고 있는 곳에서 잘 나타나는 현상입니다. 우리 나라에는 명',
        258,
        532,
        300,
      ),
      item(
        '지 계곡 외에도 영월 주천강의 요석정 주변, 삼척의 두타산 계곡',
        238,
        532,
        300,
      ),
    ];
    const hits = findPhraseHitsInPdfItems(items, '명지 계곡');
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('soft-wrap');
    expect(hits[0].itemIndexes).toEqual([0, 1]);
  });

  it('같은 줄에 가로로 갈라진 「경제」「침체」를 line-run으로 찾는다', () => {
    const items = [
      item('경제', 120, 400, 24),
      item('침체', 146, 400, 24),
      item('(전미경제연구소)', 172, 400, 90),
    ];
    const hits = findPhraseHitsInPdfItems(items, '경제침체');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.kind === 'line-run')).toBe(true);
    expect(hits[0].itemIndexes).toEqual([0, 1]);
  });

  it('이중 드로잉 차트 라벨은 xy dedupe로 1회만 센다', () => {
    const items = [
      item('경제침체(전미경제연구소)', 120, 400, 160),
      item('경제침체(전미경제연구소)', 120.5, 400.5, 160),
    ];
    const hits = findPhraseHitsInPdfItems(items, '경제침체');
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('in-item');
  });

  it('띄움 「명지 계곡」은 붙임 제목 글리프를 칩으로 세지 않는다', () => {
    const items = [
      item('명', 698, 1157, 0.2),
      item('지', 698, 1158, 0.2),
      item('계', 698, 1156, 0.2),
      item('곡', 698, 1157, 0.2),
      item('항아리 바위로 유명한 명지 계곡', 744, 1004, 130),
      item(
        '암반이 강 바닥을 이루고 있는 곳에서 잘 나타나는 현상입니다. 우리 나라에는 명',
        258,
        532,
        300,
      ),
      item(
        '지 계곡 외에도 영월 주천강의 요석정 주변',
        238,
        532,
        300,
      ),
    ];
    const spaced = findPhraseHitsInPdfItems(items, '명지 계곡');
    expect(spaced.every((h) => h.kind !== 'glyph-run')).toBe(true);
    expect(spaced).toHaveLength(2);
    expect(spaced.filter((h) => h.kind === 'in-item')).toHaveLength(1);
    expect(spaced.filter((h) => h.kind === 'soft-wrap')).toHaveLength(1);

    const glued = findPhraseHitsInPdfItems(items, '명지계곡');
    // 지도 세로 글리프만 있는 붙임은 본문 띄움으로 입증하지 않음
    expect(glued).toHaveLength(0);
  });

  it('펼침면에서 왼 단 위→아래 후 오른 단으로 정렬한다', () => {
    const items = [
      item('명지 계곡 A', 100, 500, 80),
      item('명지 계곡 B', 100, 300, 80),
      item('명지 계곡 C', 500, 400, 80),
      // 폭을 펼침면으로
      item('패딩왼', 50, 200, 40),
      item('패딩오', 700, 200, 40),
    ];
    // minX~maxX 넓게
    items.push(item('edgeL', 40, 100, 10));
    items.push(item('edgeR', 800, 100, 10));

    const hits = findPhraseHitsInPdfItems(items, '명지');
    const sorted = sortPhraseHitsReadingOrder(hits, items);
    expect(sorted.map((h) => h.snippet.replace(/\s/g, '').slice(0, 6))).toEqual([
      '명지계곡A',
      '명지계곡B',
      '명지계곡C',
    ]);
  });
});

describe('dedupePhraseHits', () => {
  it('같은 좌표 근처 중복을 하나로 합친다', () => {
    const hits = dedupePhraseHits([
      {
        phrase: '명지',
        itemIndex: 0,
        itemIndexes: [0],
        x: 10,
        y: 20,
        kind: 'glyph-run',
        snippet: 'a',
      },
      {
        phrase: '명지',
        itemIndex: 1,
        itemIndexes: [1],
        x: 11,
        y: 21,
        kind: 'in-item',
        snippet: 'b',
      },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('in-item');
  });
});
