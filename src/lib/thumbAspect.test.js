import { describe, expect, it, vi } from 'vitest';
import { resolveThumbAspect } from './thumbAspect.js';
import { DEFAULT_THUMB_ASPECT } from './thumbDisplaySize.js';

describe('resolveThumbAspect', () => {
  it('uses the widest aspect among requested pages', async () => {
    const aspects = { 1: 0.7, 7: 1.45, 8: 1.42 };
    const pdf = {
      numPages: 10,
      getPage: vi.fn(async (n) => ({
        getViewport: () => ({ width: aspects[n] * 100, height: 100 }),
      })),
    };

    const aspect = await resolveThumbAspect(pdf, [1, 7, 8]);
    expect(aspect).toBe(1.45);
  });

  it('falls back when no valid pages', async () => {
    const pdf = { numPages: 3, getPage: vi.fn() };
    await expect(resolveThumbAspect(pdf, [])).resolves.toBe(DEFAULT_THUMB_ASPECT);
  });
});
