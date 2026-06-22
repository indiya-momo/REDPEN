import { describe, expect, it } from 'vitest';
import {
  buildInstancePills,
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

  it('orders pills by page then index within page', () => {
    const pills = buildInstancePills([inst(6, 2), inst(4, 1), inst(6, 1)]);
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
