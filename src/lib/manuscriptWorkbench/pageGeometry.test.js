import { describe, expect, it } from 'vitest';
import {
  expandCharBoxesVoronoiX,
  hitFromPointerIndexes,
  nearestCharIndexAtPoint,
  selectionToRange,
} from './pageGeometry.js';
import { resolveTextSelection } from './resolveTextSelection.js';

const pageData = {
  pageNum: 3,
  text: '방문할때면',
  visualText: '방문할때면',
  itemRefs: [
    { start: 0, end: 2, itemIndex: 0 },
    { start: 2, end: 6, itemIndex: 1 },
  ],
};

describe('selectionToRange', () => {
  it('item 오프셋을 page start/end로 바꾼다', () => {
    const hit = selectionToRange(pageData, {
      startItemIndex: 1,
      startOffset: 0,
      endItemIndex: 1,
      endOffset: 2,
    });
    expect(hit).toEqual({
      pageNum: 3,
      start: 2,
      end: 4,
      matchedText: '할때',
    });
  });

  it('뒤집힌 선택은 정렬한다', () => {
    const hit = resolveTextSelection(pageData, {
      startItemIndex: 1,
      startOffset: 4,
      endItemIndex: 0,
      endOffset: 1,
    });
    expect(hit).toMatchObject({ start: 1, end: 5, matchedText: '문할때면' });
  });

  it('텍스트 없는 페이지는 null', () => {
    expect(
      selectionToRange(
        { pageNum: 1, text: '', visualText: '', itemRefs: [] },
        { startItemIndex: 0, startOffset: 0, endItemIndex: 0, endOffset: 1 },
      ),
    ).toBeNull();
  });
});

describe('nearestCharIndexAtPoint', () => {
  // front geu at 10, rear geu at 40 (same line)
  const boxes = [
    { left: 10, top: 0, width: 10, height: 12, index: 10 },
    { left: 20, top: 0, width: 10, height: 12, index: 11 },
    { left: 100, top: 0, width: 10, height: 12, index: 40 },
    { left: 110, top: 0, width: 10, height: 12, index: 41 },
  ];

  it('picks rear char for end-of-line pointer', () => {
    expect(nearestCharIndexAtPoint(boxes, 104, 6)).toBe(40);
  });

  it('picks front char for start-of-line pointer', () => {
    expect(nearestCharIndexAtPoint(boxes, 14, 6)).toBe(10);
  });
});

describe('hitFromPointerIndexes', () => {
  it('single char drag is [i, i+1)', () => {
    expect(hitFromPointerIndexes(pageData, 2, 2)).toEqual({
      pageNum: 3,
      start: 2,
      end: 3,
      matchedText: '할',
    });
  });

  it('sorts range', () => {
    expect(hitFromPointerIndexes(pageData, 4, 2)).toMatchObject({
      start: 2,
      end: 5,
      matchedText: '할때면',
    });
  });
});

describe('expandCharBoxesVoronoiX + nearest', () => {
  // narrow geu box left-shifted; mo further right — click in gap nearer visual geu
  const raw = [
    { left: 0, top: 0, width: 6, height: 12, index: 0 }, // geu (narrow)
    { left: 20, top: 0, width: 10, height: 12, index: 2 }, // mo
  ];

  it('gap before midpoint stays on geu not mo (하고/그 증상)', () => {
    const boxes = expandCharBoxesVoronoiX(raw);
    // midpoint between geuRight(6) and moLeft(20) = 13
    expect(nearestCharIndexAtPoint(boxes, 12, 6)).toBe(0);
  });

  it('past midpoint picks mo', () => {
    const boxes = expandCharBoxesVoronoiX(raw);
    expect(nearestCharIndexAtPoint(boxes, 15, 6)).toBe(2);
  });

  it('hago last char vs next eojeol', () => {
    const raw2 = [
      { left: 0, top: 0, width: 8, height: 12, index: 10 }, // ha
      { left: 8, top: 0, width: 8, height: 12, index: 11 }, // go
      { left: 30, top: 0, width: 10, height: 12, index: 13 }, // in
    ];
    const boxes = expandCharBoxesVoronoiX(raw2);
    // mid(goRight=16, inLeft=30)=23
    expect(nearestCharIndexAtPoint(boxes, 20, 6)).toBe(11);
  });
});
