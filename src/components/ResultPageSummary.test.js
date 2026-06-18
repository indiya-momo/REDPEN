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
  it('emits one pill per instance with fragment labels on the same page', () => {
    const pills = buildInstancePills([inst(6, 1), inst(6, 2)]);
    expect(pills).toHaveLength(2);
    expect(pills[0].indexOnPage).toBe(1);
    expect(pills[1].indexOnPage).toBe(2);
    expect(pills[0].totalOnPage).toBe(2);
    expect(getInstanceFragmentLabel(pills[0].indexOnPage, pills[0].totalOnPage)).toBe(
      '1/2',
    );
    expect(getInstanceFragmentLabel(pills[1].indexOnPage, pills[1].totalOnPage)).toBe(
      '2/2',
    );
  });

  it('omits fragment label when only one instance is on the page', () => {
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
