import { describe, expect, it } from 'vitest';
import {
  buildInstancePills,
  fitPillsIntoTwoRows,
  getInstanceFragmentLabel,
} from './ResultPageSummary.jsx';

/** @param {number} pageNum @param {number} index */
function inst(pageNum, index) {
  return {
    find: 'a',
    replace: 'b',
    matchedText: 'a',
    suggestedText: 'b',
    pageNum,
    index,
  };
}

/**
 * @param {{
 *   tops: number[],
 *   height?: number,
 *   width?: number,
 *   clientWidth?: number,
 * }} opts
 */
function mockPillRoot({ tops, height = 20, width = 40, clientWidth = 200 }) {
  const children = tops.map((top, i) => {
    const left = (i % 5) * (width + 6);
    return {
      hasAttribute: (name) => name === 'data-result-pill',
      offsetTop: top,
      offsetHeight: height,
      getBoundingClientRect: () => ({
        right: left + width,
        left,
        top,
        bottom: top + height,
        width,
        height,
      }),
    };
  });
  return {
    children,
    clientWidth,
    getBoundingClientRect: () => ({
      right: clientWidth,
      left: 0,
      width: clientWidth,
    }),
  };
}

describe('buildInstancePills', () => {
  it('omits fragment on pages with a single hit', () => {
    const pills = buildInstancePills([
      inst(40, 1),
      inst(62, 1),
      inst(88, 1),
      inst(88, 2),
    ]);
    expect(pills.map((p) => p.inst.pageNum)).toEqual([40, 62, 88, 88]);
    expect(getInstanceFragmentLabel(pills[0].indexOnPage, pills[0].totalOnPage)).toBeNull();
    expect(getInstanceFragmentLabel(pills[1].indexOnPage, pills[1].totalOnPage)).toBeNull();
    expect(getInstanceFragmentLabel(pills[2].indexOnPage, pills[2].totalOnPage)).toBe(
      '1/2',
    );
    expect(getInstanceFragmentLabel(pills[3].indexOnPage, pills[3].totalOnPage)).toBe(
      '2/2',
    );
  });

  it('orders pills by page then reading order within page', () => {
    const pills = buildInstancePills([inst(4, 1), inst(6, 1), inst(6, 2)]);
    expect(pills.map((p) => [p.inst.pageNum, p.inst.index])).toEqual([
      [4, 1],
      [6, 1],
      [6, 2],
    ]);
  });

  it('omits fragment label when the group has only one instance', () => {
    const pills = buildInstancePills([inst(4, 1)]);
    expect(getInstanceFragmentLabel(pills[0].indexOnPage, pills[0].totalOnPage)).toBeNull();
  });
});

describe('getInstanceFragmentLabel', () => {
  it('never returns ×N style labels', () => {
    expect(getInstanceFragmentLabel(1, 3)).toBe('1/3');
    expect(getInstanceFragmentLabel(2, 3)).toBe('2/3');
  });
});

describe('fitPillsIntoTwoRows', () => {
  it('한 줄에 다 들어가면 접지 않는다', () => {
    const root = mockPillRoot({
      tops: Array.from({ length: 8 }, () => 0),
    });
    expect(fitPillsIntoTwoRows(/** @type {any} */ (root), 8)).toEqual({
      needsCollapse: false,
      visibleCount: 8,
    });
  });

  it('세 줄이면 접고 보이는 개수를 줄인다', () => {
    const root = mockPillRoot({
      tops: [
        ...Array.from({ length: 5 }, () => 0),
        ...Array.from({ length: 5 }, () => 28),
        ...Array.from({ length: 5 }, () => 56),
      ],
    });
    const result = fitPillsIntoTwoRows(/** @type {any} */ (root), 15);
    expect(result.needsCollapse).toBe(true);
    expect(result.visibleCount).toBeLessThan(15);
    expect(result.visibleCount).toBeGreaterThan(0);
  });
});
