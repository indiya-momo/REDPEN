import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTooltipGuideDismissed,
  dismissTooltipGuide,
  isTooltipGuideDismissed,
} from './tooltipGuideStorage.js';

/** @type {Record<string, string>} */
const store = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tooltipGuideStorage', () => {
  it('처음에는 표시 대상이다', () => {
    expect(isTooltipGuideDismissed('test-key')).toBe(false);
  });

  it('확인 후에는 다시 표시하지 않는다', () => {
    dismissTooltipGuide('test-key');
    expect(isTooltipGuideDismissed('test-key')).toBe(true);
  });

  it('clear 후에는 다시 표시할 수 있다', () => {
    dismissTooltipGuide('test-key');
    clearTooltipGuideDismissed('test-key');
    expect(isTooltipGuideDismissed('test-key')).toBe(false);
  });
});
