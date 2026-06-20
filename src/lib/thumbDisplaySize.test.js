import { describe, expect, it } from 'vitest';
import {
  thumbFitInBox,
  THUMB_FIT_BOX_H_PX,
  THUMB_FIT_BOX_W_PX,
  THUMB_HEIGHT_PX,
} from './thumbDisplaySize.js';

describe('thumbFitInBox', () => {
  it('fits tall portrait pages to box height', () => {
    const portrait = thumbFitInBox(0.65);
    expect(portrait.displayH).toBe(THUMB_FIT_BOX_H_PX);
    expect(portrait.displayW).toBe(Math.round(THUMB_FIT_BOX_H_PX * 0.65));
    expect(portrait.displayW).toBeLessThanOrEqual(THUMB_FIT_BOX_W_PX);
  });

  it('fits slightly wide portrait pages to box width', () => {
    const wide = thumbFitInBox(0.7);
    expect(wide.displayW).toBe(THUMB_FIT_BOX_W_PX);
    expect(wide.displayH).toBe(Math.round(THUMB_FIT_BOX_W_PX / 0.7));
  });

  it('fits wide spread pages to box width', () => {
    const spread = thumbFitInBox(1.4);
    expect(spread.displayW).toBe(THUMB_FIT_BOX_W_PX);
    expect(spread.displayH).toBe(Math.round(THUMB_FIT_BOX_W_PX / 1.4));
    expect(spread.displayH).toBeLessThanOrEqual(THUMB_FIT_BOX_H_PX);
  });

  it('falls back to portrait aspect when aspect is invalid', () => {
    const fallback = thumbFitInBox(Number.NaN);
    expect(fallback.displayW).toBeGreaterThan(0);
    expect(fallback.displayH).toBeGreaterThan(0);
    expect(fallback.displayW).toBeLessThanOrEqual(THUMB_FIT_BOX_W_PX);
    expect(fallback.displayH).toBeLessThanOrEqual(THUMB_FIT_BOX_H_PX);
  });

  it('keeps render height constant for PDF scale', () => {
    expect(THUMB_HEIGHT_PX).toBe(THUMB_FIT_BOX_H_PX);
  });
});
