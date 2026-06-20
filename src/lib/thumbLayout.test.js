import { describe, expect, it } from 'vitest';
import { computeThumbLayout, scaledThumbHeightPx, THUMB_SLOT_COUNT } from './thumbLayout.js';

describe('computeThumbLayout', () => {
  it('derives strip width from five slots and page aspect', () => {
    const portrait = computeThumbLayout(0.7);
    expect(portrait.displayH).toBe(scaledThumbHeightPx());
    expect(portrait.displayW).toBe(Math.round(portrait.displayH * 0.7));
    expect(portrait.slotW).toBe(portrait.displayW);
    expect(portrait.stripW).toBeGreaterThan(portrait.displayW * THUMB_SLOT_COUNT);
  });

  it('widens all layers for landscape spread aspect', () => {
    const spread = computeThumbLayout(1.42);
    const portrait = computeThumbLayout(0.7);
    expect(spread.displayW).toBeGreaterThan(spread.displayH);
    expect(spread.stripW).toBeGreaterThan(portrait.stripW);
    expect(spread.slotW).toBe(spread.displayW);
  });

  it('keeps strip height in sync with thumbnail and label row', () => {
    const layout = computeThumbLayout(1.1);
    expect(layout.stripH).toBeGreaterThan(layout.displayH);
    expect(layout.slotH).toBeGreaterThan(layout.displayH);
  });
});
