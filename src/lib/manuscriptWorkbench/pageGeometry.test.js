import { describe, expect, it } from 'vitest';
import { selectionToRange } from './pageGeometry.js';
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
