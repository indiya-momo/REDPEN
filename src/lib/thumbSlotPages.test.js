import { describe, expect, it } from 'vitest';
import { thumbSlotPages } from './thumbSlotPages.js';

describe('thumbSlotPages', () => {
  it('keeps current page in the center slot', () => {
    expect(thumbSlotPages(17, 300)).toEqual([15, 16, 17, 18, 19]);
  });

  it('pads missing edges with null while keeping active centered', () => {
    expect(thumbSlotPages(1, 300)).toEqual([null, null, 1, 2, 3]);
    expect(thumbSlotPages(2, 300)).toEqual([null, 1, 2, 3, 4]);
    expect(thumbSlotPages(299, 300)).toEqual([297, 298, 299, 300, null]);
    expect(thumbSlotPages(300, 300)).toEqual([298, 299, 300, null, null]);
  });
});
