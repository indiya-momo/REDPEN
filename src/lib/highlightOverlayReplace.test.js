import { describe, expect, it, vi } from 'vitest';
import { getHighlightOverlayReplace } from './highlightOverlayReplace.js';

vi.mock('./builtInRules.js', () => ({
  getBuiltInOverlayReplace: (find, replace) => {
    if (find === '가 닿' && replace === '가닿') return '→가⁀닿';
    if (find === '되풀이 되' && replace === '되풀이되') return '→되풀이⁀되';
    return null;
  },
}));

describe('getHighlightOverlayReplace', () => {
  it('returns overlay_replace text as-is from sheet', () => {
    expect(
      getHighlightOverlayReplace({
        find: '가 닿',
        replace: '가닿',
        suggestedText: '가닿',
        matchedText: '가 닿',
        pageNum: 210,
        index: 0,
      }),
    ).toBe('→가⁀닿');
    expect(
      getHighlightOverlayReplace({
        find: '되풀이 되',
        replace: '되풀이되',
        suggestedText: '되풀이되',
        matchedText: '되풀이 되',
        pageNum: 210,
        index: 0,
      }),
    ).toBe('→되풀이⁀되');
  });

  it('returns null when overlay_replace is empty', () => {
    expect(
      getHighlightOverlayReplace({
        find: '우리 나라',
        replace: '우리나라',
        suggestedText: '우리나라',
        matchedText: '우리 나라',
        pageNum: 1,
        index: 0,
      }),
    ).toBeNull();
  });
});
