import { describe, expect, it } from 'vitest';
import { resolveLayoutPointHit } from './resolveLayoutPointHit.js';

describe('resolveLayoutPointHit', () => {
  const pageData = {
    pageNum: 4,
    text: '어찌 그리. 그 모습을',
    visualText: '어찌 그리. 그 모습을',
  };

  it('returns null when DOM and glyph both unavailable', () => {
    expect(
      resolveLayoutPointHit({
        pageData,
        root: null,
        wrap: null,
        itemBoxes: [],
        clientX: 0,
        clientY: 0,
      }),
    ).toBe(null);
  });
});
