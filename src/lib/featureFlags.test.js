import { describe, expect, it } from 'vitest';
import { isTocBodyCheckEnabled } from './featureFlags.js';

describe('isTocBodyCheckEnabled', () => {
  it('vitest 환경에서는 DEV 또는 명시 플래그로 판단한다', () => {
    const enabled = isTocBodyCheckEnabled();
    expect(typeof enabled).toBe('boolean');
    if (import.meta.env.VITE_FEATURE_TOC_BODY_CHECK === 'true') {
      expect(enabled).toBe(true);
    }
  });
});
