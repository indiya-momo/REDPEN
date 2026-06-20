import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THUMB_ASPECT,
  thumbDisplaySize,
  THUMB_HEIGHT_PX,
} from './thumbDisplaySize.js';

describe('thumbDisplaySize', () => {
  it('keeps fixed height and scales width by page aspect (portrait)', () => {
    const portrait = thumbDisplaySize(0.7);
    expect(portrait.displayH).toBe(THUMB_HEIGHT_PX);
    expect(portrait.displayW).toBe(Math.round(THUMB_HEIGHT_PX * 0.7));
  });

  it('renders wide spread pages as horizontal rectangles', () => {
    const spread = thumbDisplaySize(1.42);
    expect(spread.displayH).toBe(THUMB_HEIGHT_PX);
    expect(spread.displayW).toBe(Math.round(THUMB_HEIGHT_PX * 1.42));
    expect(spread.displayW).toBeGreaterThan(spread.displayH);
  });

  it('falls back to portrait aspect when aspect is invalid', () => {
    const fallback = thumbDisplaySize(Number.NaN);
    expect(fallback.displayH).toBe(THUMB_HEIGHT_PX);
    expect(fallback.aspect).toBe(DEFAULT_THUMB_ASPECT);
    expect(fallback.displayW).toBeGreaterThan(0);
  });
});
