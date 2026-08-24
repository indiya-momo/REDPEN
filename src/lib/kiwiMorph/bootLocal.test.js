import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadKiwiBrowser } from './loadBrowser.js';
import { pingKiwiAnalyze } from './serverRunner.js';
import { clearKiwiInstance, setKiwiServerMode } from './runtime.js';
import { bootKiwiIfNeeded, shouldBootKiwi } from './bootLocal.js';

vi.mock('./loadBrowser.js', () => ({
  loadKiwiBrowser: vi.fn(async () => ({ ready: () => true })),
}));

vi.mock('./serverRunner.js', () => ({
  pingKiwiAnalyze: vi.fn(async () => false),
}));

describe('bootLocal phase2', () => {
  const prevJosa = import.meta.env.VITE_UNIFY_KIWI_JOSA;
  const prevBoundary = import.meta.env.VITE_SPELLING_KIWI_BOUNDARY;
  const prevNoise = import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER;
  const prevEndpoint = import.meta.env.VITE_KIWI_ANALYZE_ENDPOINT;
  const prevDev = import.meta.env.DEV;

  beforeEach(() => {
    clearKiwiInstance();
    setKiwiServerMode(false);
    import.meta.env.DEV = true;
    import.meta.env.VITE_UNIFY_KIWI_JOSA = undefined;
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
    import.meta.env.VITE_KIWI_ANALYZE_ENDPOINT = '';
    loadKiwiBrowser.mockClear();
    pingKiwiAnalyze.mockClear();
  });

  afterEach(() => {
    import.meta.env.VITE_UNIFY_KIWI_JOSA = prevJosa;
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = prevBoundary;
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = prevNoise;
    import.meta.env.VITE_KIWI_ANALYZE_ENDPOINT = prevEndpoint;
    import.meta.env.DEV = prevDev;
    clearKiwiInstance();
    setKiwiServerMode(false);
  });

  it('shouldBootKiwi는 JOSA·BOUNDARY만 본다', () => {
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'true';
    expect(shouldBootKiwi()).toBe(false);
  });

  it('phase2 없이 NOISE_FILTER만으로는 boot하지 않는다', async () => {
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'true';
    expect(await bootKiwiIfNeeded({ maxWaitMs: 1 })).toBe(false);
    expect(loadKiwiBrowser).not.toHaveBeenCalled();
  });

  it('2차 phase2 + NOISE_FILTER면 boot를 시도한다', async () => {
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'true';
    expect(await bootKiwiIfNeeded({ phase2: true, maxWaitMs: 1 })).toBe(true);
    expect(loadKiwiBrowser).toHaveBeenCalled();
  });

  it('2차라도 NOISE_FILTER가 꺼져 있으면 boot하지 않는다', async () => {
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'false';
    expect(await bootKiwiIfNeeded({ phase2: true, maxWaitMs: 1 })).toBe(false);
    expect(loadKiwiBrowser).not.toHaveBeenCalled();
  });
});
