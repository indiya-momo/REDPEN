import { describe, expect, it } from 'vitest';
import {
  AUXILIARY_SPACING_BREAKDOWN_TIP,
  countAuxiliaryMatchedSpacingSurfaces,
  formatAuxiliarySpacingBreakdown,
  formatAuxiliarySpacingDualLine,
} from './auxiliaryVerbSpacingSummary.js';

describe('auxiliaryVerbSpacingSummary', () => {
  it('matchedText 공백 여부로 띄움·붙임 건수를 센다', () => {
    expect(
      countAuxiliaryMatchedSpacingSurfaces([
        { matchedText: '들어 온', pageNum: 1, index: 0 },
        { matchedText: '들어온', pageNum: 2, index: 0 },
        { matchedText: '해 보', pageNum: 3, index: 0 },
      ]),
    ).toEqual({ spaced: 2, glued: 1, spacedSolid: 0, gluedSolid: 0 });
    expect(formatAuxiliarySpacingBreakdown({ spaced: 2, glued: 1 })).toBe(
      '띄움 2건 · 붙임 1건',
    );
  });

  it('한쪽만 있으면 해당 칸만', () => {
    expect(formatAuxiliarySpacingBreakdown({ spaced: 3, glued: 0 })).toBe(
      '띄움 3건',
    );
    expect(AUXILIARY_SPACING_BREAKDOWN_TIP.length).toBeGreaterThan(10);
  });

  it('띄어 쓴·붙여 쓴 뒤에 합성어 수를 있을 때만 붙인다', () => {
    expect(
      formatAuxiliarySpacingDualLine({
        doc: { spaced: 5, glued: 9 },
        match: { spaced: 3, glued: 0 },
      }),
    ).toBe('띄어 쓴 3');
    expect(
      formatAuxiliarySpacingDualLine({
        doc: { spaced: 5, glued: 9 },
        match: { spaced: 3, glued: 9, spacedSolid: 1 },
      }),
    ).toBe('띄어 쓴 3 - 합성어 1 I 붙여 쓴 9');
    expect(
      formatAuxiliarySpacingDualLine({
        match: { spaced: 3, glued: 9, spacedSolid: 1, gluedSolid: 2 },
      }),
    ).toBe('띄어 쓴 3 - 합성어 1 I 붙여 쓴 9 - 합성어 2');
  });
});