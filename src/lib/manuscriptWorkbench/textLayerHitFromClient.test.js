import { describe, expect, it } from 'vitest';
import {
  hitFromSingleIndex,
  indexFromItemBoxesAtPoint,
  indexFromTextLayerSpan,
} from './textLayerHitFromClient.js';
import { extractStartEojeol } from '../layoutMark/layoutMarkReplace.js';
import { expandCharBoxesVoronoiX, nearestCharIndexAtPoint } from './pageGeometry.js';

function fakeSpan({ start, end, left, width, top = 0, height = 12 }) {
  return {
    dataset: { start: String(start), end: String(end), itemIndex: '0' },
    getBoundingClientRect: () => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    }),
  };
}

describe('indexFromTextLayerSpan', () => {
  const span = fakeSpan({ start: 0, end: 50, left: 0, width: 500 });

  it('picks rear 1-eojeol geu for end-of-line click', () => {
    expect(indexFromTextLayerSpan(span, 405, 6)).toBe(40);
  });

  it('picks front geu for early click', () => {
    expect(indexFromTextLayerSpan(span, 105, 6)).toBe(10);
  });
});

describe('indexFromItemBoxesAtPoint', () => {
  // "곳에서" — 서 is last char index 2, box ends at x=30
  const boxes = [
    { left: 0, top: 0, width: 30, height: 12, start: 0, end: 3 },
  ];

  it('picks last char seo when click is at box end', () => {
    expect(indexFromItemBoxesAtPoint(boxes, 29, 6)).toBe(2);
  });

  it('picks last char seo when click is slightly past box (line end)', () => {
    expect(indexFromItemBoxesAtPoint(boxes, 33, 6)).toBe(2);
  });
});

describe('nearestCharIndexAtPoint line-end seo vs mom', () => {
  const boxes = [
    { left: 100, top: 0, width: 10, height: 12, index: 20 }, // seo
    { left: 200, top: 40, width: 10, height: 12, index: 50 }, // mom other line
  ];

  it('click near seo right edge picks seo not mom', () => {
    expect(nearestCharIndexAtPoint(boxes, 112, 6)).toBe(20);
  });
});

describe('nearestCharIndexAtPoint gap between geu and mo', () => {
  const raw = [
    { left: 0, top: 0, width: 10, height: 12, index: 0 },
    { left: 20, top: 0, width: 10, height: 12, index: 2 },
  ];
  const boxes = expandCharBoxesVoronoiX(raw);

  it('gap closer to geu picks geu', () => {
    expect(nearestCharIndexAtPoint(boxes, 12, 6)).toBe(0);
  });

  it('past midpoint picks mo', () => {
    expect(nearestCharIndexAtPoint(boxes, 18, 6)).toBe(2);
  });

  it('space box between geu and mo: space mid is space index', () => {
    const withSpace = expandCharBoxesVoronoiX([
      { left: 0, top: 0, width: 10, height: 12, index: 0 },
      { left: 10, top: 0, width: 5, height: 12, index: 1 },
      { left: 15, top: 0, width: 10, height: 12, index: 2 },
    ]);
    expect(nearestCharIndexAtPoint(withSpace, 12, 6)).toBe(1);
    expect(extractStartEojeol('그 모습을', 1)?.w).toBe('그');
  });
});

describe('voronoi eojji vs geuri', () => {
  const t = '어찌 그리';
  const boxes = expandCharBoxesVoronoiX([
    { left: 0, top: 0, width: 20, height: 12, index: 0 },
    { left: 20, top: 0, width: 20, height: 12, index: 1 },
    { left: 44, top: 0, width: 20, height: 12, index: 3 },
    { left: 64, top: 0, width: 20, height: 12, index: 4 },
  ]);

  it('visual eojji click stays on eojji', () => {
    const i = nearestCharIndexAtPoint(boxes, 25, 6);
    expect(extractStartEojeol(t, i)?.w).toBe('어찌');
  });

  it('does not jump eojji click to geuri', () => {
    const i = nearestCharIndexAtPoint(boxes, 30, 6);
    expect(extractStartEojeol(t, i)?.w).not.toBe('그리');
  });
});

describe('hitFromSingleIndex + extractStartEojeol', () => {
  const pageData = {
    pageNum: 1,
    text: '어찌 그리 차분. 그 모습을',
    visualText: '어찌 그리 차분. 그 모습을',
  };
  const rearGeu = pageData.text.indexOf('그 모습');

  it('layout single-point keeps rear 1-eojeol geu', () => {
    const hit = hitFromSingleIndex(pageData, rearGeu);
    expect(hit).toMatchObject({ start: rearGeu, matchedText: '그' });
    expect(extractStartEojeol(pageData.text, hit.start)?.w).toBe('그');
  });

  it('does not expand rear geu into earlier geuri', () => {
    const hit = hitFromSingleIndex(pageData, rearGeu);
    const eo = extractStartEojeol(pageData.text, hit.start);
    expect(eo?.w).not.toBe('그리');
    expect(eo?.start).toBe(rearGeu);
  });

  it('곳에서 mid-eojeol seo still anchors to 곳에서', () => {
    const t = '먼 곳에서 건너온';
    const seo = t.indexOf('서');
    const hit = hitFromSingleIndex({ pageNum: 1, text: t, visualText: t }, seo);
    expect(hit?.matchedText).toBe('서');
    expect(extractStartEojeol(t, hit.start)?.w).toBe('곳에서');
  });
});
