import { describe, expect, it } from 'vitest';
import {
  formatPageLabel,
  formatPrintedPageText,
  naturalPrintedLeft,
  shiftFromPrintedInput,
  systemPageFromDisplayInput,
} from './printedPageDisplay.js';

describe('printedPageDisplay', () => {
  it('uses natural progression 1, 2-3, 4-5, 6-7 per file page', () => {
    expect(formatPrintedPageText(1, 0, true, 200, 4, true)).toBe('1');
    expect(formatPrintedPageText(2, 0, true, 200, 4, true)).toBe('2-3');
    expect(formatPrintedPageText(3, 0, true, 200, 4, true)).toBe('4-5');
    expect(formatPrintedPageText(4, 0, true, 200, 4, true)).toBe('6-7');
    expect(formatPrintedPageText(5, 0, true, 200, 4, true)).toBe('8-9');
  });

  it('starts spreads from 1-2 when first page is not single', () => {
    expect(formatPrintedPageText(1, 0, true, 200, 4, false)).toBe('1-2');
    expect(formatPrintedPageText(2, 0, true, 200, 4, false)).toBe('3-4');
  });

  it('derives zero shift when calibrating 6-7 on file page 4', () => {
    const parsed = { start: 6, end: 7 };
    expect(shiftFromPrintedInput(parsed, 4, true)).toBe(0);
    expect(naturalPrintedLeft(4, true)).toBe(6);
  });

  it('applies shift only from anchor page onward', () => {
    const shift = -16;
    const anchor = 82;
    expect(formatPrintedPageText(2, shift, true, 200, anchor, true)).toBe('2-3');
    expect(formatPrintedPageText(81, shift, true, 200, anchor, true)).toBe(
      '160-161',
    );
    expect(formatPrintedPageText(82, shift, true, 200, anchor, true)).toBe(
      '146-147',
    );
    expect(formatPageLabel(82, shift, true, 200, anchor, true)).toBe('146-147P');
  });

  it('formats page labels with trailing P', () => {
    expect(formatPageLabel(4, 0, true, 200, 4, true)).toBe('6-7P');
  });

  it('shows natural printed spreads when enabled but not yet calibrated', () => {
    expect(formatPrintedPageText(4, null, true, 200, 1, true)).toBe('6-7');
    expect(formatPageLabel(4, null, true, 200, 1, true)).toBe('6-7P');
    expect(systemPageFromDisplayInput('6-7', null, true, 200, 1, true)).toBe(4);
  });

  it('converts spread input back to system page', () => {
    expect(systemPageFromDisplayInput('6-7', 0, true, 200, 4, true)).toBe(4);
    expect(systemPageFromDisplayInput('2-3', 0, true, 200, 4, true)).toBe(2);
    expect(systemPageFromDisplayInput('146', -16, true, 200, 82, true)).toBe(
      82,
    );
    expect(systemPageFromDisplayInput('146P', -16, true, 200, 82, true)).toBe(
      82,
    );
  });
});
