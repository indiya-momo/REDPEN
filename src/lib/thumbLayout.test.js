import { describe, expect, it, vi } from 'vitest';
import {
  computeThumbLayout,
  DEFAULT_THUMB_ASPECT,
  resolveThumbAspect,
  THUMB_SCALE,
  THUMB_SLOT_COUNT,
} from './thumbLayout.js';

const scaledH = () => Math.round(62 * THUMB_SCALE);

describe('computeThumbLayout', () => {
  it('derives strip width from five slots and page aspect', () => {
    const portrait = computeThumbLayout(0.7);
    expect(portrait.displayH).toBe(scaledH());
    expect(portrait.displayW).toBe(Math.round(scaledH() * 0.7));
    expect(portrait.slotW).toBe(portrait.displayW);
    expect(portrait.stripW).toBeGreaterThan(portrait.displayW * THUMB_SLOT_COUNT);
  });

  it('widens all layers for landscape spread aspect', () => {
    const spread = computeThumbLayout(1.42);
    const portrait = computeThumbLayout(0.7);
    expect(spread.displayW).toBeGreaterThan(spread.displayH);
    expect(spread.stripW).toBeGreaterThan(portrait.stripW);
  });

  it('falls back to portrait aspect when aspect is invalid', () => {
    const fallback = computeThumbLayout(Number.NaN);
    expect(fallback.displayH).toBe(scaledH());
    expect(fallback.displayW).toBe(Math.round(scaledH() * DEFAULT_THUMB_ASPECT));
  });
});

describe('resolveThumbAspect', () => {
  it('uses the widest aspect among visible slots', async () => {
    const aspects = { 1: 0.7, 7: 1.45, 8: 1.42 };
    const pdf = {
      numPages: 10,
      getPage: vi.fn(async (n) => ({
        getViewport: () => ({ width: aspects[n] * 100, height: 100 }),
      })),
    };

    const aspect = await resolveThumbAspect(pdf, [1, 7, 8, null]);
    expect(aspect).toBe(1.45);
  });

  it('falls back when no valid pages', async () => {
    const pdf = { numPages: 3, getPage: vi.fn() };
    await expect(resolveThumbAspect(pdf, [null, null])).resolves.toBe(
      DEFAULT_THUMB_ASPECT,
    );
  });
});
